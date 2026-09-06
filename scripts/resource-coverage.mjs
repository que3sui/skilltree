#!/usr/bin/env node
/**
 * 资源覆盖报告：列出各 pack 中没有学习资源关联的节点——数据债可见化。
 * 运行：pnpm resource:coverage   （退出码恒为 0；纯报告工具）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack, loadResources } from "../packages/evaluator/src/index.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const res = loadResources(path.join(ROOT, "ontology", "resources", "index.yaml"));
const covered = new Set(res.flatMap((r) => r.links.map((l) => l.skill)));

const packsDir = path.join(ROOT, "ontology", "packs");
let totalMissing = 0;
for (const dir of fs.readdirSync(packsDir).sort()) {
  try {
    const { pack } = loadPack(path.join(packsDir, dir));
    const missing = [];
    for (const b of pack.branches) {
      for (const s of b.skills) {
        if (!covered.has(s.id)) missing.push(`${s.id}（${s.name}）`);
      }
    }
    const total = pack.branches.reduce((n, b) => n + b.skills.length, 0);
    console.log(`${pack.name} [${pack.id}]：覆盖 ${total - missing.length}/${total}`);
    if (missing.length > 0) {
      for (const m of missing) console.log(`  ✗ ${m}`);
      totalMissing += missing.length;
    }
  } catch (e) {
    console.log(`${dir}：（加载失败：${e instanceof Error ? e.message : e}）`);
  }
}
console.log(`\n资源库共 ${res.length} 条；缺资源节点合计 ${totalMissing} 个。`);
