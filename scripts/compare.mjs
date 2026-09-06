#!/usr/bin/env node
/**
 * 报告对比工具：
 *   node scripts/compare.mjs                 # mock vs deepseek 并排（同仓库最新一轮）
 *   node scripts/compare.mjs --variance      # 同 provider 同仓库多次运行的等级方差
 */
import fs from "node:fs";
import path from "node:path";

const reportsDir = path.resolve(process.argv[1] ? path.dirname(process.argv[1]) : ".", "reports");
const dir = fs.existsSync("reports") ? "reports" : reportsDir;

const reports = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      return { file: f, ...r };
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const byNameProvider = new Map();
for (const r of reports) {
  const key = `${r.evidence.name}::${r.model.provider}`;
  const list = byNameProvider.get(key) ?? [];
  list.push(r);
  byNameProvider.set(key, list);
}

const skillOrder = new Map();
let idx = 0;
for (const r of reports) {
  for (const e of r.effective) {
    if (!skillOrder.has(e.skillId)) skillOrder.set(e.skillId, idx++);
  }
}

if (process.argv.includes("--variance")) {
  for (const [key, list] of byNameProvider) {
    if (list.length < 2) continue;
    console.log(`\n== 方差 ${key}（${list.length} 次）==`);
    const runs = list.slice(-5);
    const flips = new Map();
    for (const r of runs) {
      for (const e of r.effective) {
        const arr = flips.get(e.skillId) ?? [];
        arr.push(e.effectiveLevel);
        flips.set(e.skillId, arr);
      }
    }
    let unstable = 0;
    for (const [skill, levels] of [...flips].sort((a, b) => skillOrder.get(a[0]) - skillOrder.get(b[0]))) {
      if (new Set(levels).size > 1) {
        unstable++;
        console.log(`  ${skill.padEnd(20)} ${levels.join(" → ")}`);
      }
    }
    const perRun = runs.map((r) => `${r.stats.litSkills}/${r.stats.totalSkills}`);
    console.log(`  每次点亮: ${perRun.join(", ")}；波动技能 ${unstable} 个`);
  }
  process.exit(0);
}

// 并排：每个仓库名取各 provider 最新一份
const names = [...new Set(reports.map((r) => r.evidence.name))];
for (const name of names) {
  const mock = (byNameProvider.get(`${name}::mock`) ?? []).at(-1);
  const ds = (byNameProvider.get(`${name}::deepseek`) ?? []).at(-1);
  if (!mock || !ds) continue;
  console.log(`\n== ${name} ==`);
  console.log(`  mock     : ${mock.stats.litSkills}/${mock.stats.totalSkills} 点亮, 风险 ${mock.redteam.overallRisk}, 仲裁调整 ${mock.arbitration.adjustments.length}`);
  console.log(`  deepseek : ${ds.stats.litSkills}/${ds.stats.totalSkills} 点亮, 风险 ${ds.redteam.overallRisk}, 仲裁调整 ${ds.arbitration.adjustments.length}`);
  const m = new Map(mock.effective.map((e) => [e.skillId, e.effectiveLevel]));
  const d = new Map(ds.effective.map((e) => [e.skillId, e.effectiveLevel]));
  const rows = [...skillOrder.keys()].filter((id) => m.get(id) !== undefined || d.get(id) !== undefined);
  const bothLit = rows.filter((id) => (m.get(id) ?? 0) > 0 && (d.get(id) ?? 0) > 0).length;
  const onlyMock = rows.filter((id) => (m.get(id) ?? 0) > 0 && (d.get(id) ?? 0) === 0);
  const onlyDs = rows.filter((id) => (m.get(id) ?? 0) === 0 && (d.get(id) ?? 0) > 0);
  console.log(`  双方都点亮 ${bothLit}；仅 mock ${onlyMock.length}（${onlyMock.slice(0, 6).join("、")}）；仅 deepseek ${onlyDs.length}（${onlyDs.slice(0, 6).join("、")}）`);
  const levelDiff = rows.filter((id) => (m.get(id) ?? 0) !== (d.get(id) ?? 0));
  console.log(`  等级不同 ${levelDiff.length} 项（节选）:`);
  for (const id of levelDiff.slice(0, 12)) {
    console.log(`    ${id.padEnd(18)} mock L${m.get(id)} | deepseek L${d.get(id)}`);
  }
}
