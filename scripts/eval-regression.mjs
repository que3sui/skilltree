#!/usr/bin/env node
/**
 * 评测回归套件（合并门禁）：对三个样例仓库跑 mock 评测，
 * 断言行为不变量未被本体/流水线改动悄悄破坏——对应 AI 原生 SDLC 的"持续 eval，通过率作门槛"。
 * 运行：pnpm eval:regression   （确定性、离线、零成本）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runEvaluation } from "../packages/evaluator/src/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(ROOT, "ontology", "packs", "cs");
const OUT = path.join(ROOT, "reports", "regression");

/** 不变量：改动本体或流水线后这些结论必须仍然成立；要改变它们必须显式修改本文件并说明理由 */
const INVARIANTS = [
  {
    repo: "task-todo",
    check: (r) =>
      r.stats.litSkills >= 12 && r.redteam.overallRisk === "low",
    why: "优质项目应大面积点亮且红队无标记",
  },
  {
    repo: "algo-notebook",
    check: (r) =>
      r.redteam.overallRisk === "high" &&
      r.redteam.checks.some((c) => c.name === "provenance" && c.verdict === "flag"),
    why: "来源存疑项目必须被红队标记",
  },
  {
    repo: "empty-stub",
    check: (r) => r.stats.litSkills === 0 && r.redteam.overallRisk === "high",
    why: "空壳项目必须全灭",
  },
];

fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const inv of INVARIANTS) {
  const report = await runEvaluation({
    repoPath: path.join(ROOT, "samples", inv.repo),
    packDir: PACK,
    providerKind: "mock",
    outDir: OUT,
  });
  const ok = inv.check(report);
  console.log(
    `${ok ? "✔" : "✗"} ${inv.repo.padEnd(14)} 点亮 ${String(report.stats.litSkills).padStart(2)}/${report.stats.totalSkills}  风险 ${report.redteam.overallRisk}  —— ${inv.why}`,
  );
  if (!ok) failed++;
}

if (failed > 0) {
  console.error(`\n✗ ${failed} 条行为不变量被破坏。若是有意变更，请同步更新 scripts/eval-regression.mjs 的 INVARIANTS 并说明理由。`);
  process.exit(1);
}
console.log("\n✔ 评测回归全部通过：样例结论未被本轮改动破坏。");
