import { useMemo } from "react";
import type { VM, SkillVM } from "../model";
import { shownStatus } from "../model";
import { computeLayout, hexPoints, NODE_H, COL_W } from "../layout";

interface Props {
  vm: VM;
  selected: string | null;
  onSelect: (id: string) => void;
  onDblClick?: (id: string) => void;
  focusSet?: Set<string> | null;
  revealSet?: Set<string> | null;
}

const HEX_R = 17;

/** 蜂窝网格视图：版图感。六边形内不放文字（信息在悬浮提示与侧栏），点亮以纯色填充表达 */
export default function GridView({ vm, selected, onSelect, onDblClick, focusSet, revealSet }: Props) {
  const layout = useMemo(() => computeLayout(vm), [vm]);

  return (
    <div className="view-scroll">
      <svg width={layout.width} height={layout.height} className="grid-svg" role="img" aria-label="蜂窝网格视图">
        <defs>
          {layout.nodes.map((n) => {
            const { cx, cy } = hexCenter(n);
            const maxLevel = Math.max(n.vm.skill.levels.length, 1);
            const shown = shownStatus(n.vm, revealSet ?? null) === "lit";
            const frac = shown ? Math.min(1, n.vm.effective / maxLevel) : 0;
            return (
              <clipPath id={`hexclip-${n.vm.skill.id.replaceAll(".", "-")}`} key={n.vm.skill.id}>
                {/* 直接按比例计算矩形几何：clipPath 子元素上的 CSS transform 兼容性差 */}
                <rect x={cx - 30} y={cy + HEX_R - 2 * HEX_R * frac} width={60} height={2 * HEX_R * frac} />
              </clipPath>
            );
          })}
        </defs>

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
          <Hex
            key={n.vm.skill.id}
            pos={n}
            delay={i * 12}
            selected={selected === n.vm.skill.id}
            faded={Boolean(focusSet && !focusSet.has(n.vm.skill.id))}
            revealSet={revealSet}
            onSelect={onSelect}
            onDblClick={onDblClick}
          />
        ))}
      </svg>
    </div>
  );
}

function hexCenter(pos: { vm: SkillVM; x: number; y: number; indexInBranch: number }): { cx: number; cy: number } {
  const cx = pos.x + COL_W / 2 + (pos.indexInBranch % 2 === 1 ? 14 : -12);
  const cy = pos.y + NODE_H / 2 + 1;
  return { cx, cy };
}

function Hex({
  pos,
  delay,
  selected,
  faded,
  revealSet,
  onSelect,
  onDblClick,
}: {
  pos: { vm: SkillVM; x: number; y: number; indexInBranch: number };
  delay: number;
  selected: boolean;
  faded: boolean;
  revealSet?: Set<string> | null;
  onSelect: (id: string) => void;
  onDblClick?: (id: string) => void;
}) {
  const { vm } = pos;
  const status = shownStatus(vm, revealSet ?? null);
  const color = vm.branch.color;
  const { cx, cy } = hexCenter(pos);
  const pts = hexPoints(cx, cy, HEX_R);
  const clipId = `hexclip-${vm.skill.id.replaceAll(".", "-")}`;

  return (
    <g
      className={`hex hex-${status}${selected ? " hex-selected" : ""}${faded ? " hex-faded" : ""}`}
      style={{ ["--c" as string]: color, ["--d" as string]: `${delay}ms` }}
      onClick={() => onSelect(vm.skill.id)}
      onDoubleClick={() => onDblClick?.(vm.skill.id)}
    >
      <title>
        {`${vm.skill.name}（${vm.branch.name}） · ${
          status === "lit"
            ? `已点亮 L${vm.effective}（置信 ${Math.round(vm.confidence * 100)}%）`
            : status === "blocked"
              ? `前置阻塞（评估 L${vm.assessed}）`
              : vm.assessed > 0
                ? `未点亮（评估 L${vm.assessed}）`
                : "未点亮（无证据）"
        }${vm.rationale ? `\n${vm.rationale.slice(0, 80)}` : ""}`}
      </title>
      <polygon points={pts} className="hex-base" />
      <polygon points={pts} className="hex-lit" clipPath={`url(#${clipId})`} />
      {status === "blocked" && <polygon points={pts} className="hex-blocked" />}
      {status === "lit" && (
        <text x={cx} y={cy + 3} className="hex-digit" textAnchor="middle">
          {vm.effective}
        </text>
      )}
    </g>
  );
}
