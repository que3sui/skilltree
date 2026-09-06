import { useState } from "react";
import type { Report } from "@skilltree/schema";
import type { ResourceEntry } from "../api";
import { askRecommend, type RecommendResult } from "../api";
import type { SkillVM, VM } from "../model";
import { skillStatus, LEVEL_TITLES } from "../model";

interface Props {
  vm: VM;
  report: Report | null;
  item: SkillVM | null;
  resources: ResourceEntry[];
  serverMode: boolean;
  packId: string;
  reportFile: string | null;
  onClose: () => void;
}

const VERDICT_LABEL: Record<string, string> = {
  met: "达标",
  partial: "部分达标",
  unmet: "未达标",
  "not-evidenced": "无证据",
};

const VERDICT_META: Record<string, { icon: string; label: string; cls: string }> = {
  met: { icon: "✓", label: "达标", cls: "v-met" },
  partial: { icon: "◐", label: "部分", cls: "v-partial" },
  unmet: { icon: "✗", label: "未达", cls: "v-unmet" },
  "not-evidenced": { icon: "○", label: "无证据", cls: "v-none" },
};

export default function SidePanel({ vm, report, item, resources, serverMode, packId, reportFile, onClose }: Props) {
  const [rec, setRec] = useState<RecommendResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [appealCopied, setAppealCopied] = useState(false);
  // 申诉模板全文：生成后页面内展示（不依赖剪贴板权限；复制成功另有提示条）
  const [appealText, setAppealText] = useState("");
  if (!item) return null;
  const status = skillStatus(item);

  const matched = resources.filter((r) => r.links.some((l) => l.skill === item.skill.id));

  /** 申诉流 v1：把判准原文、评测结论与复现信息组装成申诉说明，复制到剪贴板 */
  const copyAppeal = async (): Promise<void> => {
    if (!report) return;
    const lines: string[] = [];
    lines.push(`# 申诉说明 · ${item.skill.name}（当前 L${item.effective}${item.assessed !== item.effective ? `，评估 L${item.assessed} 因前置封顶` : ""}）`);
    lines.push("");
    lines.push(`## 被评判准（rubric 原文）`);
    for (const c of item.criteria) {
      lines.push(`- [${VERDICT_LABEL[c.verdict] ?? c.verdict}] ${c.text}`);
      for (const cit of c.citations) lines.push(`  - 证据：${cit.file}${cit.note ? `（${cit.note}）` : ""}`);
    }
    lines.push("");
    lines.push("## 我的申诉理由");
    lines.push("（请填写：哪条判准已有证据支撑？指向具体文件与行为；或证据被误读之处。）");
    lines.push("");
    lines.push("## 复核信息");
    lines.push(`- 技能：${item.skill.id} · ${item.branch.name}`);
    lines.push(`- 标准：ontology/packs/${packId}（公开可查，rubric 版本随报告锁定）`);
    lines.push(`- 报告：${reportFile ?? "（当前会话）"} · 证据指纹 ${report.evidence.digestHash}`);
    lines.push(`- 模型：${report.model.details}`);
    lines.push(`- 复现：pnpm evaluate --repo ${report.evidence.kind === "local-dir" ? report.evidence.path : report.evidence.name} --pack ontology/packs/${packId}`);
    lines.push(`- 置信度：${Math.round(item.confidence * 100)}%（仲裁调整${item.adjustment ? `：L${item.adjustment.from} → L${item.adjustment.to}（${item.adjustment.reason}）` : "：无"}）`);
    const text = lines.join("\n");
    setAppealText(text); // 页面内展示全文——剪贴板不可用（如无手势/权限）也能看到并手动复制
    try {
      await navigator.clipboard.writeText(text);
      setAppealCopied(true);
      window.setTimeout(() => setAppealCopied(false), 4000);
    } catch {
      document.querySelector(".sp-appeal-details")?.setAttribute("open", "");
    }
  };

  const ask = async (): Promise<void> => {
    setAsking(true);
    setRec(null);
    try {
      const res = await askRecommend(item.skill.id, item.skill.name, status !== "lit", packId, reportFile);
      setRec(res);
    } catch {
      setRec({ path: [], picks: [] });
    } finally {
      setAsking(false);
    }
  };
  return (
    <aside className="side-panel">
      <button className="sp-close" onClick={onClose} aria-label="关闭">
        ×
      </button>
      <div className="sp-branch" style={{ color: item.branch.color }}>
        ● {item.branch.name} · TIER {item.skill.tier}
      </div>
      <h2 className="sp-title">{item.skill.name}</h2>
      {item.skill.summary && <p className="sp-summary">{item.skill.summary}</p>}

      <div className="sp-badges">
        <span className={`badge badge-${status}`}>
          {status === "lit" ? `已点亮 L${item.effective}` : status === "blocked" ? "前置阻塞" : "未点亮"}
        </span>
        {item.assessed > 0 && item.assessed !== item.effective && (
          <span className="badge badge-muted">评估 L{item.assessed}</span>
        )}
        <span className="badge badge-muted">置信度 {(item.confidence * 100).toFixed(0)}%</span>
      </div>

      {item.rationale && <p className="sp-rationale">{item.rationale}</p>}

      {matched.length > 0 && (
        <section className="sp-section">
          <h3>学习资源</h3>
          {status !== "lit" && (
            <p className="sp-res-tip">{status === "blocked" ? "被前置阻塞——从这里补基础" : "未点亮——从这里开始"}</p>
          )}
          <div className="sp-resources">
            {matched.slice(0, 4).map((r) => (
              <a key={r.id} className="sp-res" href={r.url} target="_blank" rel="noreferrer">
                <span className="sp-res-type">{r.type}</span>
                <span className="sp-res-title">{r.title}</span>
              </a>
            ))}
          </div>
          {serverMode && (
            <button className="ghost-btn sp-ask" onClick={ask} disabled={asking}>
              {asking ? "AI 推荐中…" : "问 AI：现在该学什么"}
            </button>
          )}
          {rec !== null && (
            <div className="sp-picks">
              {rec.path.length > 0 && (
                <div className="sp-path">
                  <span className="sp-path-label">先补前置</span>
                  {rec.path.map((g) => (
                    <span key={g.skill} className="sp-path-chip">
                      {g.name} L{g.currentLevel}→L{g.needLevel}
                    </span>
                  ))}
                </div>
              )}
              {rec.picks.length === 0 && <p className="sp-res-tip">暂无推荐——资源库中该技能的资料还不够能给出建议。</p>}
              {rec.picks.map((p) => (
                <div key={p.id} className="sp-pick">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.title}
                  </a>
                  <p>{p.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {item.skill.prereqs.length > 0 && (
        <section className="sp-section">
          <h3>前置</h3>
          <div className="sp-prereqs">
            {item.skill.prereqs.map((p) => {
              const pre = vm.byId.get(p.skill);
              const met = (pre?.effective ?? 0) >= p.minLevel;
              return (
                <span key={p.skill} className={`prereq-chip ${met ? "prereq-ok" : "prereq-miss"}`}>
                  {pre?.skill.name ?? p.skill} · 需 L{p.minLevel}（现 L{pre?.effective ?? 0}）
                </span>
              );
            })}
          </div>
        </section>
      )}

      <section className="sp-section">
        <h3>评价标准（rubric v{report?.pack.version ?? "?"}）</h3>
        {item.skill.levels.map((ls) => {
          const crits = ls.level <= item.assessed ? item.criteria.filter(() => true) : item.criteria;
          void crits;
          const levelCrits = levelSlice(item, ls.level);
          return (
            <div key={ls.level} className="rubric-level">
              <div className="rubric-level-head">
                L{ls.level} · {LEVEL_TITLES[ls.level] ?? ""}
              </div>
              {levelCrits.map((c, i) => {
                const meta = VERDICT_META[c.verdict] ?? VERDICT_META["not-evidenced"]!;
                return (
                  <div key={i} className={`criterion ${meta.cls}`}>
                    <span className="c-icon">{meta.icon}</span>
                    <div className="c-body">
                      <div className="c-text">{c.text}</div>
                      {c.citations.length > 0 && (
                        <div className="c-cites">
                          {c.citations.map((cit, j) => (
                            <div key={j} className="c-cite">
                              <code>{cit.file}</code>
                              {cit.note && <span className="c-note">{cit.note}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      {item.adjustment && (
        <section className="sp-section">
          <div className="sp-adjust">
            仲裁调整：L{item.adjustment.from} → L{item.adjustment.to}。{item.adjustment.reason}
          </div>
        </section>
      )}

      {report && (
        <section className="sp-section">
          <button className="ghost-btn sp-appeal" onClick={copyAppeal}>
            📋 生成申诉说明
          </button>
          {appealCopied && (
            <p className="sp-res-tip">申诉模板已复制——填写理由后提交任课教师/种子编辑组复核。标准原文与证据行号已一并附上。</p>
          )}
          {appealText && (
            <details className="sp-appeal-details">
              <summary>申诉说明全文（{appealText.length} 字）</summary>
              <pre className="sp-appeal-pre">{appealText}</pre>
            </details>
          )}
        </section>
      )}
    </aside>
  );
}

/** 本体 levels 顺序与 report.criteria 平铺顺序一致，按等级切片 */
function levelSlice(item: SkillVM, level: number) {
  let offset = 0;
  for (const ls of item.skill.levels) {
    const count = ls.criteria.length;
    if (ls.level === level) return item.criteria.slice(offset, offset + count);
    offset += count;
  }
  return [];
}
