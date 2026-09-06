import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VM } from "../model";
import { shownStatus } from "../model";

interface Props {
  vm: VM;
  selected: string | null;
  onSelect: (id: string) => void;
  revealSet?: Set<string> | null;
}

/** 层叠视角的空间参数：分支卡片沿深度方向级联堆放 */
const CARD_W = 336;
const CARD_DX = 58;
const CARD_DY = -86;
const CARD_DZ = 78;
const PERSPECTIVE = 1500;
const DEFAULT_ANGLE = { rx: -7, rz: -13 };
const DEFAULT_ZOOM = 0.9;

interface DeckEdgeGeo {
  from: string;
  to: string;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 层叠视角：每个分支是一张直立卡片，在 3D 深度上级联堆放；
 * 跨分支的前置依赖只在这个视角以层间连线显现（平面图里它们是杂乱的跨列长线）。
 * 卡片始终正对视线（billboard），保证任何旋转角度下文字都清晰。
 * 连线端点直接量 DOM 的屏幕坐标——浏览器已算好 3D 投影，任何角度都精确。
 */
export default function DeckView({ vm, selected, onSelect, revealSet }: Props) {
  const [angle, setAngle] = useState(DEFAULT_ANGLE);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [hover, setHover] = useState<string | null>(null);
  const [edges, setEdges] = useState<DeckEdgeGeo[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; rx: number; rz: number; moved: boolean } | null>(null);

  // 跨分支前置关系：层叠视角的独有信息
  const crossBranch = useMemo(() => {
    const branchOf = new Map<string, string>();
    for (const b of vm.branches) {
      for (const s of b.skills) branchOf.set(s.id, b.id);
    }
    const out: { from: string; to: string; color: string }[] = [];
    for (const item of vm.items) {
      for (const p of item.skill.prereqs) {
        if (branchOf.get(p.skill) !== item.branch.id) {
          out.push({ from: p.skill, to: item.skill.id, color: item.branch.color });
        }
      }
    }
    return out;
  }, [vm]);

  const measureEdges = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const base = vp.getBoundingClientRect();
    const center = (id: string): { x: number; y: number } | null => {
      const el = vp.querySelector(`[data-skill="${CSS.escape(id)}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
    };
    const geo: DeckEdgeGeo[] = [];
    for (const e of crossBranch) {
      const a = center(e.from);
      const b = center(e.to);
      if (a && b) geo.push({ ...e, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    setEdges(geo);
  }, [crossBranch]);

  useEffect(() => {
    measureEdges();
    window.addEventListener("resize", measureEdges);
    return () => window.removeEventListener("resize", measureEdges);
  }, [measureEdges, angle, zoom, vm, selected]);

  // 拖拽旋转 / 滚轮缩放（原生监听以便对 wheel preventDefault）
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (ev: WheelEvent): void => {
      ev.preventDefault();
      setZoom((z) => clamp(z * (ev.deltaY > 0 ? 0.92 : 1.08), 0.45, 1.7));
    };
    const onMove = (ev: PointerEvent): void => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      setAngle({ rx: clamp(d.rx + dy * 0.22, -55, 55), rz: clamp(d.rz - dx * 0.22, -55, 55) });
    };
    const onUp = (): void => {
      window.setTimeout(() => {
        dragRef.current = null;
      }, 0);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      vp.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const focus = hover ?? selected;
  const mid = (vm.branches.length - 1) / 2;

  return (
    <div
      className="deck-viewport"
      ref={viewportRef}
      onPointerDown={(e) => {
        dragRef.current = { x: e.clientX, y: e.clientY, rx: angle.rx, rz: angle.rz, moved: false };
      }}
      onDoubleClick={() => {
        setAngle(DEFAULT_ANGLE);
        setZoom(DEFAULT_ZOOM);
      }}
    >
      {/* 连线层在卡片之下：被卡片遮住的段落自然消失，只有层与层之间的部分显现 */}
      <svg className="deck-edges">
        {edges.map((e, i) => {
          const related = focus === e.from || focus === e.to;
          const cls = focus ? (related ? "deck-edge deck-edge-focus" : "deck-edge deck-edge-dim") : "deck-edge";
          return (
            <path
              key={i}
              className={cls}
              d={`M ${e.x1.toFixed(1)} ${e.y1.toFixed(1)} L ${e.x2.toFixed(1)} ${e.y2.toFixed(1)}`}
              style={{ stroke: e.color }}
            />
          );
        })}
      </svg>

      <div className="deck-stage" style={{ perspective: `${PERSPECTIVE}px` }}>
        <div
          className="deck-world"
          style={{ transform: `scale(${zoom}) rotateX(${angle.rx}deg) rotateZ(${angle.rz}deg)` }}
        >
          {vm.branches.map((branch, f) => {
            const items = vm.items.filter((i) => i.branch.id === branch.id);
            const lit = items.filter((i) => i.effective > 0).length;
            return (
              <div
                key={branch.id}
                className="deck-card"
                style={{
                  width: CARD_W,
                  "--deck-i": f,
                  // 减去级联中点：堆叠绕画布中心展开，避免末端的卡片顶出画框
                  transform:
                    `translate3d(${(f - mid) * CARD_DX - CARD_W / 2}px, ${(f - mid) * CARD_DY}px, ${(f - mid) * CARD_DZ}px) ` +
                    `rotateZ(${-angle.rz}deg) rotateX(${-angle.rx}deg)`,
                }}
              >
                <div className="deck-card-head">
                  <span className="dot" style={{ background: branch.color }} />
                  <span className="name">{branch.name}</span>
                  <span className="count">
                    {lit}/{items.length}
                  </span>
                </div>
                <div className="deck-rows">
                  {items.map((item) => {
                    const status = shownStatus(item, revealSet ?? null);
                    return (
                      <div
                        key={item.skill.id}
                        className={`deck-row deck-row-${status}${selected === item.skill.id ? " deck-row-selected" : ""}`}
                        data-skill={item.skill.id}
                        style={{ ["--c" as string]: branch.color }}
                        onClick={() => {
                          if (!dragRef.current?.moved) onSelect(item.skill.id);
                        }}
                        onMouseEnter={() => setHover(item.skill.id)}
                        onMouseLeave={() => setHover(null)}
                      >
                        <span className="deck-row-name">{item.skill.name}</span>
                        <span className="deck-row-pips">
                          {Array.from({ length: item.skill.levels.length }, (_, i) => (
                            <i
                              key={i}
                              className={
                                status === "lit" && i < item.effective
                                  ? "on"
                                  : status === "blocked" && i < item.assessed
                                    ? "wait"
                                    : ""
                              }
                            />
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="deck-hud">拖拽旋转 · 滚轮缩放 · 双击复位 · 悬浮技能查看跨层前置</div>
    </div>
  );
}
