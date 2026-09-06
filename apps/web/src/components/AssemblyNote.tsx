import { useEffect, useState } from "react";

/** 新本体空态引导：展示 LLM 组装日志（ASSEMBLY.md）摘要——这个本体从哪来的，一目了然。 */
export default function AssemblyNote({ packId }: { packId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`api/assembly/${encodeURIComponent(packId)}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => alive && setText(t))
      .catch(() => alive && setText(null));
    return () => {
      alive = false;
    };
  }, [packId]);
  if (!text) return null;
  const summary = text
    .split("\n")
    .filter((l) => l.startsWith("- ") && !l.startsWith("- 模型"))
    .slice(0, 4)
    .join("　·　");
  return (
    <div className="assembly-note">
      <button className="ghost-btn" onClick={() => setOpen(!open)}>
        🧩 这个本体怎么来的？{open ? "收起" : "查看组装日志"}
      </button>
      {open ? (
        <pre className="assembly-pre">{text.split("\n").slice(0, 24).join("\n")}</pre>
      ) : (
        <p className="muted assembly-summary">{summary}</p>
      )}
    </div>
  );
}
