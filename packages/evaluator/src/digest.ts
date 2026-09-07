import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export interface DigestFile {
  path: string;
  lines: number;
  truncated: boolean;
  content: string;
}

/** 过程证据：git 提交历史摘要（目录无 .git 时缺席——不改变无 git 仓库的行为） */
export interface GitHistory {
  commits: number;
  firstAt: string;
  lastAt: string;
  spanDays: number;
  /** 最近提交主题（最多 30 条，旧→新） */
  subjects: string[];
  /** 单日最大提交占比：1.0 = 全部提交挤在同一天（一次性倾倒嫌疑） */
  maxDayRatio: number;
  /** 有信息量的提交主题占比（长度 ≥ 8 视为非 "fix/update" 一类的敷衍信息） */
  informativeRatio: number;
}

export interface Digest {
  root: string;
  name: string;
  fileCount: number;
  totalLines: number;
  files: DigestFile[];
  /** 过程证据通道：目录含 .git 时收集 */
  git?: GitHistory;
  /** 拼装好的只读文本视图（供模型/规则使用），带总预算截断标记 */
  text: string;
  textTruncated: boolean;
  hash: string;
}

const EXCLUDED_DIRS = new Set([
  ".git", ".mimosa", "node_modules", "dist", "build", "out", "coverage", ".venv", "venv",
  "__pycache__", ".idea", ".vscode", ".next", "target", "vendor", ".gradle",
]);

/**
 * 机密文件排除：命中即不进证据摘要（也不会被发送给模型端点）。
 * 保守取向——宁可漏收一个普通文件，绝不把密钥送出边界。
 */
const EXCLUDE_FILE_RE = /(^|[/\\])(\.env[^/\\]*|.*\.(pem|key)|.*credentials?[^/\\]*|.*secrets?[^/\\]*)$/i;

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".zip", ".gz", ".tar", ".rar",
  ".pdf", ".exe", ".dll", ".so", ".dylib", ".bin", ".woff", ".woff2", ".ttf",
  ".mp3", ".mp4", ".mov", ".sqlite", ".db", ".class", ".jar", ".pyc", ".wasm",
]);

function priorityOf(rel: string): number {
  const base = path.basename(rel).toLowerCase();
  if (base.startsWith("readme")) return 0;
  if (["package.json", "pyproject.toml", "cargo.toml", "go.mod", "pom.xml", "makefile"].includes(base)) return 1;
  if (/(^|\/)(src|lib|app|source)\//i.test(rel)) return 2;
  if (/(^|\/)(test|tests|spec|__tests__)\//i.test(rel)) return 3;
  if (/\.(md|txt|rst)$/i.test(base)) return 4;
  return 5;
}

/** 目录条目名白名单：拒绝空名、路径分隔符与相对段，杜绝任何越出证据根目录的可能 */
function isSafeEntryName(name: string): boolean {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

interface Candidate {
  rel: string;
  abs: string;
}

/** 解析 `git log --date=short --pretty=%ad<TAB>%s` 输出为历史摘要（纯函数，可测） */
export function parseGitLog(out: string): GitHistory {
  const rows = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [date, subject] = l.split("\t");
      return { date: (date ?? "").trim(), subject: (subject ?? "").trim() };
    })
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
  if (rows.length === 0) {
    return { commits: 0, firstAt: "", lastAt: "", spanDays: 0, subjects: [], maxDayRatio: 0, informativeRatio: 0 };
  }
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.date, (byDay.get(r.date) ?? 0) + 1);
  const days = [...byDay.keys()].sort();
  const informative = rows.filter((r) => r.subject.replace(/[^\u4e00-\u9fa5a-z0-9]/gi, "").length >= 8).length;
  const first = new Date(days[0]!).getTime();
  const last = new Date(days[days.length - 1]!).getTime();
  return {
    commits: rows.length,
    firstAt: days[0]!,
    lastAt: days[days.length - 1]!,
    spanDays: Math.round((last - first) / 86_400_000),
    subjects: rows.slice(-30).map((r) => r.subject),
    maxDayRatio: Math.max(...byDay.values()) / rows.length,
    informativeRatio: informative / rows.length,
  };
}

/** 收集目录的 git 历史（非 git 目录/失败时返回 undefined，绝不抛出） */
function collectGit(absRoot: string): GitHistory | undefined {
  try {
    const out = execFileSync("git", ["-C", absRoot, "log", "--date=short", "--pretty=%ad	%s"], {
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 4 << 20,
      stdio: ["ignore", "pipe", "ignore"],
    }) as string;
    const g = parseGitLog(out);
    return g.commits > 0 ? g : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 把本地目录折叠成一份有预算的证据摘要。
 * 确定性：同一目录内容 → 同一摘要 → 同一 hash（写入报告作为证据指纹）。
 * 只读取真实文件：跳过符号链接；所有绝对路径在遍历处一次性生成并断言
 * `p === absRoot || p.startsWith(absRoot + path.sep)`，读取时复用，不再二次拼接。
 */
export function buildDigest(root: string, opts: DigestOptions = {}): Digest {
  const perFileCharLimit = opts.perFileCharLimit ?? 12_000;
  const totalCharBudget = opts.totalCharBudget ?? 90_000;
  // 资源上限：枚举文件数与目录深度封顶，防超大目录树把评测拖成 DoS；
  // 遍历按名字排序的确定性 DFS，因此截断后的子集对同一棵树仍然确定（同树 → 同摘要 → 同哈希）
  const MAX_FILES = 5000;
  const MAX_DEPTH = 12;

  const absRoot = path.resolve(root);
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    throw new Error(`证据路径不存在或不是目录: ${absRoot}`);
  }

  const inRoot = (p: string): boolean => p === absRoot || p.startsWith(absRoot + path.sep);

  const candidates: Candidate[] = [];
  const walk = (dir: string, depth: number): void => {
    if (!inRoot(dir) || depth > MAX_DEPTH || candidates.length >= MAX_FILES) return;
    const entries = [...fs.readdirSync(dir, { withFileTypes: true })].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (!isSafeEntryName(entry.name)) continue;
      if (entry.isSymbolicLink()) continue;
      const absChild = dir + path.sep + entry.name;
      if (!inRoot(absChild)) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(absChild, depth + 1);
        continue;
      }
      if (BINARY_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
      if (EXCLUDE_FILE_RE.test(entry.name)) continue; // 机密文件不进证据、不出边界
      candidates.push({ rel: path.relative(absRoot, absChild).replaceAll("\\", "/"), abs: absChild });
      if (candidates.length >= MAX_FILES) return; // 资源上限：枚举封顶
    }
  };
  walk(absRoot, 0);
  candidates.sort((a, b) => priorityOf(a.rel) - priorityOf(b.rel) || a.rel.localeCompare(b.rel));

  const files: DigestFile[] = [];
  const h = createHash("sha256");
  let used = 0;
  let textTruncated = false;
  let totalLines = 0;

  for (const { rel, abs } of candidates) {
    if (!inRoot(abs)) continue; // 读取前最终断言
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.size > 1_000_000) continue; // 超大文件不进摘要
    let raw: string;
    try {
      raw = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (raw.includes("\u0000")) continue; // 伪文本的二进制
    const lineCount = raw.split("\n").length;
    totalLines += lineCount;

    let content = raw;
    let truncated = false;
    if (content.length > perFileCharLimit) {
      content = `${content.slice(0, perFileCharLimit)}\n…[文件截断，共 ${raw.length} 字符]`;
      truncated = true;
    }
    const block = `===== FILE: ${rel} (${lineCount} 行) =====\n${content}`;
    if (used + block.length > totalCharBudget) {
      textTruncated = true;
      // 高优先级文件尽量保留：跳过超出预算的低优先级文件
      if (priorityOf(rel) >= 2) continue;
    }
    used += block.length;
    files.push({ path: rel, lines: lineCount, truncated, content });
    // 指纹必须覆盖内容本身：只哈希路径+行数时，同行数的内容篡改不可见
    h.update(rel);
    h.update("\0");
    h.update(truncated ? "t" : "f");
    h.update("\0");
    h.update(content);
    h.update("\0");
  }

  const git = collectGit(absRoot);
  const gitBlock =
    git !== undefined
      ? `\n\n===== GIT HISTORY（过程证据）=====\n提交 ${git.commits} 次，跨度 ${git.spanDays} 天（${git.firstAt} → ${git.lastAt}）\n单日最大提交占比 ${(git.maxDayRatio * 100).toFixed(0)}%（1.0=全部挤在同一天）\n有信息量的提交说明占比 ${(git.informativeRatio * 100).toFixed(0)}%\n最近提交主题：\n${git.subjects.map((s) => "- " + s).join("\n")}`
      : "";

  const text =
    files.map((f) => `===== FILE: ${f.path} (${f.lines} 行${f.truncated ? "，已截断" : ""}) =====\n${f.content}`).join("\n\n") +
    gitBlock +
    (textTruncated ? "\n\n===== 注意：部分文件因预算未纳入摘要 =====" : "");

  return {
    root: absRoot,
    name: path.basename(absRoot),
    fileCount: candidates.length,
    totalLines,
    files,
    git,
    text,
    textTruncated,
    hash: h.digest("hex").slice(0, 16),
  };
}
