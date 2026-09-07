#!/usr/bin/env node
/**
 * 证据链对账（可复现性自证）：对任意评测报告做独立复核——
 *   1. 报告能通过当前 schema 解析（字段/等级范围/枚举合法）；
 *   2. 仲裁调整确实已写回 assessments（to 与最终等级一致）；
 *   3. effective/stats 由 assessments 经纯函数（按报告所属本体）重算后逐项一致（防"改数不改链"）；
 *   4. scope 合并报告：assessments 覆盖面为全量结构、scope.skills 无重复。
 * 用法：pnpm verify:report -- <reports/xxx.json> [更多...]
 *      不带参数则对 reports/ 下全部 .json 逐份对账。退出码非 0 = 存在断链。
 */
import fs from "node:fs";
import path from "node:path";
import { applyPrereqCaps, computeStats, ReportSchema } from "../packages/schema/src/index.js";
import { loadPack } from "../packages/evaluator/src/pack.js";

const problems = [];
const packCache = new Map();

function packFor(packId) {
  if (!packCache.has(packId)) {
    const dir = path.join("ontology", "packs", packId);
    if (!fs.existsSync(dir)) throw new Error(`报告所属本体不存在: ${packId}`);
    packCache.set(packId, loadPack(dir).pack);
  }
  return packCache.get(packId);
}

function verify(file) {
  const tag = path.basename(file);
  const parsed = ReportSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.success) {
    problems.push(`${tag}：无法通过当前 schema 解析（${parsed.error.issues[0]?.message ?? "未知"}）`);
    return;
  }
  const r = parsed.data;
  const pack = packFor(r.pack.id);

  // 2) 仲裁留痕必须已写回：to = 最终等级
  for (const adj of r.arbitration.adjustments) {
    const a = r.assessments.find((x) => x.skillId === adj.skillId);
    if (!a) {
      problems.push(`${tag}：仲裁调整引用不存在的技能 ${adj.skillId}`);
      continue;
    }
    if (a.level !== adj.to) {
      problems.push(`${tag}：仲裁 ${adj.skillId} 声称降至 L${adj.to}，但 assessments.level=${a.level}`);
    }
  }

  // 3) 独立重算 effective/stats 并逐项对账（防"改数不改链"）
  const effective = applyPrereqCaps(pack, r.assessments);
  const stats = computeStats(pack, effective);
  const byIdR = new Map(r.effective.map((e) => [e.skillId, e]));
  for (const e of effective) {
    const o = byIdR.get(e.skillId);
    if (!o) {
      problems.push(`${tag}：effective 缺少 ${e.skillId}`);
      continue;
    }
    if (o.assessedLevel !== e.assessedLevel || o.effectiveLevel !== e.effectiveLevel) {
      problems.push(
        `${tag}：${e.skillId} 对账失败——报告(assessed=${o.assessedLevel},effective=${o.effectiveLevel}) vs 重算(assessed=${e.assessedLevel},effective=${e.effectiveLevel})`,
      );
    }
  }
  if (r.stats.litSkills !== stats.litSkills || r.stats.totalSkills !== stats.totalSkills) {
    problems.push(`${tag}：stats 对账失败——报告 lit ${r.stats.litSkills}/${r.stats.totalSkills} vs 重算 ${stats.litSkills}/${stats.totalSkills}`);
  }
  for (const [bid, bs] of Object.entries(stats.byBranch)) {
    const o = r.stats.byBranch[bid];
    if (!o) {
      problems.push(`${tag}：stats.byBranch 缺分支 ${bid}`);
    } else if (o.lit !== bs.lit || o.levelSum !== bs.levelSum) {
      problems.push(`${tag}：分支 ${bid} 对账失败——报告(lit=${o.lit},sum=${o.levelSum}) vs 重算(lit=${bs.lit},sum=${bs.levelSum})`);
    }
  }

  // 4) scope 合并报告的结构自洽：assessments 覆盖面应为全量结构
  if (r.scope) {
    if (r.scope.skills.length === 0) problems.push(`${tag}：scope.skills 为空`);
    if (new Set(r.scope.skills).size !== r.scope.skills.length) problems.push(`${tag}：scope.skills 有重复项`);
    const totalSkills = pack.branches.reduce((n, b) => n + b.skills.length, 0);
    if (r.assessments.length !== totalSkills) {
      problems.push(`${tag}：scope 报告 assessments ${r.assessments.length} 项 ≠ 本体 ${totalSkills} 项（合并应为全量结构）`);
    }
    if (r.evidence.digestHash.length < 8) problems.push(`${tag}：证据指纹过短，疑似缺失`);
  }
  console.log(`✓ ${tag}  对账通过（${r.pack.id} · ${r.model.provider} · ${r.stats.litSkills}/${r.stats.totalSkills}${r.scope ? " · scope 合并" : ""}）`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const files = args.length > 0 ? args : fs.readdirSync("reports").filter((f) => f.endsWith(".json")).map((f) => path.join("reports", f));
  if (files.length === 0) {
    console.log("reports/ 下没有报告可对账");
    return 0;
  }
  for (const f of files) {
    try {
      verify(path.resolve(f));
    } catch (err) {
      problems.push(`${path.basename(f)}：对账异常——${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (problems.length > 0) {
    console.error(`\n✗ 证据链断点 ${problems.length} 处：`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log(`\n全部 ${files.length} 份报告证据链对账通过（schema / 仲裁留痕 / effective / stats / scope 结构）`);
  return 0;
}

process.exitCode = await main();
