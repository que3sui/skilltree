import { useRef, useState } from "react";
import { fetchJob, startEvaluation, type JobStatus } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: (reportFile: string | undefined) => void;
  packId: string;
}

export default function EvalDrawer({ open, onClose, onDone, packId }: Props) {
  const [repoPath, setRepoPath] = useState("samples/task-todo");
  const [provider, setProvider] = useState("mock");  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<number | null>(null);

  if (!open) return null;

  const run = async (): Promise<void> => {
    setError(null);
    setJob({ id: "", status: "running", log: [] });
    try {
      const trimmed = repoPath.trim();
      // GitHub/Gitee 公开仓库 URL → 走直评通道（服务端浅克隆 + git 过程证据）
      const isUrl = /^https:\/\/(github\.com|gitee\.com)\/[\w.-]+\/[\w.-]+\/?$/.test(trimmed);
      const { id } = await startEvaluation(trimmed, provider, packId, isUrl);
      poll(id, 0);
    } catch (err) {
      setJob(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const poll = (id: string, attempts: number): void => {
    // 6000 × 400ms = 40 分钟：真实模型全程 11~14 分钟，留足余量（曾因 16 分钟上限误报超时）
    if (attempts > 6000) {
      setError("评测超时");
      return;
    }
    polling.current = window.setTimeout(async () => {
      try {
        const j = await fetchJob(id);
        setJob(j);
        if (j.status === "done") {
          onDone(j.reportFile);
          return;
        }
        if (j.status === "error") {
          setError(j.error ?? "评测失败");
          return;
        }
        poll(id, attempts + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 400);
  };

  const running = job?.status === "running";
  const percent = job?.log.at(-1)?.percent ?? 0;

  return (
    <div className="drawer-mask" onClick={running ? undefined : onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>评测新项目</h2>
          <button className="sp-close" onClick={onClose} disabled={running} aria-label="关闭">
            ×
          </button>
        </div>

        <label className="field">
          <span>项目路径（本地目录）或 GitHub/Gitee 公开仓库 URL（自动浅克隆直评）</span>
          <input
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="samples/task-todo"
            disabled={running}
          />
        </label>

        <label className="field">
          <span>评测模型</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={running}>
            <option value="mock">mock（确定性规则，无需 API key）</option>
            <option value="ustc">ustc（科大统一入口 glm-5.2-107 / deepseek-v4-pro，需 USTC_API_KEY）</option>
            <option value="deepseek">deepseek（官方 API，需 DEEPSEEK_API_KEY）</option>
          </select>
        </label>

        <button className="primary-btn" onClick={run} disabled={running || repoPath.trim() === ""}>
          {running ? "评测中…" : "开始评测"}
        </button>

        {error && <div className="eval-error">✗ {error}</div>}

        {job && (
          <div className="eval-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="eval-log">
              {job.log.slice(-14).map((l, i) => (
                <div key={i} className="eval-log-line">
                  <span className="log-pct">{String(l.percent).padStart(3)}%</span> {l.message}
                </div>
              ))}
              {job.status === "done" && <div className="eval-log-line log-ok">✓ 完成，报告已生成</div>}
            </div>
          </div>
        )}

        <p className="eval-hint">
          试一试：<code>samples/task-todo</code>（优质项目）、<code>samples/algo-notebook</code>（来源存疑）、
          <code>samples/empty-stub</code>（空壳注水）。
        </p>
      </div>
    </div>
  );
}
