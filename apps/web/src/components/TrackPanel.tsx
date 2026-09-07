import { useState } from "react";
import type { ReportMeta } from "../api";

interface Props {
  entries: ReportMeta[]; // 同仓库全部报告，旧→新
  onClose: () => void;
}

/** 学习轨迹：同仓库历次评测的点亮数曲线 + 时间线——绩点只给一次快照，建木给全程轨迹。 */
export default function TrackPanel({ entries, onClose }: Props) {
  // 曲线圆点与时间线行双向联动：悬停一侧，另一侧对应条目高亮
  const [hover, setHover] = useState<number | null>(null);
  const pts = entries.map((e, i) => ({ ...e, i }));
  const max = Math.max(...entries.map((e) => e.total), 1);
  const W = 340;
  const H = 110;
  const x = (i: number) => 16 + (i * (W - 32)) / Math.max(entries.length - 1, 1);
  const y = (lit: number) => H - 14 - (lit / max) * (H - 28);
  const path = pts.map((p) => `${p.i === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.lit).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(pts.length - 1).toFixed(1)} ${H - 14} L 16 ${H - 14} Z`;
  const upTrend = (pts.at(-1)?.lit ?? 0) > pts[0]?.lit;

  return (
    <div className="drawer-mask" onClick={onClose}>
      <div className="drawer track-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>学习轨迹 · {entries[0]?.repoName}</h2>
          <button className="sp-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="rv-meta">
          <span className="rv-meta-item">{entries.length} 次评测</span>
          <span className="rv-meta-item">
            点亮 {pts[0]?.lit}/{pts[0]?.total} → {pts.at(-1)?.lit}/{pts.at(-1)?.total}
            {upTrend ? " ↑" : ""}
          </span>
        </div>

        <section className="sp-section">
          <h3>点亮数曲线</h3>
          <svg viewBox={`0 0 ${W} ${H}`} className="track-svg" role="img" aria-label="历次评测点亮数曲线">
            <path d={area} className="track-area" />
            <path d={path} className="track-line" />
            {pts.map((p) => (
              <g
                key={p.file}
                onPointerEnter={() => setHover(p.i)}
                onPointerLeave={() => setHover(null)}
              >
                <circle
                  cx={x(p.i)}
                  cy={y(p.lit)}
                  r={hover === p.i ? 4.6 : 3.2}
                  className={`track-dot${hover === p.i ? " track-dot-hot" : ""} risk-${p.risk === "high" ? "high" : "ok"}`}
                >
                  <title>{`${new Date(p.createdAt).toLocaleString("zh-CN")} · ${p.provider} · ${p.lit}/${p.total}${p.scoped ? " · 专项重评合并" : ""}`}</title>
                </circle>
                {/* 悬停热区放大到 ±8px，圆点小不易命中 */}
                <circle cx={x(p.i)} cy={y(p.lit)} r="9" fill="transparent" />
              </g>
            ))}
          </svg>
        </section>

        <section className="sp-section">
          <h3>时间线（新 → 旧）</h3>
          {[...pts].reverse().map((p) => (
            <div
              key={p.file}
              className={`cmp-row${hover === p.i ? " cmp-row-hot" : ""}`}
              onPointerEnter={() => setHover(p.i)}
              onPointerLeave={() => setHover(null)}
            >
              <span className="cmp-name">
                {new Date(p.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {p.provider}
                {p.scoped && <span title="专项重评合并报告——曲线突变来自单技能重评，非全量评测"> ⚡</span>}
              </span>
              <span className="cmp-levels">
                {p.lit}/{p.total}{" "}
                <span className={`risk-chip risk-${p.risk}`}>{p.risk === "low" ? "低" : p.risk === "medium" ? "中" : "高"}</span>
              </span>
            </div>
          ))}
        </section>

        <p className="rv-model">等级如何变化？选中任意报告后用「↗ 对比上次」看逐技能 diff。</p>
      </div>
    </div>
  );
}
