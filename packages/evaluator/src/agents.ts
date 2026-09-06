/**
 * 四个评测 agent：勘察(surveyor) → 取证(assessor) → 红队(redteam) → 仲裁(arbiter)。
 * 每个 agent 都是"提示词进 → 结构化裁决出"的纯函数，模型可替换（真实模型 / mock 规则）。
 * 结构化结果的骨架（如 criteria 条目文本）始终由本体回填，模型只填裁决——防止提示词注入伪造标准。
 */
import {
  SurveySchema,
  type Assessment,
  type CriterionVerdict,
  type RedTeamCheck,
  type SkillPack,
  type Survey,
  type Branch,
} from "@skilltree/schema";
import type { Digest } from "./digest.js";
import type { ModelProvider } from "./provider.js";
import {
  buildArbiterPrompt,
  buildAssessorPrompt,
  buildRedTeamPrompt,
  buildSurveyorPrompt,
} from "./prompts.js";

// ---------------------------------------------------------------------------
// JSON 解析（容忍 markdown 围栏与前后噪声）
// ---------------------------------------------------------------------------

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("模型输出中未找到 JSON 对象");
  return JSON.parse(raw.slice(start, end + 1));
}

async function completeJson(
  provider: ModelProvider,
  prompt: { system: string; user: string },
  maxTokens = 16384,
): Promise<unknown> {
  try {
    const res = await provider.complete({ ...prompt, json: true, maxTokens });
    return extractJson(res.text);
  } catch (err) {
    // 一次自修复重试：把解析错误喂回去
    const msg = err instanceof Error ? err.message : String(err);
    const res = await provider.complete({
      ...prompt,
      json: true,
      maxTokens,
      user: `${prompt.user}\n\n注意：上次输出解析失败（${msg}）。请只输出一个合法 JSON 对象。`,
    });
    return extractJson(res.text);
  }
}

// ---------------------------------------------------------------------------
// surveyor
// ---------------------------------------------------------------------------

export function heuristicSurvey(digest: Digest): Survey {
  const languages: Record<string, number> = {};
  for (const f of digest.files) {
    const ext = f.path.includes(".") ? f.path.slice(f.path.lastIndexOf(".") + 1).toLowerCase() : "other";
    languages[ext] = (languages[ext] ?? 0) + 1;
  }
  return {
    summary: `${digest.name}：${digest.fileCount} 个文件、约 ${digest.totalLines} 行（启发式勘察）。`,
    languages,
    entryPoints: [],
    buildCommands: [],
    testCommands: [],
    observations: [],
  };
}

export async function runSurveyor(provider: ModelProvider, digest: Digest): Promise<Survey> {
  const parsed = SurveySchema.safeParse(await completeJson(provider, buildSurveyorPrompt(digest)));
  return parsed.success ? parsed.data : heuristicSurvey(digest);
}

// ---------------------------------------------------------------------------
// assessor
// ---------------------------------------------------------------------------

interface RawCriterion {
  verdict?: string;
  citations?: { file?: string; lines?: string; note?: string }[];
  comment?: string;
}

const VERDICTS = new Set(["met", "partial", "unmet", "not-evidenced"]);

function coerceAssessment(
  skill: Skill,
  raw: { level?: unknown; confidence?: unknown; rationale?: unknown; criteria?: RawCriterion[] },
): Assessment {
  const maxLevel = skill.levels.length;
  let level = Math.trunc(Number(raw.level ?? 0));
  if (!Number.isFinite(level)) level = 0;
  level = Math.max(0, Math.min(maxLevel, level));
  let confidence = Number(raw.confidence ?? 0.5);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  const flat = skill.levels.flatMap((ls) => ls.criteria.map((text) => ({ level: ls.level, text })));
  const criteria: CriterionVerdict[] = flat.map((spec, i) => {
    const rc = raw.criteria?.[i];
    const verdict = rc && rc.verdict && VERDICTS.has(rc.verdict)
      ? rc.verdict
      : level >= spec.level
        ? "met"
        : level > 0
          ? "partial"
          : "not-evidenced";
    const citations = (rc?.citations ?? [])
      .filter((c) => typeof c?.file === "string" && c.file.length > 0)
      .slice(0, 4)
      .map((c) => ({ file: c.file as string, lines: typeof c.lines === "string" ? c.lines : undefined, note: typeof c.note === "string" ? c.note : "" }));
    return {
      text: spec.text,
      verdict: verdict as CriterionVerdict["verdict"],
      citations,
      comment: typeof rc?.comment === "string" ? rc.comment : "",
    };
  });

  return {
    skillId: skill.id,
    level,
    confidence: Number(confidence.toFixed(2)),
    criteria,
    rationale: typeof raw.rationale === "string" ? raw.rationale : "",
  };
}

export async function runAssessor(
  provider: ModelProvider,
  pack: SkillPack,
  digest: Digest,
  onBranch?: (branch: Branch, index: number, total: number) => void,
): Promise<Assessment[]> {
  const out: Assessment[] = [];
  const branches = pack.branches;
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i]!;
    onBranch?.(branch, i + 1, branches.length);
    // 取证输出含大量 criteria JSON，且 v4 系模型的推理 token 计入 max_tokens，放宽预算
    const raw = (await completeJson(provider, buildAssessorPrompt(pack, branch, digest), 32768)) as {
      assessments?: { skillId?: unknown; level?: unknown; confidence?: unknown; rationale?: unknown; criteria?: RawCriterion[] }[];
    };
    const byId = new Map(branch.skills.map((s) => [s.id, s]));
    for (const a of raw.assessments ?? []) {
      const skill = byId.get(typeof a.skillId === "string" ? a.skillId : "");
      if (skill) out.push(coerceAssessment(skill, a));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// redteam
// ---------------------------------------------------------------------------

export interface RedTeamResult {
  checks: RedTeamCheck[];
  overallRisk: "low" | "medium" | "high";
}

export async function runRedTeam(
  provider: ModelProvider,
  digest: Digest,
  survey: Survey,
  assessments: Assessment[],
): Promise<RedTeamResult> {
  const lit = assessments.filter((a) => a.level > 0);
  const levelSummary = lit.length
    ? lit.map((a) => `${a.skillId}=L${a.level}`).join("、")
    : "全部技能均未点亮";
  const raw = (await completeJson(provider, {
    ...buildRedTeamPrompt(digest, survey.summary, levelSummary),
  })) as { checks?: { name?: unknown; title?: unknown; verdict?: unknown; detail?: unknown }[]; overallRisk?: unknown };

  const allowed = new Set(["pass", "warn", "flag", "unknown"]);
  const checks: RedTeamCheck[] = (raw.checks ?? [])
    .filter((c) => typeof c.name === "string")
    .map((c) => ({
      name: c.name as string,
      title: typeof c.title === "string" ? c.title : (c.name as string),
      verdict: (typeof c.verdict === "string" && allowed.has(c.verdict) ? c.verdict : "unknown") as RedTeamCheck["verdict"],
      detail: typeof c.detail === "string" ? c.detail : "",
    }));
  const risk = raw.overallRisk === "high" ? "high" : raw.overallRisk === "medium" ? "medium" : "low";
  return { checks, overallRisk: risk };
}

// ---------------------------------------------------------------------------
// arbiter
// ---------------------------------------------------------------------------

export interface Arbitration {
  adjustments: { skillId: string; from: number; to: number; reason: string }[];
  notes: string;
}

/** 仲裁输入：每个技能的等级 + 其引用的证据文件（供红队联动降级） */
export interface ArbiterAssessment {
  skillId: string;
  level: number;
  citedFiles: string[];
}

export async function runArbiter(
  provider: ModelProvider,
  pack: SkillPack,
  assessments: Assessment[],
  redteam: RedTeamResult,
): Promise<Arbitration> {
  const levelById = new Map(assessments.map((a) => [a.skillId, a.level]));
  const raw = (await completeJson(
    provider,
    buildArbiterPrompt(pack, {
      assessments: assessments.map((a) => ({
        skillId: a.skillId,
        level: a.level,
        citedFiles: [...new Set(a.criteria.flatMap((c) => c.citations.map((x) => x.file)))].slice(0, 8),
      })),
      redteam,
    }),
  )) as { adjustments?: { skillId?: unknown; from?: unknown; to?: unknown; reason?: unknown }[]; notes?: unknown };

  const adjustments: Arbitration["adjustments"] = [];
  for (const adj of raw.adjustments ?? []) {
    const skillId = typeof adj.skillId === "string" ? adj.skillId : "";
    const from = levelById.get(skillId);
    if (from === undefined) continue; // 未知技能：丢弃
    const to = Math.max(0, Math.min(5, Math.trunc(Number(adj.to ?? from))));
    if (!Number.isFinite(to) || to === from) continue;
    adjustments.push({ skillId, from, to, reason: typeof adj.reason === "string" ? adj.reason : "" });
  }
  return { adjustments, notes: typeof raw.notes === "string" ? raw.notes : "" };
}
