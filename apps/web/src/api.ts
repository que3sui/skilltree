import type { Report, SkillPack, PackIssue } from "@skilltree/schema";

export interface ReportMeta {
  file: string;
  id: string;
  repoName: string;
  /** 报告所属本体——轨迹/对比的同仓库序列必须同 pack，防跨学科同名混排 */
  packId: string;
  createdAt: string;
  provider: string;
  risk: string;
  lit: number;
  total: number;
  /** 专项重评合并报告——轨迹/时间线以 ⚡ 标注，提示曲线突变来自单技能重评 */
  scoped?: boolean;
}

/**
 * 双通道取数：优先本地服务（/api/*，可触发真实评测）；
 * 服务不可达时回退到构建期内置的演示数据（/demo/*，静态托管即可运行）；
 * fetch 本身不可用时（file:// 协议双击打开）落到嵌入 JS 包的演示数据层。
 * mode 记录首个成功通道，供界面标注当前处于哪种模式。
 */
export type ApiMode = "server" | "demo";
let mode: ApiMode | null = null;
export function apiMode(): ApiMode {
  return mode ?? "server";
}

/** 构建期由 demo-bundle 脚本写入 src/demo-data/，经 glob 拆为按需加载的异步块 */
const embeddedDemo = import.meta.glob("./demo-data/**/*.json", { import: "default" }) as Record<
  string,
  () => Promise<unknown>
>;

async function loadEmbedded<T>(demoUrl: string): Promise<T | null> {
  const key = `./demo-data/${demoUrl.replace(/^demo\//, "")}`;
  const loader = embeddedDemo[key];
  if (!loader) return null;
  return (await loader()) as T;
}

async function getJson<T>(url: string, demoUrl?: string): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `${url} -> ${res.status}`);
    }
    mode = "server";
    return (await res.json()) as T;
  } catch (err) {
    if (demoUrl) {
      try {
        const res = await fetch(demoUrl);
        if (res.ok) {
          mode = "demo";
          return (await res.json()) as T;
        }
      } catch {
        // fetch 在该环境不可用（如 file:// 协议）——落到嵌入层
      }
      const embedded = await loadEmbedded<T>(demoUrl);
      if (embedded !== null) {
        mode = "demo";
        return embedded;
      }
    }
    throw err;
  }
}

export interface PackMeta {
  id: string;
  name: string;
  version: string;
}

export function fetchPacks(): Promise<{ packs: PackMeta[] }> {
  return getJson("api/packs");
}

export function fetchPack(packId?: string): Promise<{ pack: SkillPack; issues: PackIssue[] }> {
  return getJson(packId ? `api/pack?name=${encodeURIComponent(packId)}` : "api/pack", "demo/pack.json");
}

export function fetchReports(packId?: string): Promise<{ reports: ReportMeta[] }> {
  const url = packId ? `api/reports?pack=${encodeURIComponent(packId)}` : "api/reports";
  return getJson(url, "demo/index.json");
}

export function fetchReport(file: string): Promise<Report> {
  return getJson(`api/reports/${encodeURIComponent(file)}`, `demo/reports/${encodeURIComponent(file)}`);
}

export interface ResourceEntry {
  id: string;
  title: string;
  url: string;
  type: string;
  notes?: string;
  links: { skill: string; minLevel: number }[];
}

/** 学习资源索引：静态托管无内置回退（demo 模式该区自动隐藏） */
export function fetchResources(): Promise<{ resources: ResourceEntry[] }> {
  return getJson("api/resources");
}

export interface RecommendPick {
  id: string;
  title: string;
  url: string;
  type: string;
  reason: string;
}

export interface RecommendGap {
  skill: string;
  name: string;
  needLevel: number;
  currentLevel: number;
}

export interface RecommendResult {
  path: RecommendGap[];
  picks: RecommendPick[];
}

export function askRecommend(
  skillId: string,
  skillName: string,
  blocked: boolean,
  packId?: string,
  reportFile?: string | null,
): Promise<RecommendResult> {
  return fetch("api/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ skillId, skillName, blocked, packId, reportFile }),
  }).then(async (res) => {
    if (!res.ok) return { path: [], picks: [] };
    return (await res.json()) as RecommendResult;
  });
}

export interface JobStatus {
  id: string;
  status: "running" | "done" | "error";
  log: { stage: string; message: string; percent: number; at: number }[];
  error?: string;
  reportFile?: string;
}

export function startEvaluation(
  repoPath: string,
  provider: string,
  packId?: string,
  isUrl = false,
  skills?: string[],
): Promise<{ id: string }> {
  return fetch("api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      isUrl
        ? { repoUrl: repoPath, provider, packId, skills }
        : { repoPath, provider, packId, skills },
    ),
  }).then(async (res) => {
    const body = (await res.json()) as { id?: string; error?: string };
    if (!res.ok || !body.id) throw new Error(body.error ?? `评测启动失败（${res.status}）`);
    return body as { id: string };
  });
}

export function fetchJob(id: string): Promise<JobStatus> {
  return getJson(`api/jobs/${encodeURIComponent(id)}`);
}
