/**
 * 建木本地服务：技能本体 / 评测报告 API + 触发评测 + 静态托管 web 构建产物。
 * 单进程、内存任务表，定位是本机工具（127.0.0.1），不做鉴权与多租户。
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runEvaluation } from "@skilltree/evaluator";
import { createProvider, extractJson, loadPack, loadResources } from "@skilltree/evaluator";
import type { ProviderKind } from "@skilltree/evaluator";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const PACKS_ROOT = path.join(ROOT, "ontology", "packs");
const REPORTS_DIR = path.join(ROOT, "reports");
const WEB_DIST = path.join(ROOT, "apps", "web", "dist");

interface Job {
  id: string;
  status: "running" | "done" | "error";
  log: { stage: string; message: string; percent: number; at: number }[];
  error?: string;
  reportFile?: string;
}

const jobs = new Map<string, Job>();

const app = new Hono();

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const DEFAULT_PACK = "cs";

/** —— 本机资源护栏：评测并发上限 + 写操作简单限速（防误操作打满机器/网关）—— */
const MAX_CONCURRENT_EVALS = 2;
let runningEvals = 0;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}
const clientKey = (c: { req: { header(name: string): string | undefined } }): string =>
  c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
/** pack 目录解析：id 只允许是单段目录名，杜绝越出 packs 根 */
function packDirFor(id: string | undefined): string {
  const safe = id && path.basename(id) === id && !id.includes("..") ? id : DEFAULT_PACK;
  const resolved = path.resolve(PACKS_ROOT, safe);
  const root = path.resolve(PACKS_ROOT);
  // 双重边界：basename 白名单 + 解析后仍必须落在 packs 根内
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`pack id 越界: ${id}`);
  }
  return resolved;
}

app.get("/api/packs", (c) => {
  if (!fs.existsSync(PACKS_ROOT)) return c.json({ packs: [] });
  const packs = fs
    .readdirSync(PACKS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      try {
        const { pack } = loadPack(path.join(PACKS_ROOT, e.name));
        return { id: pack.id, name: pack.name, version: pack.version };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return c.json({ packs });
});

app.get("/api/pack", (c) => {
  try {
    const { pack, issues } = loadPack(packDirFor(c.req.query("name")));
    return c.json({ pack, issues });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/** 报告元信息缓存：按 文件名+mtime 增量复用，避免每次请求全量读盘解析 */
const reportMetaCache = new Map<string, { mtime: number; meta: unknown }>();

app.get("/api/reports", (c) => {
  if (!fs.existsSync(REPORTS_DIR)) return c.json({ reports: [] });
  const packFilter = c.req.query("pack");
  const reports = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .map((file) => {
      try {
        const full = path.join(REPORTS_DIR, file);
        const mtime = fs.statSync(full).mtimeMs;
        const cached = reportMetaCache.get(file);
        let r: Record<string, unknown>;
        if (cached && cached.mtime === mtime) {
          r = cached.meta as Record<string, unknown>;
        } else {
          r = JSON.parse(fs.readFileSync(full, "utf8")) as Record<string, unknown>;
          reportMetaCache.set(file, { mtime, meta: r });
        }
        if (packFilter && (r.pack as { id?: string } | undefined)?.id !== packFilter) return null;
        return {
          file,
          id: r.id,
          repoName: (r.evidence as { name?: string } | undefined)?.name ?? "?",
          packId: (r.pack as { id?: string } | undefined)?.id ?? "?",
          createdAt: r.createdAt,
          provider: (r.model as { provider?: string } | undefined)?.provider ?? "?",
          risk: (r.redteam as { overallRisk?: string } | undefined)?.overallRisk ?? "low",
          lit: (r.stats as { litSkills?: number } | undefined)?.litSkills ?? 0,
          total: (r.stats as { totalSkills?: number } | undefined)?.totalSkills ?? 0,
          scoped: !!r.scope,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return c.json({ reports });
});

/** 本体组装日志（LLM 组装草稿的 ASSEMBLY.md 摘要，供空态引导展示） */
const ASSEMBLY_MAX_BYTES = 32 * 1024;
app.get("/api/assembly/:packId", (c) => {
  const id = c.req.param("packId");
  if (path.basename(id) !== id) return c.json({ error: "非法 packId" }, 400);
  const file = path.join(packDirFor(id), "ASSEMBLY.md");
  if (!fs.existsSync(file)) return c.json({ error: "该本体无组装日志（手写或未留档）" }, 404);
  const text = fs.readFileSync(file, "utf8");
  // 防异常大文件全量下发：超限截断并明示（正常组装日志 ≈ 数 KB）
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= ASSEMBLY_MAX_BYTES) {
    return c.body(text, 200, { "content-type": "text/markdown; charset=utf-8" });
  }
  const cut = buf.subarray(0, ASSEMBLY_MAX_BYTES).toString("utf8");
  const safe = cut.slice(0, Math.max(cut.lastIndexOf("\n"), 0));
  return c.body(
    `${safe}\n\n> ⚠ 组装日志超过 ${ASSEMBLY_MAX_BYTES / 1024}KB，已截断显示。完整内容见本体目录 ASSEMBLY.md。\n`,
    200,
    { "content-type": "text/markdown; charset=utf-8", "x-truncated": "true" },
  );
});

app.get("/api/resources", (c) => {
  try {
    return c.json({ resources: loadResources(path.join(ROOT, "ontology", "resources", "index.yaml")) });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/** 卡壳推荐 v2：阻塞链追溯（推荐缺失前置的资源）+ 失败判准定向。
 *  LLM 只允许从资源注册表内选取并给理由；无 key/失败时回退注册表静态匹配。 */
app.post("/api/recommend", async (c) => {
  if (rateLimited("rec:" + clientKey(c), 20, 60_000)) {
    return c.json({ path: [], picks: [], error: "请求过于频繁" }, 429);
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    skillId?: string;
    skillName?: string;
    packId?: string;
    reportFile?: string;
    blocked?: boolean;
  };
  if (!body.skillId) return c.json({ error: "缺少 skillId" }, 400);

  let all: ReturnType<typeof loadResources> = [];
  try {
    all = loadResources(path.join(ROOT, "ontology", "resources", "index.yaml"));
  } catch {
    return c.json({ path: [], picks: [] });
  }

  // —— 阻塞链：在 pack 前置图 + 报告等级上追溯未达前置（最近缺口优先）——
  type Gap = { skill: string; name: string; needLevel: number; currentLevel: number };
  const gapPath: Gap[] = [];
  let failedCriteria: string[] = [];
  let packSkills: { id: string; name: string; prereqs: { skill: string; minLevel: number }[] }[] = [];
  try {
    const { pack } = loadPack(packDirFor(body.packId));
    packSkills = pack.branches.flatMap((b) =>
      b.skills.map((s) => ({ id: s.id, name: s.name, prereqs: s.prereqs.map((p) => ({ skill: p.skill, minLevel: p.minLevel })) })),
    );
    const levels = new Map<string, number>();
    if (body.reportFile && path.basename(body.reportFile) === body.reportFile && body.reportFile.endsWith(".json")) {
      const rf = path.join(REPORTS_DIR, body.reportFile);
      if (fs.existsSync(rf)) {
        const r = JSON.parse(fs.readFileSync(rf, "utf8")) as {
          assessments?: { skillId: string; level?: number; criteria?: { verdict?: string; text?: string }[] }[];
        };
        for (const a of r.assessments ?? []) {
          levels.set(a.skillId, a.level ?? 0);
          if (a.skillId === body.skillId) {
            failedCriteria = (a.criteria ?? []).filter((x) => x.verdict !== "met").map((x) => String(x.text ?? "")).filter(Boolean).slice(0, 4);
          }
        }
      }
    }
    const byId = new Map(packSkills.map((s) => [s.id, s]));
    const queue: [string, number][] = [[body.skillId, 0]];
    const seen = new Set<string>([body.skillId]);
    while (queue.length > 0 && gapPath.length < 3) {
      const [sid, depth] = queue.shift()!;
      const node = byId.get(sid);
      if (!node) continue;
      for (const pr of node.prereqs) {
        const cur = levels.get(pr.skill) ?? 0;
        if (cur < pr.minLevel) {
          const target = byId.get(pr.skill);
          if (!seen.has(pr.skill)) {
            seen.add(pr.skill);
            gapPath.push({ skill: pr.skill, name: target?.name ?? pr.skill, needLevel: pr.minLevel, currentLevel: cur });
          }
          if (depth < 2) queue.push([pr.skill, depth + 1]);
        }
      }
    }
  } catch {
    // pack/报告不可用时退化为无路径推荐
  }

  const focusIds = gapPath.length > 0 ? gapPath.map((g) => g.skill) : [body.skillId];
  const candidates = all.filter((r) => r.links.some((l) => focusIds.includes(l.skill) || l.skill === body.skillId));
  const fallback = {
    path: gapPath,
    picks: candidates.slice(0, 3).map((r) => ({ id: r.id, title: r.title, url: r.url, type: r.type, reason: r.notes ?? "" })),
  };

  let provider: ReturnType<typeof createProvider> | null = null;
  try {
    provider = createProvider("ustc");
  } catch {
    return c.json(fallback);
  }
  try {
    const system = "你是学习路径顾问。只允许从候选资源表中选取，不得发明任何 URL。理由一句话，直说为什么适合当前卡壳的学习者。";
    const user = `[[AGENT:advisor]]
学习者目标：技能「${body.skillName ?? body.skillId}」${body.blocked ? "（被前置阻塞/未点亮）" : "（想精进）"}
${gapPath.length > 0 ? "阻塞链（先补这些前置）：" + gapPath.map((g) => `${g.name}（需 L${g.needLevel}，现 L${g.currentLevel}）`).join(" → ") : ""}
${failedCriteria.length > 0 ? "目标技能未达成的判准：\n" + failedCriteria.map((t) => "- " + t).join("\n") : ""}
候选资源（id | 标题 | 类型 | 说明）：
${candidates.map((r) => `${r.id} | ${r.title} | ${r.type} | ${r.notes ?? ""}`).join("\n") || "（无候选——表外回答一律禁止，输出空 picks）"}

输出 JSON：{"picks":[{"id":"候选id","reason":"一句话理由，最好点出对应哪条判准或哪个前置缺口"}]}（最多 3 条，优先补前置缺口）`;
    const res = await provider.complete({ system, user, json: true, maxTokens: 4096 });
    const parsed = extractJson(res.text) as { picks?: { id?: string; reason?: string }[] };
    const byId = new Map(candidates.map((r) => [r.id, r]));
    const picks = (parsed.picks ?? [])
      .filter((p) => byId.has(String(p.id)))
      .slice(0, 3)
      .map((p) => {
        const r = byId.get(String(p.id))!;
        return { id: r.id, title: r.title, url: r.url, type: r.type, reason: String(p.reason ?? r.notes ?? "") };
      });
    return c.json({ path: gapPath, picks: picks.length > 0 ? picks : fallback.picks });
  } catch {
    return c.json(fallback);
  }
});

app.get("/api/reports/:file", (c) => {
  const file = c.req.param("file");
  if (path.basename(file) !== file || !file.endsWith(".json")) {
    return c.json({ error: "非法文件名" }, 400);
  }
  const full = path.join(REPORTS_DIR, file);
  if (!fs.existsSync(full)) return c.json({ error: "报告不存在" }, 404);
  return c.body(fs.readFileSync(full, "utf8"), 200, { "content-type": "application/json" });
});

/** 远程仓库直评安全闸：仅 https + 公开托管白名单（github.com/gitee.com），
 *  拒绝凭据/私网/其他 host——克隆目标被锁死在知名公共托管站，SSRF 面收敛为零 */
function assertSafeRepoUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`仓库 URL 不合法: ${raw}`);
  }
  if (url.protocol !== "https:") throw new Error("仓库直评仅支持 https:// URL");
  if (url.username || url.password) throw new Error("仓库 URL 不允许携带凭据");
  const h = url.hostname.toLowerCase();
  if (h !== "github.com" && h !== "gitee.com") {
    throw new Error(`仓库直评仅支持 github.com / gitee.com 公开仓库（收到 ${h}）`);
  }
  if (!/^\/[^/?#]+\/[^/?#]+\/?$/.test(url.pathname)) {
    throw new Error("URL 需形如 https://github.com/<owner>/<repo>");
  }
  return url;
}

/** 浅克隆公开仓库到临时目录（--depth 50 保留近期提交历史，供 git 过程证据通道使用）。
 *  克隆目标以 owner--repo 命名，评测报告的仓库名即呈现 owner--repo 而非临时目录名 */
function shallowClone(url: URL): string {
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const ownerRepo = `${parts[0]}--${parts[1] ?? "repo"}`.replace(/[^\w.-]/g, "-");
  const parent = path.join(os.tmpdir(), `jianmu-eval-${randomUUID().slice(0, 8)}`);
  const target = path.join(parent, ownerRepo);
  execFileSync("git", ["clone", "--depth", "50", url.href, target], {
    timeout: 180_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  return target;
}

app.post("/api/evaluate", async (c) => {
  if (rateLimited("eval:" + clientKey(c), 6, 60_000)) {
    return c.json({ error: "请求过于频繁，请稍后再试（每分钟 6 次）" }, 429);
  }
  if (runningEvals >= MAX_CONCURRENT_EVALS) {
    return c.json({ error: `已有 ${runningEvals} 个评测在跑（上限 ${MAX_CONCURRENT_EVALS}），请等完成再发起` }, 429);
  }
  runningEvals += 1;
  const release = (): void => {
    runningEvals = Math.max(0, runningEvals - 1);
  };
  const body = (await c.req.json().catch(() => ({}))) as {
    repoPath?: string;
    repoUrl?: string;
    provider?: string;
    packId?: string;
    skills?: string[];
    baseReport?: string;
  };
  const repoPath = body.repoPath?.trim();
  const repoUrl = body.repoUrl?.trim();
  if (!repoPath && !repoUrl) {
    release();
    return c.json({ error: "缺少 repoPath 或 repoUrl" }, 400);
  }

  const packDir = packDirFor(body.packId);
  if (!fs.existsSync(packDir)) {
    release();
    return c.json({ error: `技能本体不存在: ${body.packId}` }, 400);
  }
  const providerKind: ProviderKind =
    body.provider === "deepseek" ? "deepseek" : body.provider === "ustc" ? "ustc" : "mock";

  // 专项评测子集的形状闸：字符串数组、id 形状、数量上限——异常形状直接 400，不进流水线
  let scopedSkills: string[] | undefined;
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills)) {
      release();
      return c.json({ error: "skills 必须是技能 id 字符串数组" }, 400);
    }
    const items = body.skills;
    const badShape = items.some((s) => typeof s !== "string" || !/^[A-Za-z][A-Za-z0-9.-]{0,63}$/.test(s));
    if (badShape) {
      release();
      return c.json({ error: "skills 元素须为技能 id（字母开头，字母/数字/点/连字符，≤64 字符）" }, 400);
    }
    if (items.length === 0 || items.length > 64) {
      release();
      return c.json({ error: "skills 数组须含 1-64 个技能 id" }, 400);
    }
    scopedSkills = [...new Set(items as string[])];
  }

  const job: Job = { id: randomUUID(), status: "running", log: [] };
  jobs.set(job.id, job);

  // 解析证据目录：本地路径即时校验；远程 URL 走安全闸 + 异步浅克隆
  let abs: string;
  let clonedDir: string | null = null;
  try {
    if (repoUrl) {
      const url = assertSafeRepoUrl(repoUrl);
      job.log.push({ stage: "clone", message: `浅克隆 ${url.href}（--depth 50，含提交历史）`, percent: 2, at: Date.now() });
      clonedDir = shallowClone(url);
      abs = clonedDir;
    } else {
      abs = path.isAbsolute(repoPath!) ? path.normalize(repoPath!) : path.resolve(ROOT, repoPath!);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        release();
        return c.json({ error: `证据路径不存在或不是目录: ${repoPath}` }, 400);
      }
    }
  } catch (err) {
    job.status = "error";
    job.error = err instanceof Error ? err.message : String(err);
    release();
    return c.json({ id: job.id, error: job.error }, 400);
  }

  runEvaluation({
    repoPath: abs,
    packDir,
    providerKind,
    outDir: REPORTS_DIR,
    skills: scopedSkills,
    baseReportFile: body.baseReport ? path.join(REPORTS_DIR, path.basename(body.baseReport)) : undefined,
    repoUrl: repoUrl || undefined,
    onProgress: (e) => {
      job.log.push({ stage: e.stage, message: e.message, percent: e.percent, at: Date.now() });
      if (e.stage === "done" && e.percent === 100) job.reportFile = path.basename(e.message);
    },
  })
    .then(() => (job.status = "done"))
    .catch((err) => {
      job.status = "error";
      job.error = err instanceof Error ? err.message : String(err);
    })
    .finally(() => {
      // 克隆的临时目录用后即焚（评测已完成，证据已进报告）；克隆在父目录下，删父目录
      if (clonedDir !== null) fs.rmSync(path.dirname(clonedDir), { recursive: true, force: true });
      release();
    });

  return c.json({ id: job.id });
});

app.get("/api/jobs/:id", (c) => {
  const job = jobs.get(c.req.param("id"));
  if (!job) return c.json({ error: "任务不存在" }, 404);
  return c.json(job);
});

// ---------------------------------------------------------------------------
// 静态托管（web 构建产物；开发模式走 vite 5173 + 代理，不需要这里）
// ---------------------------------------------------------------------------

app.get("/", (c) => serveWebFile(c, "index.html"));
app.get("*", (c) => {
  const url = new URL(c.req.url).pathname;
  if (url.startsWith("/api/")) return c.json({ error: "not found" }, 404);
  return serveWebFile(c, url.slice(1));
});

function serveWebFile(c: Parameters<Parameters<typeof app.get>[1]>[0], rel: string): Response {
  const dist = path.resolve(WEB_DIST);
  const target = path.resolve(dist, rel);
  if (target !== dist && !target.startsWith(dist + path.sep)) {
    return c.json({ error: "forbidden" }, 403);
  }
  let file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, "index.html");
  if (!fs.existsSync(file)) {
    return c.text("web 未构建：先运行 pnpm --filter @skilltree/web build，或开发模式使用 pnpm web", 404);
  }
  const ext = path.extname(file);
  const type =
    ext === ".html" ? "text/html; charset=utf-8"
    : ext === ".js" ? "text/javascript; charset=utf-8"
    : ext === ".css" ? "text/css; charset=utf-8"
    : ext === ".svg" ? "image/svg+xml"
    : ext === ".json" ? "application/json"
    : "application/octet-stream";
  return c.body(fs.readFileSync(file), 200, { "content-type": type });
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  // 防御纵深自检：密钥环境变量绝不允许出现在仓库源码或已落盘报告里
  try {
    const keyVal = process.env.USTC_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "";
    if (keyVal.length > 8) {
      const scanDir = (d: string): void => {
        if (!fs.existsSync(d)) return;
        for (const name of fs.readdirSync(d)) {
          if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
          const p = path.join(d, name);
          let st: fs.Stats;
          try {
            st = fs.statSync(p);
          } catch {
            continue;
          }
          if (st.isDirectory()) scanDir(p);
          else if (/\.(ts|tsx|mjs|json|yaml|md)$/.test(name) && st.size < 2_000_000) {
            if (fs.readFileSync(p, "utf8").includes(keyVal)) {
              console.error(`✖ 密钥泄漏自检失败：${path.relative(ROOT, p)} 含密钥值，拒绝启动。`);
              process.exit(1);
            }
          }
        }
      };
      if (fs.existsSync(REPORTS_DIR)) scanDir(REPORTS_DIR);
      scanDir(path.join(ROOT, "apps"));
      scanDir(path.join(ROOT, "packages"));
      scanDir(path.join(ROOT, "scripts"));
    }
  } catch {
    // 自检失败不阻断启动
  }
  console.log(`建木服务已启动: http://127.0.0.1:${info.port}`);
});
