#!/usr/bin/env node
/**
 * rubric 影响报告（MAJOR 版本 PR 的必附项，见 docs/DESIGN.zh.md §5.3）：
 * 对三个样例重跑 mock 评测，与运行前已有的最新报告逐技能对比等级变化。
 * 运行：pnpm rubric:impact
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runEvaluation } from "../packages/evaluator/src/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(ROOT, "ontology", "packs", "cs");
const OUT = path.join(ROOT, "reports");
const SAMPLES = ["task-todo", "algo-notebook", "empty-stub"];

function latestReportFor(repoName, excludeFile) {
  const files = fs
    .readdirSync(OUT)
    .filter((f) => f.endsWith(".json") && f !== excludeFile)
    .filter((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")).evidence?.name === repoName;
      } catch {
        return false;
      }
    })
    .sort();
  return files.at(-1) ?? null;
}

console.log("rubric 影响分析：以当前本体重评三个样例……\n");
const after = {};
for (const name of SAMPLES) {
  after[name] = await runEvaluation({
    repoPath: path.join(ROOT, "samples", name),
    packDir: PACK,
    providerKind: "mock",
    outDir: OUT,
  });
}

let anyChange = false;
for (const name of SAMPLES) {
  const r = after[name];
  const prevFile = latestReportFor(name, `${r.createdAt.replace(/[:.]/g, "-")}_${name}_mock.json`);
  console.log(`== ${name} ==  新报告 rubric ${r.pack.contentHash}`);
  if (!prevFile) {
    console.log("   （无历史报告可对比）\n");
    continue;
  }
  const prev = JSON.parse(fs.readFileSync(path.join(OUT, prevFile), "utf8"));
  if (prev.pack.contentHash === r.pack.contentHash) {
    console.log(`   本体未变化（${r.pack.contentHash}），无影响。\n`);
    continue;
  }
  const before = new Map(prev.effective.map((e) => [e.skillId, e.effectiveLevel]));
  const afterMap = new Map(r.effective.map((e) => [e.skillId, e.effectiveLevel]));
  console.log(`   对比基线 ${prevFile.slice(0, 16)}…（rubric ${prev.pack.contentHash}）`);
  for (const [id, lvl] of afterMap) {
    const old = before.get(id) ?? 0;
    if (old !== lvl) {
      anyChange = true;
      console.log(`   ${id.padEnd(20)} L${old} → L${lvl}`);
    }
  }
  const litDiff = r.stats.litSkills - (prev.stats?.litSkills ?? 0);
  console.log(`   点亮合计 ${prev.stats?.litSkills ?? "?"} → ${r.stats.litSkills}（${litDiff >= 0 ? "+" : ""}${litDiff}）\n`);
}

console.log(
  anyChange
    ? "⚠ 存在等级变化：请在 PR 描述中附上本输出，并按 docs/DESIGN.zh.md §5.3 判断版本号级别（MINOR/MAJOR）。"
    : "✔ 样例结论无变化：可按 PATCH 处理。",
);
