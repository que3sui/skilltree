import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SkillPackSchema,
  applyPrereqCaps,
  checkPack,
  computeStats,
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
