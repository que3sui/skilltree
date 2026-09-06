/**
 * 打包静态演示数据：技能本体 + 精选评测报告 → 两个输出位
 *   apps/web/public/demo/   → 构建时拷入 dist（http 场景下可被 fetch 的副本）
 *   apps/web/src/demo-data/ → 构建时经 import.meta.glob 嵌入 JS 包
 *                             （file:// 双击打开时 fetch 被浏览器禁止，嵌入层兜底）
 * 产物随 vite build 进入 dist，静态托管（无本地服务、无 API key、甚至直接双击
 * index.html）也能完整浏览双视图与真实模型评测报告。
 *
 * 选片规则：reports/ 下按（证据仓库 × 模型）分组，各组取最新一份。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack } from "../packages/evaluator/src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PACK_DIR = path.join(ROOT, "ontology", "packs", "cs");
const REPORTS_DIR = path.join(ROOT, "reports");
const OUT_PUBLIC = path.join(ROOT, "apps", "web", "public", "demo");
const OUT_SRC = path.join(ROOT, "apps", "web", "src", "demo-data");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeName(name) {
  return name.replaceAll(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
}

function writeBoth(rel, content) {
  for (const base of [OUT_PUBLIC, OUT_SRC]) {
    const target = path.join(base, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
}

function main() {
  const { pack } = loadPack(PACK_DIR);

  const files = fs.existsSync(REPORTS_DIR) ? fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json")) : [];
  if (files.length === 0) {
    console.error("reports/ 下没有评测报告：先运行 pnpm evaluate 或 pnpm eval:regression 生成至少一份");
    process.exit(1);
  }

  const parsed = files.map((file) => {
    const r = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), "utf8"));
    return { file, r };
  });

  // 每组（仓库 × 模型）保留 createdAt 最新的一份
  const latest = new Map();
  for (const { file, r } of parsed) {
    const key = `${r.evidence?.name ?? "?"}|${r.model?.provider ?? "?"}`;
    const prev = latest.get(key);
    if (!prev || String(r.createdAt) > String(prev.r.createdAt)) {
      latest.set(key, { file, r });
    }
  }

  for (const base of [OUT_PUBLIC, OUT_SRC]) {
    ensureDir(base);
    fs.rmSync(path.join(base, "reports"), { recursive: true, force: true });
  }
  for (const old of fs.readdirSync(OUT_PUBLIC)) {
    if (old !== "reports") fs.rmSync(path.join(OUT_PUBLIC, old), { recursive: true, force: true });
  }

  const manifest = [];
  for (const { r } of [...latest.values()].sort((a, b) => String(b.r.createdAt).localeCompare(String(a.r.createdAt)))) {
    const demoFile = `${safeName(r.evidence.name)}-${r.model.provider}.json`;
    writeBoth(path.join("reports", demoFile), JSON.stringify(r));
    manifest.push({
      file: demoFile,
      id: r.id,
      repoName: r.evidence?.name ?? "?",
      createdAt: r.createdAt,
      provider: r.model?.provider ?? "?",
      risk: r.redteam?.overallRisk ?? "low",
      lit: r.stats?.litSkills ?? 0,
      total: r.stats?.totalSkills ?? 0,
    });
  }

  writeBoth("pack.json", JSON.stringify({ pack, issues: [] }));
  writeBoth("index.json", JSON.stringify({ reports: manifest }));

  console.log(`演示数据已打包 → public/demo/（fetch 层）+ src/demo-data/（嵌入层）`);
  for (const m of manifest) {
    console.log(`  ${m.repoName} · ${m.provider} · ${m.lit}/${m.total} · risk=${m.risk}`);
  }
}

main();
