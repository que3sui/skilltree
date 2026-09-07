/**
 * 提示词构造。设计原则：
 * - 裁决对象是"行为化 rubric 条目"，不是模糊印象；
 * - 要求逐条 verdict + 文件级引用（可溯源、可申诉）；
 * - [[AGENT:*]] / [[SKILL:*|kws]] 标记同时服务 mock 规则与真实模型（后者可忽略）。
 */
import type { Digest } from "./digest.js";
import type { SkillPack, Branch, Skill } from "@skilltree/schema";

const LEVEL_TITLES: Record<number, string> = { 1: "认知与模仿", 2: "独立应用", 3: "迁移与权衡" };

export interface Prompt {
  system: string;
  user: string;
}

function digestBlock(digest: Digest): string {
  return digest.text;
}

// ---------------------------------------------------------------------------
// surveyor
// ---------------------------------------------------------------------------

export function buildSurveyorPrompt(digest: Digest): Prompt {
  return {
    system:
      "你是代码勘察员。阅读给定的项目证据摘要，产出客观的结构化勘察报告。只描述证据中可观察到的事实，不猜测、不评价能力。输出单个 JSON 对象。",
    user: `[[AGENT:surveyor]]
以下是项目「${digest.name}」的证据摘要（部分文件可能被截断）。请勘察并输出 JSON：

{
  "summary": "2-4 句概括这个项目是什么、做到了什么程度",
  "languages": { "扩展名或语言名": 文件数 },
  "entryPoints": ["入口文件路径"],
  "buildCommands": ["如何构建/运行"],
  "testCommands": ["如何测试"],
  "observations": ["值得后续评审注意的事实，3-6 条"]
}

===== 证据摘要开始 =====
${digestBlock(digest)}
===== 证据摘要结束 =====`,
  };
}

// ---------------------------------------------------------------------------
// assessor
// ---------------------------------------------------------------------------

function skillRubric(skill: Skill): string {
  const prereqs = skill.prereqs.length
    ? skill.prereqs.map((p) => `${p.skill}@L${p.minLevel}`).join("、")
    : "无";
  const lines: string[] = [];
  lines.push(`### ${skill.id} ${skill.name}（tier ${skill.tier}；前置：${prereqs}）`);
  if (skill.summary) lines.push(`概述：${skill.summary}`);
  for (const ls of skill.levels) {
    lines.push(`- L${ls.level}（${LEVEL_TITLES[ls.level] ?? ""}）:`);
    ls.criteria.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
  }
  return lines.join("\n");
}

export function buildAssessorPrompt(pack: SkillPack, branch: Branch, digest: Digest): Prompt {
  const skills = branch.skills;
  const criteriaCount = skills.reduce((n, s) => n + s.levels.reduce((m, ls) => m + ls.criteria.length, 0), 0);
  const semantics = pack.levelSemantics.map((s) => `L${s.level} ${s.title}：${s.description}`).join("\n");
  const rubric = skills.map(skillRubric).join("\n\n");
  const index = skills.map((s) => `[[SKILL:${s.id}|${s.keywords.join("|")}]]`).join("\n");

  return {
    system:
      "你是严格的能力取证评审员。逐条对照 rubric 标准检查项目证据，给出等级裁决与文件级引用。" +
      "原则：证据不足就降级（宁低勿高）；每条裁决必须引用具体文件；未在证据中出现的标准判 not-evidenced。" +
      "输出单个 JSON 对象，不要输出 JSON 之外的任何文字。",
    user: `[[AGENT:assessor]]
评审对象：项目「${digest.name}」的证据摘要。
技能领域：${branch.name}（${branch.id}），共 ${skills.length} 个技能、${criteriaCount} 条 rubric 标准。

等级语义（全包统一）：
${semantics}

裁决规则：
- level 为 0-3 的整数，0 = 证据不足不予点亮；等级必须能在 rubric 条目中找到支撑。
- assessments 中每个技能一条记录；criteria 数组按 rubric 条目顺序平铺（该技能所有等级的全部条目），每条含 verdict（met/partial/unmet/not-evidenced）、citations（文件与说明）、comment。
- citations 的 file 必须来自证据摘要中出现的文件路径。

===== Rubric =====
${rubric}

===== 技能索引（程序可读，评审可忽略）=====
${index}

===== 证据摘要开始 =====
${digestBlock(digest)}
===== 证据摘要结束 =====

请输出：
{"assessments": [{"skillId": "...", "level": 0, "confidence": 0到1, "rationale": "一句话总评", "criteria": [{"verdict": "met", "citations": [{"file": "路径", "note": "命中说明"}], "comment": "可选"}]}]}`,
  };
}

// ---------------------------------------------------------------------------
// redteam
// ---------------------------------------------------------------------------

export function buildRedTeamPrompt(digest: Digest, surveySummary: string, levelSummary: string, scopeNote?: string): Prompt {
  return {
    system:
      "你是红队质疑员。你的职责是推翻或削弱取证结论：证据能证明是本人独立完成吗？项目真的能运行吗？" +
      "有没有复制粘贴、AI 代写、模板项目、空壳注水的嫌疑？只依据给定证据提出可核查的质疑。输出单个 JSON 对象。",
    user: `[[AGENT:redteam]]
项目「${digest.name}」证据摘要如下。

勘察结论：${surveySummary}
取证等级概览：${levelSummary}
${scopeNote ? `\n${scopeNote}\n` : ""}
请从以下方面逐项核查并输出 JSON：
{"checks": [{"name": "英文标识", "title": "中文名", "verdict": "pass|warn|flag", "detail": "依据与文件"}],
 "overallRisk": "low|medium|high"}

必查项（name 固定）：
- readme_quality：项目说明是否完整可信
- tests_present：是否存在自动化测试；其断言是否真实覆盖核心逻辑（而非摆设）
- provenance：外部来源标记、转载痕迹、与常见模板/教程项目的高度雷同
- oversized_file：单文件异常巨大、疑似整体粘贴或生成
- stub_evidence：源码是否只是占位/TODO，不足以支撑任何点亮结论
- git_history：**仅当证据含 GIT HISTORY 段时**——提交历史是否支撑"渐进完成"
  （全部提交挤在同一天=一次性倾倒；提交说明敷衍重复=疑似生成后直传；跨度与提交
  粒度合理=过程可信）。**证据中无 GIT HISTORY 段则输出 pass 并注明"无 git 历史（目录
  不含 .git），过程维度缺席，不影响其他判断"**——不要因缺席而 warn/flag。

===== 证据摘要开始 =====
${digestBlock(digest)}
===== 证据摘要结束 =====`,
  };
}

// ---------------------------------------------------------------------------
// arbiter
// ---------------------------------------------------------------------------

export interface ArbiterInput {
  assessments: { skillId: string; level: number; citedFiles: string[] }[];
  redteam: unknown;
}

export function buildArbiterPrompt(pack: SkillPack, input: ArbiterInput): Prompt {
  return {
    system:
      "你是仲裁员。综合取证结论与红队质疑做最终裁决。" +
      "规则：红队 flag 证据充分性 → 所有技能降为 0；红队 flag 文件来源 → 引用了这些文件（见 citedFiles）的技能降至 L1 并注明待人工复核；" +
      "warn 级问题不直接降级，但写入备注。只在有依据时调整，并说明理由。输出单个 JSON 对象。",
    user: `[[AGENT:arbiter]]
技能包：${pack.id} v${pack.version}
以下是取证与红队结果（JSON），assessments 中 citedFiles 为该技能裁决所依据的证据文件：

${JSON.stringify({ assessments: input.assessments, redteam: input.redteam })}

请输出：
{"adjustments": [{"skillId": "...", "from": 2, "to": 1, "reason": "理由"}], "notes": "总体备注"}`,
  };
}
