import { useEffect, useRef, useState } from "react";
import type { Report } from "@skilltree/schema";
import { fetchReport, type ReportMeta } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: (file: string) => void;
  reports: ReportMeta[];
  current: string | null;
}

const RISK_CN: Record<string, string> = { low: "低", medium: "中", high: "高" };

/** 由真实报告的数据推导回放脚本：阶段顺序恒定，数字全部来自报告本身（不虚构） */
function script(meta: ReportMeta, r: Report | null): { percent: number; message: string }[] {
  const lit = r?.stats.litSkills ?? meta.lit;
  const total = r?.stats.totalSkills ?? meta.total;
  const mins = r ? Math.max(1, Math.round(r.stats.durationMs / 60000)) : null;
  const provider = r?.model.provider ?? meta.provider;
  const flags = r ? r.redteam.checks.filter((c) => c.verdict === "flag").length : null;
  const warns = r ? r.redteam.checks.filter((c) => c.verdict === "warn").length : null;
  return [
    {
      percent: 4,
      message: `勘察 surveyor：读取 ${meta.repoName} —— 语言 / 入口 / 测试 / 提交历史 → 证据摘要（内容级 SHA-256）`,
    },
    {
      percent: 14,
      message: `取证 assessor：${provider} 逐分支对照 ${total} 条 rubric——每条裁决必须引用「文件:行号」`,
    },
    { percent: 40, message: "取证 assessor：裁决完成——无引用的条目一律不点亮（宁低勿高）" },
    {
      percent: 58,
      message: r
        ? `红队 redteam：${r.redteam.checks.length} 项检查单——flag ${flags} / warn ${warns}（注水 / 来源 / 空壳 / 提交历史）`
        : "红队 redteam：检查注水 / 来源 / 空壳 / 提交历史",
    },
    {
      percent: 72,
      message: r
        ? `仲裁 arbiter：${r.arbitration.adjustments.length} 项调整留痕（降级必须给 from→to 与理由）`
        : "仲裁 arbiter：按规则复核红队证据",
    },
    { percent: 84, message: "前置约束：点亮合法性由纯函数校验（不交给模型）——杜绝跳点亮" },
    {
      percent: 100,
      message: `完成：${lit}/${total} 点亮 · 风险${RISK_CN[meta.risk] ?? meta.risk}${mins ? `（真实全程 ${mins} 分钟，本回放约 8 秒）` : ""}`,
    },
  ];
}

/** 静态演示包的「评测回放」：按内置真实报告的数据回放四 agent 阶段日志，结束后自动载入报告并点亮 */
export default function DemoReplay({ open, onClose, onDone, reports, current }: Props) {
  const [target, setTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<{ percent: number; message: string }[]>([]);
  const [done, setDone] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (open && (target === "" || !reports.some((r) => r.file === target))) {
      setTarget(current ?? reports[0]?.file ?? "");
    }
  }, [open, reports, current, target]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!open || reports.length === 0) return null;

  const stop = (): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const run = (): void => {
    const meta = reports.find((r) => r.file === target) ?? reports[0];
    if (!meta) return;
    setRunning(true);
    setDone(false);
    setLines([]);
    fetchReport(meta.file)
      .then((r) => script(meta, r))
      .catch(() => script(meta, null))
      .then((steps) => {
        let i = 0;
        const tick = (): void => {
          if (i >= steps.length) {
            timer.current = null;
            setRunning(false);
            setDone(true);
            window.setTimeout(() => onDone(meta.file), 650);
            return;
          }
          const step = steps[i];
          i += 1;
          setLines((prev) => [...prev, step]);
          timer.current = window.setTimeout(tick, step.percent >= 100 ? 450 : 900);
        };
        tick();
      });
  };

  const close = (): void => {
    stop();
    setRunning(false);
    setLines([]);
    setDone(false);
    onClose();
  };

  return (
    <div className="drawer-mask" onClick={running ? undefined : close}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>评测回放 · 演示</h2>
          <button className="sp-close" onClick={close} disabled={running} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="replay-note">
          这是静态演示包，无法发起真实评测——以下按<b>内置真实评测报告</b>的数据回放四个 agent
          的全过程，结束后自动载入该报告并点亮图谱。本地运行（README「快速开始」）可发起新评测。
        </div>

        <label className="field">
          <span>选择目标仓库与报告</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={running}>
            {reports.map((r) => (
              <option key={r.file} value={r.file}>
                {r.repoName} · {r.provider} · {r.lit}/{r.total}
                {r.risk === "high" ? " · ⚠" : ""}
              </option>
            ))}
          </select>
        </label>

        <button className="primary-btn" onClick={run} disabled={running}>
          {running ? "回放中…" : "▶ 开始回放"}
        </button>

        {(lines.length > 0 || done) && (
          <div className="eval-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${lines.at(-1)?.percent ?? 0}%` }} />
            </div>
            <div className="eval-log">
              {lines.slice(-14).map((l, i) => (
                <div key={i} className="eval-log-line">
                  <span className="log-pct">{String(l.percent).padStart(3)}%</span> {l.message}
                </div>
              ))}
              {done && <div className="eval-log-line log-ok">✓ 报告已载入，图谱点亮回放中</div>}
            </div>
          </div>
        )}

        <p className="eval-hint">
          试试 <code>octocat/Hello-World</code>：0/41 点亮 · 风险高——红队识破「3
          次提交仅为 README 换行」。
        </p>
      </div>
    </div>
  );
}
