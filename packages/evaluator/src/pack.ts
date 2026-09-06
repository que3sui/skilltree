import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import YAML from "yaml";
import {
  SkillPackSchema,
  SkillSchema,
  checkPack,
  type PackIssue,
  type Skill,
  type SkillPack,
} from "@skilltree/schema";

export interface LoadedPack {
  pack: SkillPack;
  /** 本体内容哈希：写入报告，复现评测时锁定 rubric 版本 */
  contentHash: string;
  issues: PackIssue[];
}

/** 目录条目名白名单（与 digest.ts 同款）：拒绝空名、相对段与分隔符，杜绝越出 pack 根目录 */
function isSafeEntryName(name: string): boolean {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

/** 可复用节点库：ontology/library/<域>/<文件>.yaml，每文件 { nodes: [Skill...] }。
 *  域即层次（common/research/data/design…）；节点与 pack 内技能同构（同一 Skill schema），
 *  组装器（assemble-pack）从这里选材，跨专业复用同一批原子能力。 */
export function loadNodeLibrary(libraryDir: string): Skill[] {
  const absRoot = path.resolve(libraryDir);
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    throw new Error(`节点库目录不存在或不是目录: ${absRoot}`);
  }
  const inRoot = (p: string): boolean => p === absRoot || p.startsWith(absRoot + path.sep);
  const readLibraryFile = (abs: string, nodes: Skill[]): void => {
    if (!inRoot(abs)) throw new Error(`路径越出节点库目录: ${abs}`);
    const parsed = YAML.parse(fs.readFileSync(abs, "utf8")) as { nodes?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.nodes)) throw new Error(`${abs} 缺少顶层 nodes: 列表`);
    for (const raw of parsed.nodes) {
      nodes.push(SkillSchema.parse(raw));
    }
  };
  const nodes: Skill[] = [];
  const entries = fs
    .readdirSync(absRoot, { withFileTypes: true })
    .filter((e) => isSafeEntryName(e.name))
    .sort((a, b) => (a.name < b.name ? -1 : 1)); // 字典序，不用 localeCompare
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const abs = absRoot + path.sep + entry.name;
    if (!inRoot(abs)) continue;
    if (entry.isDirectory()) {
      for (const f of fs
        .readdirSync(abs)
        .filter((n) => isSafeEntryName(n) && (n.endsWith(".yaml") || n.endsWith(".yml")))
        .sort()) {
        readLibraryFile(abs + path.sep + f, nodes);
      }
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      readLibraryFile(abs, nodes);
    }
  }
  return nodes;
}

/** 学习资源索引条目：URL 只收录权威公开来源；LLM 推荐只允许从表内选取 */
export interface ResourceEntry {
  id: string;
  title: string;
  url: string;
  type: string;
  notes?: string;
  links: { skill: string; minLevel: number }[];
}

/** 加载学习资源索引（ontology/resources/index.yaml）。轻校验：必需字段与 links 结构。 */
export function loadResources(file: string): ResourceEntry[] {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) return [];
  const parsed = YAML.parse(fs.readFileSync(abs, "utf8")) as { resources?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.resources)) throw new Error("resources/index.yaml 缺少顶层 resources: 列表");
  return parsed.resources.map((r) => {
    const e = r as ResourceEntry;
    if (!e.id || !e.title || !e.url || !Array.isArray(e.links)) {
      throw new Error(`资源条目不完整：${e.id ?? e.title ?? "?"}（需 id/title/url/links）`);
    }
    return e;
  });
}

/** 加载技能包：pack.yaml（元信息）+ branches/*.yaml（分支），合并后走完整 schema/一致性校验。
 *  路径纪律与 digest.ts 相同：根目录一次解析；绝对路径用 `root + path.sep + 白名单名` 拼接
 *  （不在污染输入上 path.join）并逐个断言 p === absRoot || p.startsWith(absRoot + path.sep)。 */
export function loadPack(packDir: string): LoadedPack {
  const absRoot = path.resolve(packDir);
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    throw new Error(`pack 目录不存在或不是目录: ${absRoot}`);
  }
  const inRoot = (p: string): boolean => p === absRoot || p.startsWith(absRoot + path.sep);

  const metaPath = absRoot + path.sep + "pack.yaml";
  if (!inRoot(metaPath)) throw new Error(`路径越出 pack 目录: ${metaPath}`);
  if (!fs.existsSync(metaPath)) {
    throw new Error(`找不到 ${metaPath}——pack 目录需包含 pack.yaml 与 branches/`);
  }
  const meta = YAML.parse(fs.readFileSync(metaPath, "utf8")) as Record<string, unknown>;

  const branchDir = absRoot + path.sep + "branches";
  if (!inRoot(branchDir)) throw new Error(`路径越出 pack 目录: ${branchDir}`);
  const branchFiles = fs.existsSync(branchDir)
    ? fs.readdirSync(branchDir)
        .filter((f) => isSafeEntryName(f) && (f.endsWith(".yaml") || f.endsWith(".yml")))
        .sort()
    : [];
  if (branchFiles.length === 0) {
    throw new Error(`branches/ 目录为空：${branchDir}`);
  }
  const branches = branchFiles.map((f) => {
    const abs = branchDir + path.sep + f;
    if (!inRoot(abs)) throw new Error(`路径越出 pack 目录: ${abs}`);
    const parsed = YAML.parse(fs.readFileSync(abs, "utf8")) as {
      branch?: unknown;
    };
    if (!parsed?.branch) throw new Error(`${f} 缺少顶层 branch: 字段`);
    return parsed.branch;
  });

  const pack = SkillPackSchema.parse({ ...meta, branches });
  const issues = checkPack(pack);
  const contentHash = hashPackDir(absRoot);
  return { pack, contentHash, issues };
}

/** 目录内容的确定性哈希（对文件相对路径+内容依次摘要）。
 *  遍历纪律同上：`d + path.sep + 白名单名` 拼接并断言界内；跳过符号链接；条目名默认字典序（不用比较器）。 */
export function hashPackDir(dir: string): string {
  const absRoot = path.resolve(dir);
  const inRoot = (p: string): boolean => p === absRoot || p.startsWith(absRoot + path.sep);
  const h = createHash("sha256");
  const walk = (d: string, prefix: string): void => {
    if (!inRoot(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    const names = entries.map((e) => e.name).sort();
    for (const name of names) {
      if (!isSafeEntryName(name)) continue;
      const entry = entries.find((e) => e.name === name)!;
      if (entry.isSymbolicLink()) continue;
      const rel = prefix ? `${prefix}/${name}` : name;
      const absChild = d + path.sep + name;
      if (!inRoot(absChild)) continue;
      if (entry.isDirectory()) walk(absChild, rel);
      else {
        h.update(rel);
        h.update("\0");
        h.update(fs.readFileSync(absChild));
        h.update("\0");
      }
    }
  };
  walk(absRoot, "");
  return h.digest("hex").slice(0, 16);
}
