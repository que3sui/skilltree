import type { PackMeta, ReportMeta } from "../api";

interface Props {
  packName: string;
  packVersion: string;
  packs: PackMeta[];
  packId: string;
  onPack: (id: string) => void;
  view: "tree" | "grid" | "deck";
  onView: (v: "tree" | "grid" | "deck") => void;
  reports: ReportMeta[];
  current: string | null;
  onReport: (file: string) => void;
  lit: number;
  total: number;
  onEvaluate?: () => void;
  onReplay: () => void;
  demoMode: boolean;
}

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Toolbar(p: Props) {
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-dot" /> 建木
        {p.packs.length > 1 ? (
          <select
            className="pack-select"
            value={p.packId}
            onChange={(e) => p.onPack(e.target.value)}
            aria-label="切换技能本体"
            title="切换学科本体（pack）"
          >
            {p.packs.map((pk) => (
              <option key={pk.id} value={pk.id}>
                {pk.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="brand-sub">SkillTree · {p.packName} v{p.packVersion}</span>
        )}
      </div>

      <div className="segment">
        <button className={p.view === "tree" ? "seg-on" : ""} onClick={() => p.onView("tree")}>
          科技树
        </button>
        <button className={p.view === "grid" ? "seg-on" : ""} onClick={() => p.onView("grid")}>
          蜂窝网格
        </button>
        <button className={p.view === "deck" ? "seg-on" : ""} onClick={() => p.onView("deck")}>
          层叠
        </button>
      </div>

      <button className="ghost-btn" onClick={p.onReplay} title="按 tier 逐层重播点亮过程">
        ▶ 回放点亮
      </button>

      <div className="toolbar-right">
        {p.total > 0 && (
          <span className="stat-chip">
            <b>{p.lit}</b> / {p.total} 已点亮
          </span>
        )}
        <select
          className="report-select"
          value={p.current ?? ""}
          onChange={(e) => p.onReport(e.target.value)}
          aria-label="选择评测报告"
        >
          {p.reports.length === 0 && <option value="">暂无报告</option>}
          {Object.entries(
            p.reports.reduce<Record<string, typeof p.reports>>((acc, r) => {
              (acc[r.repoName] ??= []).push(r);
              return acc;
            }, {}),
          ).map(([repo, list]) => (
            <optgroup key={repo} label={repo}>
              {list.map((r) => (
                <option key={r.file} value={r.file}>
                  {r.provider} · {r.lit}/{r.total}
                  {r.risk === "high" ? " · ⚠" : ""} · {stamp(r.createdAt)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {p.onEvaluate && (
          <button className="primary-btn small" onClick={p.onEvaluate}>
            ⚡ 评测项目
          </button>
        )}
      </div>
    </header>
  );
}
