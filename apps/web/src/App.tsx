import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Report, SkillPack } from "@skilltree/schema";
import { apiMode, fetchPack, fetchPacks, fetchReport, fetchReports, fetchResources, type ApiMode, type PackMeta, type ResourceEntry, type ReportMeta } from "./api";
import { buildVM, dependencyClosure, revealOrder } from "./model";
import Toolbar from "./components/Toolbar";
import TreeView from "./components/TreeView";
import GridView from "./components/GridView";
import DeckView from "./components/DeckView";
import SidePanel from "./components/SidePanel";
import EvalDrawer from "./components/EvalDrawer";
import ReviewPanel from "./components/ReviewPanel";
import ComparePanel from "./components/ComparePanel";
import AssemblyNote from "./components/AssemblyNote";
import TrackPanel from "./components/TrackPanel";
import { exportGraphPng } from "./shareCard";

type ViewKind = "tree" | "grid" | "deck";

const REVEAL_STEP_MS = 120;

export default function App() {
  const [pack, setPack] = useState<SkillPack | null>(null);
  const [packs, setPacks] = useState<PackMeta[]>([]);
  const [packId, setPackId] = useState<string>("cs");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [mode, setMode] = useState<ApiMode>("server");
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  // 报告加载中：标题区动作按钮（分享卡/轨迹/对比）隐藏，防止点了取到新旧混合数据
  const [reportLoading, setReportLoading] = useState(false);
  const [view, setView] = useState<ViewKind>("tree");
  const [viewFading, setViewFading] = useState(false);
  const switchView = useCallback((v: ViewKind): void => {
    if (v === view) return;
    setViewFading(true);
    window.setTimeout(() => {
      setView(v);
      setViewFading(false);
    }, 120);
  }, [view]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [evalOpen, setEvalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [compareReport, setCompareReport] = useState<Report | null>(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // 分享卡导出成功的短暂反馈（录屏/演示可见；下载本身无页面变化）
  const [shareDone, setShareDone] = useState(false);

  // 点亮回放：null = 全部呈现；否则集合外的已点亮技能暂按未点亮渲染
  const [revealSet, setRevealSet] = useState<Set<string> | null>(null);
  const revealTimer = useRef<number | null>(null);

  useEffect(() => {
    fetchPacks()
      .then((res) => setPacks(res.packs))
      .catch(() => setPacks([]));
    fetchResources()
      .then((res) => setResources(res.resources))
      .catch(() => setResources([]));
  }, []);

  // 本体切换：重取 pack 与该 pack 的报告列表；旧 pack 的一切状态复位，避免闪错
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    setSelected(null);
    setFocusId(null);
    setReviewOpen(false);
    setEvalOpen(false);
    setReport(null); // 无报告的新本体必须呈现空态引导，而不是沿用上一本体的报告
    setSwitching(true);
    fetchPack(packId)
      .then((res) => {
        if (!alive) return;
        setPack(res.pack);
        setMode(apiMode());
        setSwitching(false);
      })
      .catch((err) => {
        if (!alive) return;
        setSwitching(false);
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    fetchReports(packId)
      .then((res) => {
        if (!alive) return;
        setReports(res.reports);
        setMode(apiMode());
        setCurrent(res.reports[0]?.file ?? null);
      })
      .catch(() => alive && setReports([]));
    return () => {
      alive = false;
    };
  }, [packId]);

  useEffect(() => {
    if (!current) return;
    // 报告切换淡入（复用视图过渡）
    setViewFading(true);
    const t = window.setTimeout(() => setViewFading(false), 120);
    setReportLoading(true);
    fetchReport(current)
      .then((r) => {
        setReport(r);
        setMode(apiMode());
      })
      .catch(() => setReport(null))
      .finally(() => setReportLoading(false));
    return () => window.clearTimeout(t);
  }, [current]);

  // Esc 退出聚焦
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setFocusId(null);
        setReviewOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const vm = useMemo(() => (pack ? buildVM(pack, report) : null), [pack, report]);
  const order = useMemo(() => (vm ? revealOrder(vm) : []), [vm]);

  const stopReveal = (): void => {
    if (revealTimer.current !== null) {
      window.clearInterval(revealTimer.current);
      revealTimer.current = null;
    }
  };

  /** 逐个点亮：报告切换后自动播一次，工具栏按钮可手动重播（演示/录屏用） */
  const startReveal = useCallback((): void => {
    stopReveal();
    if (order.length === 0) {
      setRevealSet(null);
      return;
    }
    setRevealSet(new Set<string>());
    let i = 0;
    revealTimer.current = window.setInterval(() => {
      i += 1;
      setRevealSet((prev) => {
        const next = new Set(prev ?? []);
        next.add(order[i - 1]);
        return next;
      });
      if (i >= order.length) {
        stopReveal();
        setRevealSet(null);
      }
    }, REVEAL_STEP_MS);
  }, [order]);

  useEffect(() => {
    startReveal();
    return stopReveal;
  }, [startReveal]);

  const selectedItem = vm && selected ? (vm.byId.get(selected) ?? null) : null;
  const focusSet = useMemo(
    () => (vm && focusId ? dependencyClosure(vm, focusId) : null),
    [vm, focusId],
  );
  const focusName = vm && focusId ? (vm.byId.get(focusId)?.skill.name ?? focusId) : null;

  const onDone = useCallback(
    (file: string | undefined) => {
      fetchReports(packId).then((res) => {
        setReports(res.reports);
        const target = file ?? res.reports[0]?.file;
        if (target) setCurrent(target);
      });
    },
    [packId],
  );

  if (loadError) {
    return (
      <div className="boot-error">
        <h1>💡 建木 SkillTree</h1>
        <p>无法加载技能本体：{loadError}</p>
        <p className="muted">请先启动本地服务（pnpm server，端口 8787）后刷新；或使用内置演示数据的静态构建。</p>
      </div>
    );
  }
  if (!pack || !vm) {
    return <div className="boot-loading">加载技能本体…</div>;
  }

  const demoMode = mode === "demo";

  return (
    <div className="app">
      {switching && <div className="switch-progress" aria-hidden="true" />}
      <Toolbar
        packName={pack.name}
        packVersion={pack.version}
        packs={packs}
        packId={packId}
        onPack={setPackId}
        view={view}
        onView={switchView}
        reports={reports}
        current={current}
        onReport={setCurrent}
        lit={vm.lit}
        total={vm.total}
        onEvaluate={demoMode ? undefined : () => setEvalOpen(true)}
        onReplay={startReveal}
        demoMode={demoMode}
      />

      <main className="main">
        <div className="canvas">
          {report ? (
            <>
              <div className="canvas-head">
                <span
                  className="canvas-title"
                  title={`证据指纹 ${report.evidence.digestHash} · rubric ${report.pack.contentHash} · ${new Date(report.createdAt).toLocaleString()}`}
                >
                  {report.evidence.name}
                  <span className="canvas-sub">
                    {" · "}
                    {report.model.provider} ·{" "}
                    {Math.round(report.stats.durationMs / 60000)} 分钟
                  </span>
                </span>
                <span className="canvas-head-right">
                  {demoMode && <span className="demo-chip" title="静态托管 + 内置评测报告；本地运行 pnpm server 可发起新评测">演示数据</span>}
                  {!reportLoading && (() => {
                    // 分享卡导出（tree/grid 的 SVG 图谱；deck 是 HTML 3D 不适用）
                    if (view === "deck" || !report) return null;
                    return (
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          setShareError(null);
                          setShareDone(false);
                          const svg = document.querySelector(".view-stage svg") as SVGSVGElement | null;
                          if (!svg) {
                            setShareError("未找到图谱 SVG");
                            return;
                          }
                          exportGraphPng(svg, {
                            title: report.evidence.name,
                            sub: `${report.model.provider === "mock" ? "mock" : report.model.provider} · ${Math.round(report.stats.durationMs / 60000)} 分钟`,
                            lit: vm.lit,
                            total: vm.total,
                            fingerprint: report.evidence.digestHash,
                          })
                            .then(() => {
                              setShareDone(true);
                              window.setTimeout(() => setShareDone(false), 2500);
                            })
                            .catch((e) => setShareError(e instanceof Error ? e.message : String(e)));
                        }}
                        title="把当前点亮图谱导出为 PNG 分享卡"
                      >
                        ⇩ 分享卡
                      </button>
                    );
                  })()}
                  {shareError && <span className="rv-meta-item" title={shareError}>导出失败</span>}
                  {shareDone && <span className="rv-meta-item" title="PNG 已下载（题头含点亮数与证据指纹角标）">已导出 PNG ✓</span>}
                  {!reportLoading && (() => {
                    // 学习轨迹：同仓库 ≥2 次评测即有曲线
                    const cur = reports.find((r) => r.file === current);
                    const series = cur
                      ? reports.filter((r) => r.repoName === cur.repoName).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                      : [];
                    if (series.length < 2) return null;
                    return (
                      <button className="ghost-btn" onClick={() => setTrackOpen(true)} title={`${series.length} 次评测的点亮数轨迹`}>
                        📈 轨迹
                      </button>
                    );
                  })()}
                  {!reportLoading && (() => {
                    // 同仓库还有更早报告 → 可对比（成长证明）
                    const cur = reports.find((r) => r.file === current);
                    const prev = cur
                      ? reports.find((r) => r.repoName === cur.repoName && r.file !== cur.file && new Date(r.createdAt) < new Date(cur.createdAt))
                      : undefined;
                    if (!cur || !prev) return null;
                    return (
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          fetchReport(prev.file)
                            .then(setCompareReport)
                            .catch(() => setCompareReport(null));
                        }}
                        title="与同仓库上一次评测对比等级变化"
                      >
                        ↗ 对比上次
                      </button>
                    );
                  })()}
                  {reportLoading && <span className="rv-meta-item" title="报告加载中">加载中…</span>}
                  {focusName && (
                    <span className="focus-chip">
                      🔍 {focusName}
                      <button onClick={() => setFocusId(null)} aria-label="退出聚焦">
                        ×
                      </button>
                    </span>
                  )}
                  <button className="review-btn" onClick={() => setReviewOpen(true)}>
                    评审留痕 · 红{report.redteam.checks.filter((c) => c.verdict === "flag").length}/疑
                    {report.redteam.checks.filter((c) => c.verdict === "warn").length}/裁
                    {report.arbitration.adjustments.length}
                  </button>
                  <span className={`risk-chip risk-${report.redteam.overallRisk}`}>
                    红队风险{" "}
                    {report.redteam.overallRisk === "low" ? "低" : report.redteam.overallRisk === "medium" ? "中" : "高"}
                  </span>
                </span>
              </div>
              <div className={`view-stage${viewFading ? " view-stage-fading" : ""}`}>
              {view === "tree" ? (
                <TreeView
                  vm={vm}
                  selected={selected}
                  onSelect={(id) => setSelected(id)}
                  onDblClick={(id) => setFocusId(id === focusId ? null : id)}
                  focusSet={focusSet}
                  revealSet={revealSet}
                />
              ) : view === "grid" ? (
                <GridView
                  vm={vm}
                  selected={selected}
                  onSelect={(id) => setSelected(id)}
                  onDblClick={(id) => setFocusId(id === focusId ? null : id)}
                  focusSet={focusSet}
                  revealSet={revealSet}
                />
              ) : (
                <DeckView vm={vm} selected={selected} onSelect={(id) => setSelected(id)} revealSet={revealSet} />
              )}
              </div>
              <div className="legend">
                <span className="legend-item">
                  <i className="lg lg-lit" /> 点亮
                </span>
                <span className="legend-item">
                  <i className="lg lg-dim" /> 未点亮
                </span>
                <span className="legend-item">
                  <i className="lg lg-blocked" /> 前置阻塞（评估达标但前置未达）
                </span>
                <span className="legend-tip">
                  {view === "deck"
                    ? "拖拽旋转 · 悬浮技能查看跨层前置"
                    : "双击技能聚焦其前后依赖 · Esc 退出"}
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-bulb">💡</div>
              <h2>还没有评测报告</h2>
              <p>
                点击右上角 <b>⚡ 评测项目</b>，输入一个本地项目目录跑一次评测（mock 模式无需 API key）。
              </p>
              <p className="muted">推荐先试 samples/task-todo —— 一个带测试的命令行 todo 应用。</p>
              <button className="primary-btn" onClick={() => setEvalOpen(true)}>
                ⚡ 开始第一次评测
              </button>
              {packId !== "cs" && <AssemblyNote packId={packId} />}
            </div>
          )}
        </div>

        {selectedItem && (
          <SidePanel
            vm={vm}
            report={report}
            item={selectedItem}
            resources={resources}
            serverMode={mode === "server"}
            packId={packId}
            reportFile={current}
            onClose={() => setSelected(null)}
          />
        )}
      </main>

      {!demoMode && (
        <EvalDrawer open={evalOpen} onClose={() => setEvalOpen(false)} onDone={onDone} packId={packId} />
      )}
      {report && reviewOpen && (
        <ReviewPanel report={report} vm={vm} onClose={() => setReviewOpen(false)} />
      )}
      {report && compareReport && vm && (
        <ComparePanel prev={compareReport} curr={report} vm={vm} onClose={() => setCompareReport(null)} />
      )}
      {trackOpen &&
        (() => {
          const cur = reports.find((r) => r.file === current);
          const series = cur
            ? reports.filter((r) => r.repoName === cur.repoName).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            : [];
          return series.length >= 2 ? (
            <TrackPanel entries={series} onClose={() => setTrackOpen(false)} />
          ) : null;
        })()}
    </div>
  );
}
