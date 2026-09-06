#!/usr/bin/env node
/**
 * 架构边界静态检查（gate 环节）：docs/ARCHITECTURE.zh.md 的依赖方向规则成文即执法。
 * 规则：
 *   web     → 只可依赖 packages/schema（与自身）
 *   server  → 可依赖 packages/evaluator、packages/schema
 *   evaluator/packages → 只可依赖 packages/schema（禁止 apps/、禁止 scripts/）
 *   任何运行时代码禁止 import scripts/
 * 违规即退出码 1（gate 红）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const violations = [];

const IMPORT_RE = /(?:import|export)[^'"`]*from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

function collectRules(srcDir) {
  const rel = path.relative(ROOT, srcDir).replaceAll("\\", "/");
  if (rel.startsWith("apps/web")) return { name: "web", forbidden: [/^@skilltree\/(evaluator|server)$/, /\.\.\/\.\.\/packages\/evaluator/, /^apps\/server/, /\.\.\/\.\.\/server/] };
  if (rel.startsWith("apps/server")) return { name: "server", forbidden: [/^@?skilltree\/web$|apps\/web|\.\.\/\.\.\/web/, /^apps\//] };
  if (rel.startsWith("packages/")) return { name: "packages", forbidden: [/apps\/(web|server)/, /\.\.\/\.\.\/apps\//, /(^|\/)\.\.\/\.\.\/scripts\//, /^scripts\//] };
  return null;
}

function walk(dir) {
  const rule = collectRules(dir);
  if (!rule) return;
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      if (entry.isDirectory()) stack.push(abs);
      else if (/\.(ts|tsx|mts|mjs)$/.test(entry.name)) {
        const text = fs.readFileSync(abs, "utf8");
        for (const m of text.matchAll(IMPORT_RE)) {
          const spec = m[1] ?? m[2] ?? m[3] ?? "";
          if (rule.forbidden.some((re) => re.test(spec))) {
            violations.push(`${rule.name} 违规：${path.relative(ROOT, abs)} → ${spec}`);
          }
        }
      }
    }
  }
}

walk(path.join(ROOT, "apps", "web", "src"));
walk(path.join(ROOT, "apps", "server", "src"));
walk(path.join(ROOT, "packages", "evaluator", "src"));
walk(path.join(ROOT, "packages", "schema", "src"));

if (violations.length > 0) {
  console.error("✖ 架构边界违规（docs/ARCHITECTURE.zh.md §1）：");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("✓ 架构边界检查通过（web/server/packages/scripts 依赖方向合法）");
