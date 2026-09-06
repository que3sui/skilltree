/**
 * 建木 SkillTree —— 共享领域模型
 *
 * 三个核心概念：
 *  1. SkillPack（技能本体）：社区共建、版本化的技能定义 + 分级 rubric
 *  2. EvaluationReport（评测报告）：多 agent 对一份证据的裁决，全程留痕可申诉
 *  3. effective levels（有效等级）：应用前置约束后的最终点亮状态（纯函数、可复核）
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// 技能本体（ontology）
// ---------------------------------------------------------------------------

export const MAX_LEVEL = 5;

export const LevelSchema = z.number().int().min(1).max(MAX_LEVEL);
export type Level = z.infer<typeof LevelSchema>;

/** 前置要求：点亮本技能前，前置技能需先达到的最低等级 */
export const PrereqSchema = z.object({
  skill: z.string().min(1),
  minLevel: LevelSchema.default(1),
});
export type Prereq = z.infer<typeof PrereqSchema>;

/** 单等级的行为化评价标准（rubric）。标准必须写成长期可判定、可引用证据的陈述 */
export const LevelSpecSchema = z.object({
  level: LevelSchema,
  criteria: z.array(z.string().min(1)).min(1),
});
export type LevelSpec = z.infer<typeof LevelSpecSchema>;

export const SkillSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*([.][a-z0-9][a-z0-9-]*)*$/, "技能 id 需为小写点分路径，如 ds.hash"),
  name: z.string().min(1),
  /** 层级：0 最底层（无前置基础），数值越大越进阶。用于科技树布局 */
  tier: z.number().int().min(0).max(6),
  prereqs: z.array(PrereqSchema).default([]),
  summary: z.string().default(""),
  /** 检索关键词：评测勘察与证据预选时使用 */
  keywords: z.array(z.string()).default([]),
  levels: z.array(LevelSpecSchema).min(1),
});
export type Skill = z.infer<typeof SkillSchema>;

export const BranchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().default(""),
  skills: z.array(SkillSchema).min(1),
});
export type Branch = z.infer<typeof BranchSchema>;

export const LevelSemanticsSchema = z.object({
  level: LevelSchema,
  title: z.string(),
  description: z.string(),
});

/**
 * 技能包：一个学科领域的完整本体。
 * 社区维护形态 = Git 仓库目录（pack.yaml + branches/*.yaml），增删改走 PR。
 */
export const SkillPackSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().default(""),
  levelSemantics: z.array(LevelSemanticsSchema).min(1),
  branches: z.array(BranchSchema).min(1),
});
export type SkillPack = z.infer<typeof SkillPackSchema>;

// ---------------------------------------------------------------------------
// 评测报告（EvaluationReport）
// ---------------------------------------------------------------------------

export const CitationSchema = z.object({
  file: z.string(),
  lines: z.string().optional(),
  note: z.string().default(""),
});
export type Citation = z.infer<typeof CitationSchema>;

export const CriterionVerdictSchema = z.object({
  text: z.string(),
  verdict: z.enum(["met", "partial", "unmet", "not-evidenced"]),
  citations: z.array(CitationSchema).default([]),
  comment: z.string().default(""),
});
export type CriterionVerdict = z.infer<typeof CriterionVerdictSchema>;

export const AssessmentSchema = z.object({
  skillId: z.string(),
  /** 取证 agent 的裁决等级，0 表示证据不足不点亮 */
  level: z.number().int().min(0).max(MAX_LEVEL),
  confidence: z.number().min(0).max(1),
  criteria: z.array(CriterionVerdictSchema).default([]),
  rationale: z.string().default(""),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const SurveySchema = z.object({
  summary: z.string().default(""),
  languages: z.record(z.string(), z.number()).default({}),
  entryPoints: z.array(z.string()).default([]),
  buildCommands: z.array(z.string()).default([]),
  testCommands: z.array(z.string()).default([]),
  observations: z.array(z.string()).default([]),
});
export type Survey = z.infer<typeof SurveySchema>;

export const RedTeamCheckSchema = z.object({
  name: z.string(),
  title: z.string(),
  verdict: z.enum(["pass", "warn", "flag", "unknown"]),
  detail: z.string().default(""),
});
export type RedTeamCheck = z.infer<typeof RedTeamCheckSchema>;

export const EvidenceSchema = z.object({
  kind: z.literal("local-dir"),
  path: z.string(),
  name: z.string(),
  fileCount: z.number().int().min(0),
  totalLines: z.number().int().min(0),
  /** 证据内容摘要的 SHA-256（截断到摘要内容），保证同一份证据可识别、可复现 */
  digestHash: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** 仲裁调整：红队/仲裁认为取证等级需要修正时必须留痕 */
export const AdjustmentSchema = z.object({
  skillId: z.string(),
  from: z.number().int().min(0).max(MAX_LEVEL),
  to: z.number().int().min(0).max(MAX_LEVEL),
  reason: z.string().default(""),
});

export const EffectiveLevelSchema = z.object({
  skillId: z.string(),
  assessedLevel: z.number().int().min(0).max(MAX_LEVEL),
  /** 应用前置约束后的最终等级：被前置阻塞时为 0 */
  effectiveLevel: z.number().int().min(0).max(MAX_LEVEL),
  /** 因哪些前置未满足而被阻塞（记录其要求的等级） */
  blockedBy: z.array(z.string()).default([]),
});
export type EffectiveLevel = z.infer<typeof EffectiveLevelSchema>;

export const ReportSchema = z.object({
  reportVersion: z.literal(1),
  id: z.string(),
  createdAt: z.string(),
  evidence: EvidenceSchema,
  pack: z.object({
    id: z.string(),
    version: z.string(),
    /** 本体内容哈希：复现评测结果时用于锁定 rubric 版本 */
    contentHash: z.string(),
  }),
  model: z.object({
    provider: z.string(),
    details: z.string().default(""),
  }),
  survey: SurveySchema,
  assessments: z.array(AssessmentSchema).default([]),
  redteam: z.object({
    checks: z.array(RedTeamCheckSchema).default([]),
    overallRisk: z.enum(["low", "medium", "high"]),
  }),
  arbitration: z.object({
    adjustments: z.array(AdjustmentSchema).default([]),
    notes: z.string().default(""),
  }),
  effective: z.array(EffectiveLevelSchema).default([]),
  stats: z.object({
    totalSkills: z.number().int().min(0),
    litSkills: z.number().int().min(0),
    byBranch: z.record(
      z.string(),
      z.object({
        total: z.number(),
        lit: z.number(),
        levelSum: z.number(),
      }),
    ),
    durationMs: z.number().int().min(0),
  }),
});
export type Report = z.infer<typeof ReportSchema>;

// ---------------------------------------------------------------------------
// 纯函数：DAG 校验 / 前置约束 / 统计
// ---------------------------------------------------------------------------

export interface PackIssue {
  severity: "error" | "warning";
  message: string;
}

/** 校验本体一致性：前置引用存在、无环、层级合理。错误必须修复，警告仅提示 */
export function checkPack(pack: SkillPack): PackIssue[] {
  const issues: PackIssue[] = [];
  const skills = new Map<string, Skill>();
  for (const b of pack.branches) {
    for (const s of b.skills) {
      if (skills.has(s.id)) {
        issues.push({ severity: "error", message: `技能 id 重复: ${s.id}` });
      }
      skills.set(s.id, s);
    }
  }

  for (const [id, s] of skills) {
    const specLevels = s.levels.map((l) => l.level).sort((a, b) => a - b);
    for (let i = 0; i < specLevels.length; i++) {
      if (specLevels[i] !== i + 1) {
        issues.push({
          severity: "error",
          message: `${id} 的 levels 必须从 1 开始连续（当前: ${specLevels.join(",")}）`,
        });
        break;
      }
    }
    for (const p of s.prereqs) {
      const target = skills.get(p.skill);
      if (!target) {
        issues.push({ severity: "error", message: `${id} 的前置不存在: ${p.skill}` });
        continue;
      }
      if (p.skill === id) {
        issues.push({ severity: "error", message: `${id} 依赖自身` });
        continue;
      }
      if (target.tier > s.tier) {
        issues.push({
          severity: "warning",
          message: `${id} 的前置 ${p.skill} tier 更高（${target.tier} > ${s.tier}），检查层级方向`,
        });
      }
      if (!target.levels.some((l) => l.level >= p.minLevel)) {
        issues.push({
          severity: "error",
          message: `${id} 要求前置 ${p.skill} 的 L${p.minLevel}，但该技能只定义到 L${target.levels.length}`,
        });
      }
    }
  }

  // 环检测（DFS 三色标记）
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const id of skills.keys()) color.set(id, WHITE);
  const stack: string[] = [];
  const visit = (id: string): void => {
    color.set(id, GRAY);
    stack.push(id);
    for (const p of skills.get(id)!.prereqs) {
      const c = color.get(p.skill);
      if (c === GRAY) {
        const cyc = [...stack.slice(stack.indexOf(p.skill)), p.skill].join(" -> ");
        issues.push({ severity: "error", message: `前置关系成环: ${cyc}` });
      } else if (c === WHITE) {
        visit(p.skill);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  };
  for (const id of skills.keys()) if (color.get(id) === WHITE) visit(id);

  return issues;
}

/**
 * 应用前置约束，计算有效等级。
 * 规则（确定性、可复核，不经过模型）：
 *   effective(s) = 0                              若 assessed(s) 缺失或为 0
 *   effective(s) = 0（blocked）                   若存在前置 p 使 effective(p.skill) < p.minLevel
 *   effective(s) = assessed(s)                    否则
 */
export function applyPrereqCaps(
  pack: SkillPack,
  assessments: Pick<Assessment, "skillId" | "level">[],
): EffectiveLevel[] {
  const assessed = new Map<string, number>();
  for (const a of assessments) assessed.set(a.skillId, a.level);

  const allSkills: { id: string; prereqs: Prereq[] }[] = [];
  for (const b of pack.branches) for (const s of b.skills) allSkills.push(s);

  const effMemo = new Map<string, number>();
  const blockedMemo = new Map<string, string[]>();
  const inProgress = new Set<string>();

  const compute = (id: string): number => {
    if (effMemo.has(id)) return effMemo.get(id)!;
    if (inProgress.has(id)) return 0; // 环已在 checkPack 拦截，此处兜底
    inProgress.add(id);
    const skill = allSkills.find((s) => s.id === id);
    const self = assessed.get(id) ?? 0;
    let result = self;
    let blockedBy: string[] = [];
    if (self > 0 && skill) {
      for (const p of skill.prereqs) {
        const pre = compute(p.skill);
        if (pre < p.minLevel) {
          blockedBy.push(`${p.skill}@L${p.minLevel}`);
        }
      }
      if (blockedBy.length > 0) result = 0;
    }
    effMemo.set(id, result);
    blockedMemo.set(id, blockedBy);
    inProgress.delete(id);
    return result;
  };

  return allSkills.map((s) => {
    const assessedLevel = assessed.get(s.id) ?? 0;
    const effectiveLevel = compute(s.id);
    return {
      skillId: s.id,
      assessedLevel,
      effectiveLevel,
      blockedBy: effectiveLevel === 0 && assessedLevel > 0 ? (blockedMemo.get(s.id) ?? []) : [],
    };
  });
}

export interface BranchStat {
  total: number;
  lit: number;
  levelSum: number;
}

export function computeStats(
  pack: SkillPack,
  effective: EffectiveLevel[],
): Report["stats"] {
  const byId = new Map(effective.map((e) => [e.skillId, e]));
  const byBranch: Record<string, BranchStat> = {};
  let totalSkills = 0;
  let litSkills = 0;
  for (const b of pack.branches) {
    const stat: BranchStat = { total: b.skills.length, lit: 0, levelSum: 0 };
    for (const s of b.skills) {
      totalSkills++;
      const e = byId.get(s.id);
      if (e && e.effectiveLevel > 0) {
        stat.lit++;
        stat.levelSum += e.effectiveLevel;
        litSkills++;
      }
    }
    byBranch[b.id] = stat;
  }
  return { totalSkills, litSkills, byBranch, durationMs: 0 };
}
