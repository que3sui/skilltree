import type { Report } from "@skilltree/schema";
import type { VM } from "../model";

interface Props {
  report: Report;
  vm: VM;
  onClose: () => void;
}

const VERDICT: Record<string, { icon: string; label: string; cls: string }> = {
  pass: { icon: "✓", label: "通过", cls: "rv-pass" },
  warn: { icon: "◐", label: "存疑", cls: "rv-warn" },
  flag: { icon: "✗", label: "标记", cls: "rv-flag" },
  unknown: { icon: "○", label: "未知", cls: "rv-unknown" },
};

/**
 * 评审过程面板：勘察 → 取证 → 红队 → 仲裁 的留痕记录。
 * 公平性叙事的落点——不是给一个分数，而是每一步质疑与修正都可查。
 */
export default function ReviewPanel({ report, vm, onClose }: Props) {
  const checks = report.redteam.checks;
  const flagged = checks.filter((c) => c.verdict === "flag").length;
  const warned = checks.filter((c) => c.verdict === "warn").length;
  const adjustCount = report.arbitration.adjustments.length;
  const minutes = Math.round(report.stats.durationMs / 60000);
  const langEntries = Object.entries(report.survey.languages).sort((a, b) => b[1] - a[1]);

  return (
    <div className="drawer-mask" onClick={onClose}>
      <div className="drawer review-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>评审过程留痕</h2>
          <button className="sp-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="rv-meta">
          <span className={`risk-chip risk-${report.redteam.overallRisk}`}>
            红队风险 {report.redteam.overallRisk === "low" ? "低" : report.redteam.overallRisk === "medium" ? "中" : "高"}
          </span>
          <span className="rv-meta-item">标记 {flagged} · 存疑 {warned}</span>
          <span className="rv-meta-item">仲裁调整 {adjustCount} 项</span>
          <span className="rv-meta-item">全程 {minutes} 分钟</span>
        </div>
        <p className="rv-model">{report.model.details}</p>

        <section className="sp-section">
          <h3>勘察摘要</h3>
          <p className="rv-summary">{report.survey.summary}</p>
          {langEntries.length > 0 && (
            <div className="rv-langs">
              {langEntries.map(([lang, lines]) => (
                <span key={lang} className="rv-lang">
                  {lang} <b>{lines}</b> 行
                </span>
              ))}
            </div>
          )}
          {report.survey.observations.length > 0 && (
            <ul className="rv-observations">
              {report.survey.observations.slice(0, 6).map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="sp-section">
          <h3>红队检查（{checks.length} 项）</h3>
          {checks.map((c) => {
            const meta = VERDICT[c.verdict] ?? VERDICT.unknown!;
            return (
              <div key={c.name} className={`rv-check ${meta.cls}`}>
                <div className="rv-check-head">
                  <span className="c-icon">{meta.icon}</span>
                  <span className="rv-check-title">{c.title}</span>
                  <span className="rv-check-verdict">{meta.label}</span>
                </div>
                {c.detail && <p className="rv-check-detail">{c.detail}</p>}
              </div>
            );
          })}
        </section>

        <section className="sp-section">
          <h3>仲裁记录（{adjustCount} 项调整）</h3>
          {adjustCount === 0 && <p className="rv-none">本轮无等级调整——取证结论全部维持。</p>}
          {report.arbitration.adjustments.map((a, i) => {
            const skill = vm.byId.get(a.skillId);
            return (
              <div key={i} className="rv-adjust">
                <div className="rv-adjust-head">
                  <span style={{ color: skill?.branch.color }}>{skill?.skill.name ?? a.skillId}</span>
                  <span className="rv-adjust-levels">
                    L{a.from} → L{a.to}
                  </span>
                </div>
                {a.reason && <p className="rv-adjust-reason">{a.reason}</p>}
              </div>
            );
          })}
          {report.arbitration.notes && (
            <p className="rv-arb-notes">{report.arbitration.notes}</p>
          )}
        </section>
      </div>
    </div>
  );
}
