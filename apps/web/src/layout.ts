/**
 * 双视图共享布局：分支为列、tier 分节纵向流动。
 * 科技树与蜂窝网格使用同一坐标，切换视图时节点位置不跳变。
 * 密度原则：节点单行轻量化，列间距大于节点高度，让分组靠留白表达。
 */
import type { SkillVM, VM } from "./model";

export const COL_W = 152;
export const NODE_H = 36;
export const NODE_GAP = 14;
export const TIER_GAP = 30;
export const PAD_L = 24;
export const PAD_T = 56;
export const COL_GAP = 36;

export interface NodePos {
  vm: SkillVM;
  indexInBranch: number;
  x: number;
  y: number;
}

export interface Edge {
  from: NodePos;
  to: NodePos;
  minLevel: number;
}

export interface Layout {
  nodes: NodePos[];
  byId: Map<string, NodePos>;
  edges: Edge[];
  headers: { branchId: string; name: string; color: string; lit: number; total: number; x: number }[];
  width: number;
  height: number;
}

export function computeLayout(vm: VM): Layout {
  const nodes: NodePos[] = [];
  const byId = new Map<string, NodePos>();
  const edges: Edge[] = [];
  const headers: Layout["headers"] = [];
  let maxColHeight = 0;

  vm.branches.forEach((branch, bIdx) => {
    const x = PAD_L + bIdx * (COL_W + COL_GAP);
    const branchItems = vm.items.filter((i) => i.branch.id === branch.id);
    const lit = branchItems.filter((i) => i.effective > 0).length;
    headers.push({ branchId: branch.id, name: branch.name, color: branch.color, lit, total: branchItems.length, x });

    let y = PAD_T;
    let indexInBranch = 0;
    for (let tier = 0; tier <= vm.maxTier; tier++) {
      const group = branchItems.filter((i) => i.skill.tier === tier);
      if (group.length === 0) continue;
      for (const item of group) {
        const pos: NodePos = { vm: item, indexInBranch, x, y };
        nodes.push(pos);
        byId.set(item.skill.id, pos);
        indexInBranch++;
        y += NODE_H + NODE_GAP;
      }
      y += TIER_GAP - NODE_GAP;
    }
    maxColHeight = Math.max(maxColHeight, y);
  });

  for (const pos of nodes) {
    for (const p of pos.vm.skill.prereqs) {
      const src = byId.get(p.skill);
      if (src) edges.push({ from: src, to: pos, minLevel: p.minLevel });
    }
  }

  return {
    nodes,
    byId,
    edges,
    headers,
    width: PAD_L + vm.branches.length * COL_W + (vm.branches.length - 1) * COL_GAP + 24,
    height: Math.max(maxColHeight, 420),
  };
}

/** 尖顶六边形顶点（中心 cx,cy，半径 r） */
export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 180) * (60 * k);
    pts.push(`${(cx + r * Math.sin(angle)).toFixed(1)},${(cy - r * Math.cos(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}
