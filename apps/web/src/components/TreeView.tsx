import { useMemo, useState } from "react";
import type { VM, SkillVM } from "../model";
import { shownStatus } from "../model";
import { computeLayout, NODE_H, COL_W } from "../layout";

interface Props {
  vm: VM;
  selected: string | null;
  onSelect: (id: string) => void;
  onDblClick?: (id: string) => void;
  focusSet?: Set<string> | null;
  /** 回放期间未显现的已点亮技能按未点亮渲染；null = 全部呈现 */
  revealSet?: Set<string> | null;
}

/** 科技树视图：单行轻节点。点亮靠低饱和着色与彩色等级点，未点亮退为纯文字。
 *  连线三级渐进披露：通向已点亮目标 0.38 / 通向未点亮目标 0.15 / 前置未达 0.03。
 *  聚焦模式：双击节点后，非依赖闭包内的节点与连线淡出。 */
export default function TreeView({ vm, selected, onSelect, onDblClick, focusSet, revealSet }: Props) {
  const layout = useMemo(() => computeLayout(vm), [vm]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const focusId = hoverId ?? selected;

  return (
    <div className="view-scroll">
      <svg width={layout.width} height={layout.height} className="tree-svg" role="img" aria-label="科技树视图">
        {layout.edges.map((e, i) => {
          const x1 = e.from.x + COL_W / 2;
          const y1 = e.from.y + NODE_H;
          const x2 = e.to.x + COL_W / 2;
          const y2 = e.to.y;
          const fromShown = !revealSet || revealSet.has(e.from.vm.skill.id);
          const toShown = !revealSet || revealSet.has(e.to.vm.skill.id);
          const active = e.from.vm.effective >= e.minLevel && fromShown;
          const targetLit = e.to.vm.effective > 0 && toShown;
          const related = focusId === e.to.vm.skill.id || focusId === e.from.vm.skill.id;
          const inClosure =
            !focusSet || (focusSet.has(e.from.vm.skill.id) && focusSet.has(e.to.vm.skill.id));
          const cls =
            !inClosure || !active
              ? "edge edge-faded"
              : related
                ? "edge edge-focus"
                : targetLit
                  ? "edge edge-active"
                  : "edge edge-weak";
          return (
            <path
              key={`e${i}`}
              className={cls}
              d={`M ${x1} ${y1} C ${x1} ${y1 + 20}, ${x2} ${y2 - 20}, ${x2} ${y2}`}
              style={active && targetLit ? { stroke: e.to.vm.branch.color } : undefined}
            />
          );
        })}

        {layout.headers.map((h) => (
          <g key={h.branchId}>
            <circle cx={h.x + 6} cy={20} r={4} fill={h.color} opacity={0.85} />
            <text x={h.x + 16} y={24} className="branch-name">
              {h.name}
            </text>
            <text x={h.x + COL_W} y={24} className="branch-count" textAnchor="end">
              {h.lit}/{h.total}
            </text>
          </g>
        ))}

        {layout.nodes.map((n, i) => (
          <Node
            key={n.vm.skill.id}
            pos={n}
            delay={i * 14}
            selected={selected === n.vm.skill.id}
            faded={Boolean(focusSet && !focusSet.has(n.vm.skill.id))}
            revealSet={revealSet}
            onSelect={onSelect}
            onDblClick={onDblClick}
            onHover={setHoverId}
          />
        ))}
      </svg>
    </div>
  );
}

function Node({
  pos,
  delay,
  selected,
  faded,
  revealSet,
  onSelect,
  onDblClick,
  onHover,
}: {
  pos: { vm: SkillVM; x: number; y: number };
  delay: number;
  selected: boolean;
  faded: boolean;
  revealSet?: Set<string> | null;
  onSelect: (id: string) => void;
  onDblClick?: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { vm, x, y } = pos;
  const status = shownStatus(vm, revealSet ?? null);
  const color = vm.branch.color;
  const levels = vm.skill.levels.length;
  const cls = `node node-${status}${selected ? " node-selected" : ""}${faded ? " node-faded" : ""}`;
  const label =
    status === "lit" ? `${vm.skill.name} · L${vm.effective}` : status === "blocked" ? `${vm.skill.name} · 待前置` : vm.skill.name;
  // hover 预览：等级/置信度/最近一条证据（原生 title，零依赖）
  const hover = [
    `${vm.skill.name}（${vm.branch.name}）`,
    status === "lit"
      ? `已点亮 L${vm.effective}${vm.assessed !== vm.effective ? `（评估 L${vm.assessed}，前置封顶）` : ""}`
      : status === "blocked"
        ? `前置阻塞（评估 L${vm.assessed}）`
        : vm.assessed > 0
          ? `未点亮（评估 L${vm.assessed}）`
          : "未点亮（无证据）",
    vm.rationale ? vm.rationale.slice(0, 80) : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <g
      className={cls}
      transform={`translate(${x}, ${y})`}
      style={{ ["--c" as string]: color, ["--d" as string]: `${delay}ms` }}
      onClick={() => onSelect(vm.skill.id)}
      onDoubleClick={() => onDblClick?.(vm.skill.id)}
      onMouseEnter={() => onHover(vm.skill.id)}
      onMouseLeave={() => onHover(null)}
    >
      <title>{hover}</title>
      <rect width={COL_W} height={NODE_H} rx={9} className="node-box" />
      {status !== "lit" && (
        /* 文字挖空：透明节点时代替旧版实底，避免跨列连线穿过文字 */
        <rect x={8} y={NODE_H / 2 - 10} width={COL_W - 54} height={20} className="node-knockout" />
      )}
      <text x={14} y={NODE_H / 2 + 4} className="node-name">
        {fitName(vm.skill.name, 8)}
      </text>
      <g transform={`translate(${COL_W - 13 - levels * 10}, ${NODE_H / 2})`}>
        {Array.from({ length: levels }, (_, i) => (
          <circle
            key={i}
            cx={i * 10 + 3}
            cy={0}
            r={2.6}
            className={
              status === "lit" && i < vm.effective
                ? "pip-on"
                : status === "blocked" && i < vm.assessed
                  ? "pip-wait"
                  : "pip"
            }
          />
        ))}
      </g>
    </g>
  );
}

/** 超长技能名截断（完整名在 title 提示与详情侧栏中） */
function fitName(name: string, max: number): string {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}
