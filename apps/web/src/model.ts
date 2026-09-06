/**
 * 视图模型：把"技能本体 + 评测报告"组装成界面可直接渲染的结构。
 * 状态判定口径（与 schema.applyPrereqCaps 一致）：
 *   lit     effective > 0
 *   blocked 评估 > 0 但被前置约束压到 0
 *   dim     评估为 0（证据不足，未点亮）
 */
import type { Branch, CriterionVerdict, Report, Skill, SkillPack } from "@skilltree/schema";

export interface SkillVM {
  skill: Skill;
  branch: Branch;
  assessed: number;
  effective: number;
  blockedBy: string[];
  confidence: number;
  criteria: CriterionVerdict[];
  rationale: string;
  adjustment?: { from: number; to: number; reason: string };
}

export type SkillStatus = "lit" | "blocked" | "dim";

export function skillStatus(vm: SkillVM): SkillStatus {
  if (vm.effective > 0) return "lit";
  if (vm.assessed > 0 && vm.blockedBy.length > 0) return "blocked";
  return "dim";
}

/** 回放期间的呈现状态：已点亮的技能在显现前先按"未点亮"渲染 */
export function shownStatus(vm: SkillVM, revealed: Set<string> | null): SkillStatus {
  const s = skillStatus(vm);
  if (s === "lit" && revealed && !revealed.has(vm.skill.id)) return "dim";
  return s;
}

export interface VM {
  byId: Map<string, SkillVM>;
  items: SkillVM[];
  branches: Branch[];
  maxTier: number;
  lit: number;
  total: number;
}

export function buildVM(pack: SkillPack, report: Report | null): VM {
  const assessmentById = new Map((report?.assessments ?? []).map((a) => [a.skillId, a]));
  const effectiveById = new Map((report?.effective ?? []).map((e) => [e.skillId, e]));
  const adjustmentById = new Map((report?.arbitration.adjustments ?? []).map((a) => [a.skillId, a]));

  const byId = new Map<string, SkillVM>();
  const items: SkillVM[] = [];
  let maxTier = 0;
  for (const branch of pack.branches) {
    for (const skill of branch.skills) {
      maxTier = Math.max(maxTier, skill.tier);
      const a = assessmentById.get(skill.id);
      const e = effectiveById.get(skill.id);
      const vm: SkillVM = {
        skill,
        branch,
        assessed: a?.level ?? 0,
        effective: e?.effectiveLevel ?? 0,
        blockedBy: e?.blockedBy ?? [],
        confidence: a?.confidence ?? 0,
        criteria: a?.criteria ?? [],
        rationale: a?.rationale ?? "",
        adjustment: adjustmentById.get(skill.id),
      };
      byId.set(skill.id, vm);
      items.push(vm);
    }
  }
  return {
    byId,
    items,
    branches: pack.branches,
    maxTier,
    lit: items.filter((i) => i.effective > 0).length,
    total: items.length,
  };
}

export const LEVEL_TITLES: Record<number, string> = {
  1: "认知与模仿",
  2: "独立应用",
  3: "迁移与权衡",
  4: "综合创造",
  5: "领域专家",
};

/** 依赖闭包：技能的所有前置祖先 + 所有后继子孙 + 自身（Obsidian 局部图同款语义） */
export function dependencyClosure(vm: VM, id: string): Set<string> {  const prereqMap = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const it of vm.items) {
    prereqMap.set(it.skill.id, it.skill.prereqs.map((p) => p.skill));
    for (const p of it.skill.prereqs) {
      const arr = dependents.get(p.skill) ?? [];
      arr.push(it.skill.id);
      dependents.set(p.skill, arr);
    }
  }
  const out = new Set<string>([id]);
  const walkUp = (cur: string): void => {
    for (const p of prereqMap.get(cur) ?? []) {
      if (!out.has(p)) {
        out.add(p);
        walkUp(p);
      }
    }
  };
  const walkDown = (cur: string): void => {
    for (const d of dependents.get(cur) ?? []) {
      if (!out.has(d)) {
        out.add(d);
        walkDown(d);
      }
    }
  };
  walkUp(id);
  walkDown(id);
  return out;
}

/** 点亮回放的呈现次序：tier 从低到高逐层扫描，层内按分支列推进 */
export function revealOrder(vm: VM): string[] {
  const branchIndex = new Map(vm.branches.map((b, i) => [b.id, i]));
  return vm.items
    .filter((i) => i.effective > 0)
    .sort(
      (a, b) =>
        a.skill.tier - b.skill.tier ||
        (branchIndex.get(a.branch.id) ?? 0) - (branchIndex.get(b.branch.id) ?? 0) ||
        a.skill.id.localeCompare(b.skill.id),
    )
    .map((i) => i.skill.id);
}
