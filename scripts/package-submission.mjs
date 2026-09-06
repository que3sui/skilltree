/**
 * 一〇七杯提交打包：源码（git 已追踪文件）+ 静态演示包 + 四件材料 → 单个 zip。
 *
 * 用法：
 *   pnpm demo:build                                # 先确保 dist 是最新（含内置报告）
 *   pnpm exec tsx scripts/package-submission.mjs [--name "队长学号+队长手机号+智能体赛道+本科生队伍"]
 *
 * 前置：
 *   - git add -A 已完成（以 git ls-files 为打包清单，天然排除 node_modules/.mimosa/env 等）
 *   - submission/ 演示视频.mp4 已就位（可选；缺失时仅警告并照常打包其余材料）
 * 输出：
 *   submission/<命名或默认名>.zip —— 按 §0 硬约束，上传瀚海教学网并分享给 P0581
 *   （勾选允许复制、允许下载；上传必须队长本人操作）
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SUB = path.join(ROOT, "submission");
const STAGE = path.join(SUB, "提交包");

const args = process.argv.slice(2);
const nameIdx = args.indexOf("--name");
const zipName =
  nameIdx !== -1 && args[nameIdx + 1] ? args[nameIdx + 1] : "队长学号+队长手机号+智能体赛道+本科生队伍";

function main() {
  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    // .mimosa 是安全扫描器的工作产物（会话留痕/裁决账本），任意层级都不进提交包
    .filter((f) => !/(^|\/)\.mimosa\//.test(f));
  if (tracked.length === 0) {
    console.error("git 没有已追踪文件：先 git add -A（提交本身可等钩子问题解决）");
    process.exit(1);
  }

  // 安全红线：打包清单里绝不许出现 .env / 密钥类文件
  const forbidden = tracked.filter((f) => /(^|\/)\.env(\.|$)|\.pem$|\.key$/i.test(f));
  if (forbidden.length > 0) {
    console.error(`发现疑似密钥文件，拒绝打包：${forbidden.join(", ")}`);
    process.exit(1);
  }

  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(path.join(STAGE, "源码"), { recursive: true });
  fs.mkdirSync(path.join(STAGE, "静态演示包"), { recursive: true });
  fs.mkdirSync(path.join(STAGE, "材料"), { recursive: true });

  for (const rel of tracked) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue; // 已删除未提交的路径
    const dest = path.join(STAGE, "源码", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  console.log(`源码：${tracked.length} 个已追踪文件`);

  const dist = path.join(ROOT, "apps", "web", "dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    console.error("apps/web/dist 缺失：先运行 pnpm demo:build");
    process.exit(1);
  }
  copyDir(dist, path.join(STAGE, "静态演示包"));
  console.log("静态演示包：apps/web/dist（零后端零 key，双击 index.html 或任一静态托管）");

  const materials = [
    ["设计文档.docx", "设计文档（含大赛提交版摘要）"],
    ["作品简介.docx", "作品简介"],
  ];
  for (const [file, label] of materials) {
    const src = path.join(SUB, file);
    if (!fs.existsSync(src)) {
      console.error(`材料缺失：submission/${file}`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(STAGE, "材料", file));
    console.log(`材料：${label} ✓`);
  }
  const video = path.join(SUB, "演示视频.mp4");
  if (fs.existsSync(video)) {
    fs.copyFileSync(video, path.join(STAGE, "材料", "演示视频.mp4"));
    console.log("材料：演示视频 ✓");
  } else {
    console.warn("⚠ submission/演示视频.mp4 不存在——本轮打的是无视频版，上传前必须补！");
  }

  const zipPath = path.join(SUB, `${zipName}.zip`);
  fs.rmSync(zipPath, { force: true });
  // 不用 PowerShell Compress-Archive：WinPS 5.1 写出的条目是反斜杠分隔，
  // 7-Zip/非 Windows 解压器不认，评委端会解出平铺乱名文件。纯 Node 写标准 zip。
  const entryCount = zipDir(STAGE, zipPath);
  // 暂存目录是一次性中间物（zip 才是交付物）；遗留会每次打包都触发安全扫描
  // 对构建产物的误报（browser bundle 的 fetch 被判 SSRF，裁决见 REVIEW.md 误报裁决记录）
  fs.rmSync(STAGE, { recursive: true, force: true });
  const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n提交包已生成：submission/${zipName}.zip（${sizeMb} MB，${entryCount} 个条目，正斜杠 + UTF-8 名称）`);
  console.log("下一步（必须队长本人）：瀚海教学网 v.ustc.edu.cn → 我的资源 → 文件 → 上传 → 分享给 P0581（勾选允许复制+允许下载）");
}

/* ---------------- 标准 zip 写入（store/deflate，UTF-8 名称位） ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipDir(rootDir, outPath) {
  const files = [];
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(path.join(dir, e.name), prefix + e.name + "/");
      else files.push({ abs: path.join(dir, e.name), name: prefix + e.name });
    }
  };
  walk(rootDir, "");

  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const nameBuf = Buffer.from(f.name, "utf8");
    const crc = crc32(data);
    const { mtime } = fs.statSync(f.abs);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 名称位
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime(mtime), 10);
    local.writeUInt16LE(dosDate(mtime), 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, payload);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(dosTime(mtime), 12);
    cd.writeUInt16LE(dosDate(mtime), 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra len
    cd.writeUInt16LE(0, 32); // comment len
    cd.writeUInt16LE(0, 34); // disk start
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += 30 + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  fs.writeFileSync(outPath, Buffer.concat([...chunks, centralBuf, eocd]));
  return files.length;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

main();
