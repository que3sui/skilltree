import type { Report } from "@skilltree/schema";
import type { VM } from "../model";

interface Props {
  prev: Report;
  curr: Report;
  vm: VM;
  onClose: () => void;
}

/** 同一仓库两次评测的等级对比：成长证明——绩点给不了的东西。 */
export default function ComparePanel({ prev, curr, vm, onClose }: Props) {
  const prevLevel = new Map(prev.assessments.map((a) => [a.skillId, a.level ?? 0]));
  const rows = curr.assessments
    .map((a) => {
      const before = prevLevel.get(a.skillId) ?? 0;
      const after = a.level ?? 0;
      return { id: a.skillId, name: vm.byId.get(a.skillId)?.skill.name ?? a.skillId, before, after };
    })
    .sort((x, y) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before) || (x.after < y.after ? 1 : -1));
  const changed = rows.filter((r) => r.after !== r.before);
  const up = changed.filter((r) => r.after > r.before);
  const down = changed.filter((r) => r.after < r.before);
  const same = rows.length - changed.length;
  const fmt = (iso: string): string => new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="drawer-mask" onClick={onClose}>
      <div className="drawer compare-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>成长对比 · {curr.evidence.name}</h2>
          <button className="sp-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="rv-meta">
          <span className="rv-meta-item">上次 {fmt(prev.createdAt)}：{prev.model.provider}</span>
          <span className="rv-meta-item">本次 {fmt(curr.createdAt)}：{curr.model.provider}</span>
          <span className="rv-meta-item">↑ {up.length} · ↓ {down.length} · 持平 {same}</span>
        </div>

        {changed.length === 0 && <p className="rv-none">两次评测等级完全一致——结论稳定本身也是一种证据。</p>}

        {up.length > 0 && (
          <section className="sp-section">
            <h3>进步（{up.length}）</h3>
            {up.map((r) => (
              <div key={r.id} className="cmp-row cmp-up">
                <span className="cmp-name">{r.name}</span>
                <span className="cmp-levels">L{r.before} → L{r.after}</span>
              </div>
            ))}
          </section>
        )}
        {down.length > 0 && (
          <section className="sp-section">
            <h3>回落（{down.length}——通常因红队证据或标准升级）</h3>
            {down.map((r) => (
              <div key={r.id} className="cmp-row cmp-down">
                <span className="cmp-name">{r.name}</span>
                <span className="cmp-levels">L{r.before} → L{r.after}</span>
              </div>
            ))}
          </section>
        )}

        <section className="sp-section">
          <h3>红队结论</h3>
          <div className="cmp-risk">
            上次 <span className={`risk-chip risk-${prev.redteam.overallRisk}`}>{prev.redteam.overallRisk === "low" ? "低" : prev.redteam.overallRisk === "medium" ? "中" : "高"}</span>
            {" → "}
            本次 <span className={`risk-chip risk-${curr.redteam.overallRisk}`}>{curr.redteam.overallRisk === "low" ? "低" : curr.redteam.overallRisk === "medium" ? "中" : "高"}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
