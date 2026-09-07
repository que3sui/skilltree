#!/usr/bin/env node
/**
 * 建木评测 CLI
 *   validate  校验技能本体
 *   run       对一份项目证据跑四 agent 评测
 */
import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { loadPack } from "./pack.js";
import { runEvaluation } from "./pipeline.js";
import { createProvider, type ProviderKind } from "./provider.js";

const c = {
  dim: (s: string): string => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string): string => `\x1b[1m${s}\x1b[0m`,
  green: (s: string): string => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string): string => `\x1b[33m${s}\x1b[0m`,
  red: (s: string): string => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string): string => `\x1b[36m${s}\x1b[0m`,
};

function usage(): void {
  console.log(`建木 SkillTree 评测器

用法：
  skilltree validate [--pack <目录>]            校验技能本体（默认 ontology/packs/cs）
  skilltree run --repo <路径> [--pack <目录>] [--provider mock|deepseek|ustc] [--out <目录>]
                                                [--skills <id,id,...>] [--base <报告.json>]
                                                专项评测：只重评指定技能并合并进基础报告
                                                （--base 省略时自动取输出目录中该仓库的最新报告）
`);
}

function cmdValidate(packDir: string): number {
  const { pack, issues } = loadPack(packDir);
  const skillCount = pack.branches.reduce((n, b) => n + b.skills.length, 0);
  console.log(c.bold(`技能包 ${pack.id} v${pack.version} · ${pack.name}`));
  for (const b of pack.branches) {
    console.log(`  ${b.name}(${b.id})：${b.skills.length} 技能  ${c.dim(b.color)}`);
  }
  console.log(c.green(`共 ${pack.branches.length} 分支 / ${skillCount} 技能，schema 与前置关系校验通过`));
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  for (const w of warnings) console.log(c.yellow(`  ⚠ ${w.message}`));
  if (errors.length > 0) {
    for (const e of errors) console.log(c.red(`  ✗ ${e.message}`));
    return 1;
  }
  return 0;
}

async function cmdRun(repo: string, packDir: string, providerKind: ProviderKind, outDir: string, skills?: string[], baseReportFile?: string): Promise<number> {
  console.log(c.cyan(`▶ 评测开始`));
  console.log(c.dim(`  证据: ${path.resolve(repo)}`));
  console.log(c.dim(`  本体: ${path.resolve(packDir)}`));
  console.log(c.dim(`  模型: ${providerKind}`));
  if (skills && skills.length > 0) console.log(c.dim(`  专项: ${skills.join(", ")}`));
  try {
    const report = await runEvaluation({
      repoPath: repo,
      packDir,
      providerKind,
      outDir,
      skills,
      baseReportFile,
      onProgress: (e) => {
        if (e.stage === "done" && e.percent === 100) lastReportPath = e.message;
        process.stdout.write(`\r\x1b[K${c.dim(`[${e.percent.toString().padStart(3)}%]`)} ${e.message}`);
      },
    });
    process.stdout.write("\n\n");

    console.log(c.bold(`评测完成 · ${report.evidence.name}`));
    console.log(c.dim(`  证据指纹 ${report.evidence.digestHash} · rubric 版本 ${report.pack.contentHash} · ${(report.stats.durationMs / 1000).toFixed(1)}s`));
    console.log("");
    for (const b of packInfo(report)) {
      const pct = b.total ? Math.round((b.lit / b.total) * 100) : 0;
      const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
      console.log(`  ${b.name.padEnd(6)} ${c.cyan(bar)} ${b.lit}/${b.total} 点亮（累计 L${b.levelSum}）`);
    }
    const blocked = report.effective.filter((e) => e.blockedBy.length > 0);
    if (blocked.length > 0) {
      console.log(c.yellow(`\n  前置阻塞 ${blocked.length} 项：${blocked.map((e) => `${e.skillId}（需 ${e.blockedBy.join("、")}）`).join("；")}`));
    }
    const flags = report.redteam.checks.filter((k) => k.verdict === "flag");
    if (flags.length > 0) {
      console.log(c.red(`  红队标记：${flags.map((f) => f.title).join("、")}（风险 ${report.redteam.overallRisk}）`));
    }
    console.log(c.green(`\n  报告已写入 ${lastReportPath}`));
    return 0;
  } catch (err) {
    process.stdout.write("\n\n");
    console.error(c.red(`✗ 评测失败：${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }
}

let lastReportPath = "";

function packInfo(report: { stats: { byBranch: Record<string, { total: number; lit: number; levelSum: number }> } }) {
  const names: Record<string, string> = {
    prog: "编程基础", ds: "数据结构", algo: "算法", net: "网络", db: "数据库", sw: "软件工程",
  };
  return Object.entries(report.stats.byBranch).map(([id, s]) => ({ id, name: names[id] ?? id, ...s }));
}

async function main(): Promise<number> {
  // pnpm 会把 "--" 原样转发进来，而 node:parseArgs 把裸 "--" 当作选项终止符，
  // 导致其后的 --repo/--provider 全部失效——先剔除
  const rawArgs = process.argv.slice(2);
  const separatorIdx = rawArgs.indexOf("--");
  const cleaned = separatorIdx === -1 ? rawArgs : rawArgs.filter((a, i) => !(a === "--" && i === separatorIdx));
  const args = parseArgs({
    args: cleaned,
    allowPositionals: true,
    options: {
      repo: { type: "string" },
      pack: { type: "string" },
      provider: { type: "string" },
      out: { type: "string" },
      skills: { type: "string" },
      base: { type: "string" },
    },
  });
  const cmd = args.positionals[0] ?? "help";
  const packDir = args.values.pack ?? "ontology/packs/cs";
  const outDir = args.values.out ?? "reports";

  if (cmd === "validate") return cmdValidate(packDir);

  if (cmd === "run") {
    const repo = args.values.repo;
    if (!repo) {
      console.error(c.red("缺少 --repo <项目路径>"));
      usage();
      return 1;
    }
    if (!fs.existsSync(repo)) {
      console.error(c.red(`证据路径不存在: ${repo}`));
      return 1;
    }
    const providerKind = (args.values.provider ?? "mock") as ProviderKind;
    if (providerKind !== "mock" && providerKind !== "deepseek" && providerKind !== "ustc") {
      console.error(c.red(`未知 provider: ${providerKind}（可选 mock | deepseek | ustc）`));
      return 1;
    }
    const skills = typeof args.values.skills === "string"
      ? args.values.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const base = typeof args.values.base === "string" ? args.values.base : undefined;
    const code = await cmdRun(repo, packDir, providerKind, outDir, skills, base);
    return code;
  }

  usage();
  return 0;
}

process.exitCode = await main();
