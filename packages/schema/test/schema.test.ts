import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SkillPackSchema,
  applyPrereqCaps,
  checkPack,
  computeStats,
  mergeReports,
  ReportSchema,
  type Report,
  type SkillPack,
} from "../src/index.js";

function mkPack(): SkillPack {
  return SkillPackSchema.parse({
    schemaVersion: 1,
    id: "test",
    name: "测试包",
    version: "1.0.0",
    description: "",
    levelSemantics: [{ level: 1, title: "L1", description: "基础" }],
    branches: [
      {
        id: "b1",
        name: "分支一",
        color: "#3b82f6",
        skills: [
          {
            id: "a",
            name: "技能A",
            tier: 0,
            prereqs: [],
            levels: [{ level: 1, criteria: ["A-1"] }],
          },
          {
            id: "b",
            name: "技能B",
            tier: 1,
            prereqs: [{ skill: "a", minLevel: 1 }],
            levels: [
              { level: 1, criteria: ["B-1"] },
              { level: 2, criteria: ["B-2"] },
            ],
          },
          {
            id: "c",
            name: "技能C",
            tier: 2,
            prereqs: [{ skill: "b", minLevel: 2 }],
            levels: [{ level: 1, criteria: ["C-1"] }],
          },
        ],
      },
      {
        id: "b2",
        name: "分支二",
        color: "#ef4444",
        skills: [
          {
            id: "d",
            name: "技能D",
            tier: 0,
            prereqs: [],
            levels: [{ level: 1, criteria: ["D-1"] }],
          },
        ],
      },
    ],
  });
}

test("checkPack：合法包零错误", () => {
  const issues = checkPack(mkPack());
  assert.equal(issues.filter((i) => i.severity === "error").length, 0);
});

test("checkPack：前置引用不存在 / 自引用 / 成环 均报错", () => {
  const pack = mkPack();
  pack.branches[0]!.skills[0]!.prereqs = [{ skill: "不存在的技能", minLevel: 1 }];
  assert.ok(checkPack(pack).some((i) => i.message.includes("前置不存在")));

  const selfRef = mkPack();
  selfRef.branches[0]!.skills[0]!.prereqs = [{ skill: "a", minLevel: 1 }];
  assert.ok(checkPack(selfRef).some((i) => i.message.includes("依赖自身")));

  const cyc = mkPack();
  cyc.branches[0]!.skills[0]!.prereqs = [{ skill: "b", minLevel: 1 }]; // a→b→c→? 造 a↔b 环
  cyc.branches[0]!.skills[1]!.prereqs = [{ skill: "a", minLevel: 1 }];
  assert.ok(checkPack(cyc).some((i) => i.message.includes("成环")));
});

test("applyPrereqCaps：前置未达标 → 有效等级清零并记录阻塞", () => {
  const pack = mkPack();
  const effective = applyPrereqCaps(pack, [
    { skillId: "a", level: 0 },
    { skillId: "b", level: 2 }, // b 达 L2，但前置 a 未点亮
    { skillId: "c", level: 1 },
  ]);
  const byId = new Map(effective.map((e) => [e.skillId, e]));
  assert.equal(byId.get("b")!.effectiveLevel, 0);
  assert.equal(byId.get("b")!.assessedLevel, 2);
  assert.deepEqual(byId.get("b")!.blockedBy, ["a@L1"]);
  assert.equal(byId.get("c")!.effectiveLevel, 0); // 前置链断裂，级联阻塞
});

test("applyPrereqCaps：前置达标 → 保留评估等级", () => {
  const pack = mkPack();
  const effective = applyPrereqCaps(pack, [
    { skillId: "a", level: 1 },
    { skillId: "b", level: 2 },
    { skillId: "c", level: 1 },
  ]);
  const byId = new Map(effective.map((e) => [e.skillId, e]));
  assert.equal(byId.get("b")!.effectiveLevel, 2);
  // c 评估 L1，其前置 b@L2 已满足 → 保留 L1
  assert.equal(byId.get("c")!.effectiveLevel, 1);
  assert.equal(byId.get("c")!.blockedBy.length, 0);
});

test("applyPrereqCaps：缺失评估视同 0", () => {
  const pack = mkPack();
  const effective = applyPrereqCaps(pack, [{ skillId: "d", level: 1 }]);
  const byId = new Map(effective.map((e) => [e.skillId, e]));
  assert.equal(byId.get("a")!.effectiveLevel, 0);
  assert.equal(byId.get("a")!.assessedLevel, 0);
});

test("computeStats：按分支聚合点亮数与等级和", () => {
  const pack = mkPack();
  const effective = applyPrereqCaps(pack, [
    { skillId: "a", level: 1 },
    { skillId: "b", level: 2 },
  ]);
  const stats = computeStats(pack, effective);
  assert.equal(stats.totalSkills, 4);
  assert.equal(stats.litSkills, 2);
  assert.equal(stats.byBranch.b1!.lit, 2);
  assert.equal(stats.byBranch.b1!.levelSum, 3);
  assert.equal(stats.byBranch.b2!.lit, 0);
});

// ---------------------------------------------------------------------------
// mergeReports：专项评测合并
// ---------------------------------------------------------------------------

function mkAssessment(skillId: string, level: number) {
  return {
    skillId,
    level,
    confidence: 0.9,
    rationale: "",
    criteria: [],
  };
}

function mkReport(id: string, assessments: Report["assessments"], overrides: Partial<Report> = {}): Report {
  const pack = mkPack();
  const effective = applyPrereqCaps(pack, assessments);
  const stats = computeStats(pack, effective);
  return ReportSchema.parse({
    reportVersion: 1,
    id,
    createdAt: `2026-09-06T00:00:0${id.length % 10}.000Z`,
    evidence: { kind: "local-dir", path: "/repo", name: "repo", fileCount: 1, totalLines: 1, digestHash: "h" + id },
    pack: { id: "test", version: "1.0.0", contentHash: "c" },
    model: { provider: "mock", details: "" },
    survey: { summary: "", languages: {}, entryPoints: [], buildCommands: [], testCommands: [], observations: [] },
    assessments,
    redteam: { checks: [], overallRisk: "low" },
    arbitration: { adjustments: [], notes: "" },
    effective,
    stats,
    ...overrides,
  });
}

test("mergeReports：范围内技能被新裁决覆盖，范围外沿用 base", () => {
  const pack = mkPack();
  const base = mkReport("base", [mkAssessment("a", 1), mkAssessment("b", 2), mkAssessment("d", 1)]);
  // 专项重评 b：这次只评了 L0（比如证据被推翻）
  const partial = mkReport("part", [mkAssessment("b", 0)], {
    redteam: { checks: [{ name: "tests_present", title: "测试", verdict: "flag", detail: "" }], overallRisk: "high" },
  });
  const merged = mergeReports(base, partial, pack);
  const byId = new Map(merged.assessments.map((x) => [x.skillId, x]));
  assert.equal(byId.size, 3);
  assert.equal(byId.get("b")!.level, 0); // 覆盖
  assert.equal(byId.get("a")!.level, 1); // 沿用
  assert.equal(byId.get("d")!.level, 1); // 沿用
  // 红队/统计来自本次重跑，前置约束全量重算
  assert.equal(merged.redteam.overallRisk, "high");
  assert.equal(merged.stats.litSkills, 2);
  // scope 元数据指向 base
  assert.ok(merged.scope);
  assert.equal(merged.scope.baseReportId, "base");
});

test("mergeReports：scope 字段写明范围与基础报告，报告可过 schema 校验", () => {
  const pack = mkPack();
  const base = mkReport("base", [mkAssessment("a", 1), mkAssessment("b", 2)]);
  const partial = mkReport("part", [mkAssessment("a", 1)]);
  const merged = mergeReports(base, partial, pack);
  assert.deepEqual(merged.scope?.skills, ["a"]);
  assert.equal(merged.scope?.baseReportId, "base");
  assert.deepEqual(ReportSchema.parse(merged).scope?.skills, ["a"]);
});

test("mergeReports：范围外 base 仲裁留痕保留，范围内以 partial 为准", () => {
  const pack = mkPack();
  const base = mkReport("base", [mkAssessment("a", 1), mkAssessment("b", 2)], {
    arbitration: {
      adjustments: [
        { skillId: "a", from: 2, to: 1, reason: "base 调整" },
        { skillId: "b", from: 2, to: 2, reason: "" },
      ],
      notes: "",
    },
  });
  const partial = mkReport("part", [mkAssessment("b", 1)], {
    arbitration: { adjustments: [{ skillId: "b", from: 2, to: 1, reason: "本次调整" }], notes: "n" },
  });
  const merged = mergeReports(base, partial, pack);
  const ids = merged.arbitration.adjustments.map((x) => x.skillId);
  assert.ok(ids.includes("a")); // 范围外保留
  const bAdj = merged.arbitration.adjustments.find((x) => x.skillId === "b");
  assert.equal(bAdj?.reason, "本次调整"); // 范围内以 partial 为准
});

test("mergeReports：合并报告可再作 base（链条合并），scope 指向最近一次 partial", () => {
  const pack = mkPack();
  const base = mkReport("b0", [mkAssessment("a", 1), mkAssessment("b", 2), mkAssessment("d", 1)]);
  const m1 = mergeReports(base, mkReport("p1", [mkAssessment("a", 1)]), pack);
  const m2 = mergeReports(m1, mkReport("p2", [mkAssessment("b", 2)]), pack);
  assert.deepEqual(m2.scope?.skills, ["b"]);
  assert.equal(m2.scope?.baseReportId, "p1"); // 指向最近一次基础，不丢链条
  assert.equal(m2.scope?.baseProvider, "mock");
  const byId = new Map(m2.assessments.map((x) => [x.skillId, x]));
  assert.equal(byId.get("a")!.level, 1); // 第一轮专项结果在链条中保留
  assert.equal(byId.get("b")!.level, 2);
  assert.equal(byId.get("d")!.level, 1);
});

test("mergeReports：rubric 版本不一致 → 拒绝合并（范围外裁决基于旧标准，不可比）", () => {
  const pack = mkPack();
  const base = mkReport("base", [mkAssessment("a", 1)]);
  const partial = mkReport("part", [mkAssessment("a", 1)], {
    pack: { id: "test", version: "1.0.0", contentHash: "different-hash" },
  });
  assert.throws(() => mergeReports(base, partial, pack), /rubric 版本与当前不一致/);
});
