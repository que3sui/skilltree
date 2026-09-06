#!/usr/bin/env node
/**
 * 本体共建助手：让 LLM 参与技能节点的设计（起草），人负责立法（审阅 + PR）。
 *
 * 定位：LLM 只产出「PR-ready 草稿」——它会读到现有技能图（分支/技能/等级语义），
 * 在此约束下起草一个新节点（行为化 rubric、前置只能引用现有技能 id），
 * 草稿经 zod schema 严格校验后输出 YAML；是否采纳由人决定，进仓库走 PR。
 *
 * 运行（需真实模型通道；key 一律走环境变量，绝不入库）：
 *   USTC_API_KEY=sk-... pnpm suggest-skill --provider ustc --name 递归 --branch algo
 *   DEEPSEEK_API_KEY=sk-... pnpm suggest-skill --provider deepseek --name 递归 --branch algo --tier 1 --out drafts/recursion.yaml
 */
import fs from "node:fs";
import path from "node:path";
import { createProvider, loadPack, extractJson } from "../packages/evaluator/src/index.js";
import { SkillSchema } from "../packages/schema/src/index.js";

const ROOT = path.resolve(import.meta.dirname, "..");

function parseArgs(argv) {
  const get = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    provider: get("--provider", "ustc"),
    pack: get("--pack", path.join(ROOT, "ontology", "packs", "cs")),
    name: get("--name", ""),
    branch: get("--branch", ""),
    tier: get("--tier", ""),
    out: get("--out", ""),
  };
}

/** JSON.stringify 的字符串是合法 YAML 双引号标量——直接借力做安全转义 */
const q = (s) => JSON.stringify(String(s));

function toYaml(skill) {
  const lines = [];
  lines.push(`  - id: ${q(skill.id)}`);
  lines.push(`    name: ${q(skill.name)}`);
  lines.push(`    summary: ${q(skill.summary)}`);
  lines.push(`    keywords:`);
  for (const k of skill.keywords) lines.push(`      - ${q(k)}`);
  lines.push(`    tier: ${skill.tier}`);
  if (skill.prereqs.length > 0) {
    lines.push(`    prereqs:`);
    for (const p of skill.prereqs) lines.push(`      - skill: ${q(p.skill)}\n        minLevel: ${p.minLevel}`);
  } else {
    lines.push(`    prereqs: []`);
  }
  lines.push(`    levels:`);
  for (const ls of skill.levels) {
    lines.push(`      - level: ${ls.level}`);
    lines.push(`        criteria:`);
    for (const c of ls.criteria) lines.push(`          - ${q(c)}`);
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name || !args.branch) {
    console.error("用法：pnpm suggest-skill --provider ustc --name <技能名> --branch <分支id> [--tier 0-6] [--out 草稿.yaml]");
    process.exit(1);
  }
  if (args.provider === "mock") {
    console.error("起草需要真实模型通道（ustc / deepseek）；mock 是确定性规则，不适用。");
    process.exit(1);
  }

  const loaded = loadPack(args.pack);
  const pack = loaded.pack;
  const branch = pack.branches.find((b) => b.id === args.branch);
  if (!branch) {
    console.error(`分支不存在：${args.branch}。可选：${pack.branches.map((b) => b.id).join(", ")}`);
    process.exit(1);
  }
  const existing = pack.branches.flatMap((b) =>
    b.skills.map((s) => ({ id: s.id, name: s.name, tier: s.tier, maxLevel: Math.max(...s.levels.map((l) => l.level)) })),
  );
  const levelSemantics = pack.levelSemantics.map((l) => `L${l.level} ${l.title}：${l.description}`).join("\n");

  const system = [
    "你是技能本体（rubric）设计师，为一个去绩点化的能力评价体系设计技能节点。",
    "铁律：你只起草，不立法。草稿经人审阅、走 PR 合并后才成为标准。",
    "评价标准必须行为化：写成可观察、可引用项目证据（文件/行号/提交）判定的陈述，不写『了解/掌握』这类不可判定的词。",
  ].join("\n");

  const user = `[[AGENT:designer]]

## 任务
在现有技能图内，为新技能「${args.name}」起草一个节点定义，输出一个 JSON 对象（不要输出任何其他文本）。

## 等级语义（全校统一）
${levelSemantics}

## 现有技能图（分支 · 技能 id · 最高等级）
${existing.map((s) => `- ${s.id}（${s.name}，最高 L${s.maxLevel}）`).join("\n")}

## 硬约束
1. id：小写点分路径（如 ds.recursion），不得与现有 id 冲突，取一个贴切的新 id。
2. tier：${args.tier !== "" ? `指定为 ${args.tier}` : "根据前置深度自定（0-6）"}。
3. prereqs：只能从上面列出的现有技能 id 中选择（可空）；不要发明不存在的引用。
4. levels：按等级语义逐级给 2-3 条行为化 criteria；低级是模仿与认知，高级是独立应用、迁移与权衡。
5. summary：一句话说明该技能是什么；keywords：4-8 个检索关键词（中英均可）。

## 输出 JSON 结构
{"id":"...","name":"...","summary":"...","keywords":["..."],"tier":0,"prereqs":[{"skill":"现有id","minLevel":1}],"levels":[{"level":1,"criteria":["..."]}]}`;

  const provider = createProvider(args.provider);
  console.error(`模型通道：${provider.details}\n起草中（推理模型可能需要 1-3 分钟）…`);
  const res = await provider.complete({ system, user, json: true, maxTokens: 32768 });
  const draft = extractJson(res.text);

  const parsed = SkillSchema.safeParse(draft);
  if (!parsed.success) {
    console.error("草稿未通过 schema 校验：\n" + JSON.stringify(parsed.error.issues, null, 2));
    process.exit(1);
  }
  const skill = parsed.data;
  const known = new Set(existing.map((s) => s.id));
  const badRefs = skill.prereqs.filter((p) => !known.has(p.skill));
  if (badRefs.length > 0) {
    console.error(`草稿引用了不存在的技能（拒绝——LLM 不得发明引用）：${badRefs.map((p) => p.skill).join(", ")}`);
    process.exit(1);
  }

  const yaml = toYaml(skill);
  const report = [
    `# 草稿（${provider.details} 起草，待人工审阅）`,
    `# 合入方式：将下面条目追加到 ontology/packs/${path.basename(args.pack)}/branches/${branch.id}.yaml 的 skills 列表，`,
    `# 然后跑 pnpm validate 确认全图合法，再提 PR（LLM 只起草，人立法）。\n`,
    yaml,
    "",
  ].join("\n");

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, report, "utf8");
    console.error(`✓ 草稿已写入 ${args.out}（${skill.id} · ${skill.levels.length} 级 · 前置 ${skill.prereqs.length} 项）`);
  } else {
    console.log(report);
  }
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
