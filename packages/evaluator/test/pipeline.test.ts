import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ReportSchema, applyPrereqCaps } from "@skilltree/schema";
import { runEvaluation } from "../src/pipeline.js";
import { loadPack } from "../src/pack.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PACK = path.join(ROOT, "ontology", "packs", "cs");
const SAMPLE = (name: string): string => path.join(ROOT, "samples", name);

function tmpOut(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-out-"));
}

test("pipeline(mock) 端到端：task-todo 产出合法报告且编程/软件分支点亮", async () => {
  const out = tmpOut();
  const report = await runEvaluation({
    repoPath: SAMPLE("task-todo"),
    packDir: PACK,
    providerKind: "mock",
    outDir: out,
  });

  assert.equal(report.reportVersion, 1);
  assert.equal(report.assessments.length, 41);
  assert.equal(report.effective.length, 41);
  assert.equal(report.evidence.kind, "local-dir");
  assert.ok(report.stats.litSkills >= 12, `task-todo 应大面积点亮，实际 ${report.stats.litSkills}`);
  assert.equal(report.redteam.overallRisk, "low");
  // 报告能通过自身 schema 校验（写代码的 agent 不能自我批准——但至少要过契约）
  assert.equal(ReportSchema.safeParse(report).success, true);
  // 报告文件已落盘且内容可回读
  const files = fs.readdirSync(out).filter((f) => f.endsWith(".json"));
  assert.equal(files.length, 1);
  const parsed = JSON.parse(fs.readFileSync(path.join(out, files[0]!), "utf8"));
  assert.equal(parsed.id, report.id);
});

test("pipeline(mock) 端到端：empty-stub 全灭 + 红队高风险", async () => {
  const report = await runEvaluation({
    repoPath: SAMPLE("empty-stub"),
    packDir: PACK,
    providerKind: "mock",
    outDir: tmpOut(),
  });
  assert.equal(report.stats.litSkills, 0, "空壳项目必须全灭");
  assert.equal(report.redteam.overallRisk, "high");
  assert.ok(report.redteam.checks.some((c) => c.name === "stub_evidence" && c.verdict === "flag"));
});

test("pipeline(mock) 端到端：algo-notebook 被红队标记来源问题", async () => {
  const report = await runEvaluation({
    repoPath: SAMPLE("algo-notebook"),
    packDir: PACK,
    providerKind: "mock",
    outDir: tmpOut(),
  });
  assert.equal(report.redteam.overallRisk, "high");
  assert.ok(report.redteam.checks.some((c) => c.name === "provenance" && c.verdict === "flag"));
  assert.ok(report.arbitration.notes.length > 0);
});

test("pipeline：前置约束在真实本体上产生阻塞记录，且报告可独立复核", async () => {
  const report = await runEvaluation({
    repoPath: SAMPLE("task-todo"),
    packDir: PACK,
    providerKind: "mock",
    outDir: tmpOut(),
  });
  const blocked = report.effective.filter((e) => e.blockedBy.length > 0);
  assert.ok(blocked.length > 0, "task-todo 的 mock 结论应存在前置阻塞样例");

  // 可复核性：任何人拿报告里的评估等级 + 本体重算前置约束，必须得到与报告一致的点亮结果
  const { pack } = loadPack(PACK);
  const recomputed = applyPrereqCaps(
    pack,
    report.assessments.map((a) => ({ skillId: a.skillId, level: a.level })),
  );
  assert.deepEqual(
    recomputed.map((e) => [e.skillId, e.effectiveLevel]),
    report.effective.map((e) => [e.skillId, e.effectiveLevel]),
  );
});

test("pipeline：本体校验失败时拒绝评测", async () => {
  const badPack = path.join(ROOT, "samples", "task-todo"); // 不是 pack 目录
  await assert.rejects(
    runEvaluation({ repoPath: SAMPLE("task-todo"), packDir: badPack, providerKind: "mock", outDir: tmpOut() }),
    /pack 目录需包含/,
  );
});
