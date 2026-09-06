#!/usr/bin/env node
/**
 * 本体组装器：LLM 从可复用节点库选材 + 起草专业节点，组装一个学科的 skilltree 草稿。
 *
 * 分工纪律（同 suggest-skill）：LLM 只组装与起草，人审阅立法。
 * - 输入：--major 专业名 --desc 一句话定位 --courses 课程清单 --tracks 分级要求
 * - LLM 读节点库（ontology/library）+ 上述需求 → 输出分支/技能/tracks 的 JSON
 * - 脚本校验：每个技能过 SkillSchema；前置只能引用库内 id 或本次输出 id；
 *   tracks 引用的技能必须存在 → 落盘为 pack 草稿目录 → loadPack 终检
 * - 产物：ontology/packs/<id>/（pack.yaml + branches/*.yaml + tracks.yaml）
 *
 * 运行（key 走环境变量）：
 *   USTC_API_KEY=sk-... pnpm assemble-pack --provider ustc \
 *     --major 数学建模与数据科学 --id mds \
 *     --courses "数学分析,线性代数,概率统计,数据结构与算法" \
 *     --tracks "拔尖班:核心节点 L3;普通班:核心节点 L2" \
 *     --desc 用数据与模型解决实际问题的能力体系
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProvider, extractJson, loadNodeLibrary } from "../packages/evaluator/src/index.js";
import { SkillSchema } from "../packages/schema/src/index.js";
import { loadPack } from "../packages/evaluator/src/index.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIB = path.join(ROOT, "ontology", "library");

const get = (argv, flag, fallback = "") => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const q = (s) => JSON.stringify(String(s));

function skillYaml(s, indent) {
  const p = " ".repeat(indent);
  const lines = [];
  lines.push(`${p}- id: ${q(s.id)}`);
  lines.push(`${p}  name: ${q(s.name)}`);
  lines.push(`${p}  summary: ${q(s.summary)}`);
  lines.push(`${p}  keywords:`);
  for (const k of s.keywords) lines.push(`${p}    - ${q(k)}`);
  lines.push(`${p}  tier: ${s.tier}`);
  if (s.prereqs.length > 0) {
    lines.push(`${p}  prereqs:`);
    for (const pr of s.prereqs) lines.push(`${p}    - skill: ${q(pr.skill)}\n${p}      minLevel: ${pr.minLevel}`);
  } else {
    lines.push(`${p}  prereqs: []`);
  }
  lines.push(`${p}  levels:`);
  for (const ls of s.levels) {
    lines.push(`${p}    - level: ${ls.level}`);
    lines.push(`${p}      criteria:`);
    for (const c of ls.criteria) lines.push(`${p}        - ${q(c)}`);
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const providerName = get(args, "--provider", "ustc");
  const major = get(args, "--major");
  const id = get(args, "--id");
  const desc = get(args, "--desc", "");
  const courses = get(args, "--courses", "");
  const tracks = get(args, "--tracks", "");
  const syllabusPath = get(args, "--syllabus");
  const outDir = get(args, "--out");
  if (!major || !id) {
    console.error("用法：pnpm assemble-pack --provider ustc --major <专业名> --id <pack id> [--desc] [--courses] [--tracks] [--syllabus <大纲.md>] [--out <目录>]");
    process.exit(1);
  }
  if (providerName === "mock") {
    console.error("组装需要真实模型通道（ustc / deepseek）。");
    process.exit(1);
  }

  // v3：课程大纲 .md 直读——教师手头的大纲原文进提示词，LLM 按真实教学计划起草
  let syllabusText = "";
  if (syllabusPath) {
    const abs = path.resolve(process.cwd(), syllabusPath);
    const raw = fs.readFileSync(abs, "utf8");
    if (Buffer.byteLength(raw, "utf8") > 64 * 1024) throw new Error(`大纲过大（>64KB）：${syllabusPath}`);
    syllabusText = raw;
  }

  const library = loadNodeLibrary(LIB);
  const libLines = library.map((s) => `- ${s.id}（${s.name}，最高 L${Math.max(...s.levels.map((l) => l.level))}）`).join("\n");

  const system = [
    "你是技能本体（rubric）架构师，为去绩点化能力评价体系组装一个学科本体。",
    "铁律：你只组装与起草，人审阅立法。评价标准必须行为化：可观察、可引用项目证据判定。",
    "等级语义全校统一：L1 认知与模仿 / L2 独立应用 / L3 迁移与权衡。",
  ].join("\n");

  const user = `[[AGENT:assembler]]

## 任务
为「${major}」组装一个技能本体（pack），输出一个 JSON 对象（不要其他文本）。
${desc ? `定位：${desc}` : ""}

## 可复用节点库（按域分组；**复用节点必须逐字引用，不得改写其 rubric**）
${libLines}

${courses ? `## 相关课程\n${courses}` : ""}
${syllabusText ? `## 课程大纲原文（教学计划摘录，起草依据）\n<<<大纲开始>>>\n${syllabusText}\n<<<大纲结束>>>` : ""}
${tracks ? `## 分级要求（写入 tracks，把要求映射到具体节点与最低等级）\n${tracks}` : ""}

## 硬约束
1. 规模：3-4 个分支，共 16-24 个技能（复用 + 新起草）。
2. **复用**：凡库中已有合适节点，放进 reused 数组（只给 id 与归属分支），脚本会逐字抄录库内定义。
3. **新起草**：库中没有的领域节点写进 drafted（完整定义）。id 用 分支前缀.技能名（如 circuit.analysis）。
4. prereqs 只能引用库 id 或本次 drafted 的 id；全图无环；tier 0-4。
5. 每个新节点 3 级 levels，每级 2 条行为化 criteria（模仿→独立→迁移/权衡）。
6. 分支颜色 color 用 #rrggbb，同一 pack 内和谐可区分。
7. tracks：每个班型给 name/description/requirements（引用存在的技能 id + minLevel）。
${syllabusText ? "8. 若提供大纲原文：分支与技能须覆盖大纲各课程模块的核心能力点（不是课程名罗列，而是可被项目证据证明的能力）。大纲中的知识点是起草依据，不是硬性逐条映射。\n" : ""}
## 输出 JSON 结构
{"name":"...","description":"...",
"branches":[{"id":"...","name":"...","color":"#...","description":"..."}],
"reused":[{"id":"库内id","branch":"分支id"}],
"drafted":[{"branch":"分支id","id":"...","name":"...","summary":"...","keywords":["..."],"tier":0,"prereqs":[{"skill":"...","minLevel":1}],"levels":[{"level":1,"criteria":["..."]}]}],
"tracks":[{"name":"...","description":"...","requirements":[{"skill":"...","minLevel":2}]}]}`;

  const provider = createProvider(providerName);
  console.error(`模型通道：${provider.details}\n组装中（输出较大，约 2-5 分钟）…`);
  const res = await provider.complete({ system, user, json: true, maxTokens: 32768 });
  const draft = extractJson(res.text);

  // —— 校验层（LLM 输出不可信，逐项过闸）——
  if (!Array.isArray(draft.branches) || !Array.isArray(draft.drafted)) {
    throw new Error("草稿结构不完整（branches/drafted 缺失）");
  }
  const reusedRaw = Array.isArray(draft.reused) ? draft.reused : [];
  const total = reusedRaw.length + draft.drafted.length;
  if (total < 8) throw new Error(`技能总数 ${total} < 8`);
  const libById = new Map(library.map((s) => [s.id, s]));
  const branchIds = new Set(draft.branches.map((b) => b.id));
  if (branchIds.size !== draft.branches.length) throw new Error("存在重复分支 id");

  // 复用节点：逐字取库内定义，挂到 LLM 指定的分支
  const reused = reusedRaw.map((r) => {
    const node = libById.get(String(r?.id));
    if (!node) throw new Error(`reused 引用了库外 id：${r?.id}（拒绝——不得发明引用）`);
    if (!branchIds.has(String(r?.branch))) throw new Error(`reused ${r.id} 挂在不存在的分支 ${r?.branch}`);
    return { node, branch: String(r.branch) };
  });

  // 新起草节点：完整 schema 校验 + 前置白名单（库 id ∪ 本次 drafted id）
  const draftedIds = new Set(draft.drafted.map((s) => String(s?.id)));
  if (draftedIds.size !== draft.drafted.length) throw new Error("drafted 存在重复 id");
  for (const id of draftedIds) if (libById.has(id)) throw new Error(`drafted id ${id} 与库冲突（应走 reused）`);
  const known = new Set([...libById.keys(), ...draftedIds]);
  const drafted = draft.drafted.map((raw) => {
    const parsed = SkillSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`节点 ${raw?.id} 未过 schema：${JSON.stringify(parsed.error.issues[0]?.message)}`);
    if (!branchIds.has(String(raw.branch))) throw new Error(`drafted ${raw.id} 挂在不存在的分支 ${raw.branch}`);
    return { node: parsed.data, branch: String(raw.branch) };
  });
  for (const { node } of drafted) {
    for (const pr of node.prereqs) {
      if (!known.has(pr.skill)) throw new Error(`节点 ${node.id} 引用了不存在的前置 ${pr.skill}`);
    }
  }
  const allSkills = [...reused.map((r) => r.node), ...drafted.map((d) => d.node)];

  // —— 落盘为 pack 草稿目录（--out 可重定向，如 ontology/drafts/<id>，避免覆盖已立法 pack）——
  const packDir = outDir ? path.resolve(process.cwd(), outDir) : path.join(ROOT, "ontology", "packs", id);
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(packDir, "branches"), { recursive: true });

  fs.writeFileSync(
    path.join(packDir, "pack.yaml"),
    [
      `# ${major} · 本体草稿（${provider.details} 组装，待人工审阅后 PR 立法）`,
      `# 组装输入：${courses || "专业定位"}${syllabusPath ? `；课程大纲：${path.basename(syllabusPath)}` : ""}${tracks ? "；分级：" + tracks : ""}`,
      "",
      "schemaVersion: 1",
      `id: ${q(id)}`,
      `name: ${q(major)}`,
      'version: "0.1.0"',
      `description: ${q(draft.description ?? "")}`,
      "levelSemantics:",
      "  - {level: 1, title: 认知与模仿, description: 读懂既有实现，在指导下修改与套用}",
      "  - {level: 2, title: 独立应用, description: 面对新问题独立写出正确实现，处理边界情况}",
      "  - {level: 3, title: 迁移与权衡, description: 跨场景迁移，论证方案取舍，评估风险}",
      "",
    ].join("\n"),
    "utf8",
  );

  for (const b of draft.branches) {
    const inBranch = [...reused, ...drafted].filter((x) => x.branch === b.id).map((x) => x.node);
    if (inBranch.length === 0) continue;
    fs.writeFileSync(
      path.join(packDir, "branches", `${b.id}.yaml`),
      ["branch:", `  id: ${q(b.id)}`, `  name: ${q(b.name)}`, `  color: ${q(b.color)}`, `  description: ${q(b.description ?? "")}`, "  skills:", ...inBranch.map((s) => skillYaml(s, 4)), ""].join("\n"),
      "utf8",
    );
  }

  // —— 分级要求（tracks）：独立文件，加载器不解析、人审后生效 ——
  if (Array.isArray(draft.tracks) && draft.tracks.length > 0) {
    const knownIds = new Set(allSkills.map((s) => s.id));
    const validTracks = draft.tracks
      .map((t) => ({
        name: String(t.name ?? ""),
        description: String(t.description ?? ""),
        requirements: (t.requirements ?? []).filter((r) => knownIds.has(String(r.skill))),
      }))
      .filter((t) => t.requirements.length > 0);
    const lines = [`# ${major} · 分级要求（班型 → 节点最低等级）——LLM 组装草稿，待课程教师审阅`];
    for (const t of validTracks) {
      lines.push(`- 班型: ${q(t.name)}  # ${t.description}`);
      for (const r of t.requirements) lines.push(`  - {skill: ${q(r.skill)}, minLevel: ${r.minLevel}}`);
    }
    fs.writeFileSync(path.join(packDir, "tracks.yaml"), lines.join("\n") + "\n", "utf8");
  }

  // —— 组装报告：复用/新起草清单 + 图规模，供人工审阅 ——
  const edgeCount = allSkills.reduce((n, s) => n + s.prereqs.length, 0);
  const asm = [
    `# 组装报告 · ${major}（${id}）`,
    "",
    `- 模型：${provider.details}`,
    `- 输入：${courses || "（仅专业定位）"}${syllabusPath ? `；课程大纲 ${path.basename(syllabusPath)}` : ""}${tracks ? "；分级：" + tracks : ""}`,
    `- 分支：${draft.branches.map((b) => b.id).join(", ")}`,
    `- 技能：${allSkills.length}（复用库原子 ${reused.length} + 新起草 ${drafted.length}）；前置边 ${edgeCount}`,
    "",
    "## 复用的库原子（逐字抄录，rubric 与库一致）",
    ...reused.map((r) => `- ${r.node.id}（${r.node.name}）→ ${r.branch}`),
    "",
    "## 新起草节点（LLM 起草，待人工逐条审阅）",
    ...drafted.map((d) => `- ${d.node.id}（${d.node.name}）→ ${d.branch}；前置 ${d.node.prereqs.map((p) => p.skill + "@L" + p.minLevel).join(", ") || "无"}`),
    "",
    "> 分工纪律：LLM 只组装与起草，人审阅立法。合入走 PR。",
  ];
  fs.writeFileSync(path.join(packDir, "ASSEMBLY.md"), asm.join("\n") + "\n", "utf8");

  // —— 终检：草稿必须直接可加载 ——
  const loaded = loadPack(packDir);
  console.error(`✓ 组装完成：${id}（${loaded.pack.branches.length} 分支 / ${loaded.pack.branches.reduce((n, b) => n + b.skills.length, 0)} 技能，loadPack 通过）`);
  console.error(`  位置：${path.relative(process.cwd(), packDir) || packDir}/（含 tracks.yaml 分级草稿${outDir ? "；草稿目录，未被 /api/packs 扫描" : ""}）`);
  console.error(`  下一步：人工审阅 rubric → pnpm validate → PR 立法`);
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
