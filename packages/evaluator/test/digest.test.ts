import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDigest, parseGitLog } from "../src/digest.js";

function tmpRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "digest-test-"));
}

test("digest：排除 node_modules/.git，README 优先排序", () => {
  const root = tmpRepo();
  fs.mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "node_modules", "pkg", "index.js"), "junk");
  fs.writeFileSync(path.join(root, ".git", "config"), "junk");
  fs.writeFileSync(path.join(root, "README.md"), "# demo");
  fs.writeFileSync(path.join(root, "src", "main.js"), "export const a = 1;");

  const d = buildDigest(root);
  const paths = d.files.map((f) => f.path);
  assert.deepEqual(paths, ["README.md", path.join("src", "main.js").replaceAll("\\", "/")]);
  assert.equal(d.files[0]!.content.includes("# demo"), true);
});

test("digest：确定性——同一目录两次摘要 hash 一致，内容变更则 hash 变化", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "a.js"), "const x = 1;");
  const d1 = buildDigest(root);
  const d2 = buildDigest(root);
  assert.equal(d1.hash, d2.hash);
  fs.writeFileSync(path.join(root, "a.js"), "const x = 2;");
  assert.notEqual(buildDigest(root).hash, d1.hash);
});

test("digest：超长文件按预算截断并留标记", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "big.js"), "x\n".repeat(5000));
  const d = buildDigest(root, { perFileCharLimit: 200 });
  const big = d.files.find((f) => f.path === "big.js")!;
  assert.equal(big.truncated, true);
  assert.ok(big.content.includes("[文件截断"));
});

test("digest：符号链接被跳过（不跟随出根目录）", () => {
  const root = tmpRepo();
  const outside = tmpRepo();
  fs.writeFileSync(path.join(outside, "secret.txt"), "outside");
  fs.writeFileSync(path.join(root, "inside.js"), "ok");
  let linked = false;
  try {
    fs.symlinkSync(path.join(outside, "secret.txt"), path.join(root, "leak.txt"), "file");
    linked = true;
  } catch {
    // Windows 无开发者模式时创建符号链接会失败：此时跳过该断言
  }
  const d = buildDigest(root);
  const paths = d.files.map((f) => f.path);
  assert.ok(paths.includes("inside.js"));
  if (linked) assert.ok(!paths.includes("leak.txt"));
  fs.rmSync(outside, { recursive: true, force: true });
});

test("digest：证据路径必须是存在的目录", () => {
  assert.throws(() => buildDigest(path.join(tmpRepo(), "nope")), /不存在/);
});

test("parseGitLog：渐进历史与一次性倾倒的区分", () => {
  const gradual = ["2026-01-01\tinit project skeleton", "2026-01-03\timplement storage layer with tests", "2026-01-09\tadd statistics command"].join("\n");
  const g = parseGitLog(gradual);
  assert.equal(g.commits, 3);
  assert.equal(g.spanDays, 8);
  assert.ok(Math.abs(g.maxDayRatio - 1 / 3) < 1e-9);
  assert.equal(g.informativeRatio, 1);

  const dump = ["2026-01-10\tfix", "2026-01-10\tupdate", "2026-01-10\tfinal version submit"].join("\n");
  const d = parseGitLog(dump);
  assert.equal(d.maxDayRatio, 1);
  assert.equal(d.spanDays, 0);
  assert.ok(d.informativeRatio < 1);
});

test("parseGitLog：空/非法输入归零", () => {
  assert.equal(parseGitLog("").commits, 0);
  assert.equal(parseGitLog("not-a-date\tsomething").commits, 0);
});

test("digest：无 .git 目录时 git 通道缺席且行为不变", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "a.js"), "console.log(1)\n");
  const d = buildDigest(root);
  assert.equal(d.git, undefined);
  assert.ok(!d.text.includes("GIT HISTORY"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("digest：机密文件不进证据、不进文本视图", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "app.js"), "console.log('ok')\n");
  fs.writeFileSync(path.join(root, ".env"), "API_KEY=sk-should-never-leave\n");
  fs.writeFileSync(path.join(root, "server.pem"), "-----BEGIN PRIVATE KEY-----\n");
  fs.writeFileSync(path.join(root, "db-credentials.yaml"), "password: hunter2\n");
  fs.mkdirSync(path.join(root, "config"));
  fs.writeFileSync(path.join(root, "config", "secret_token.txt"), "token=abc\n");
  // 工具工作目录（安全钩子/IDE）不属于项目证据
  fs.mkdirSync(path.join(root, ".mimosa", "hook-state"), { recursive: true });
  fs.writeFileSync(path.join(root, ".mimosa", "hook-state", "sess.json"), "{}");
  const d = buildDigest(root);
  const paths = d.files.map((f) => f.path);
  assert.ok(paths.includes("app.js"));
  for (const p of paths) {
    assert.ok(!/\.env|\.pem|credential|secret|\.mimosa/.test(p), `非证据文件混入摘要: ${p}`);
  }
  assert.ok(!d.text.includes("sk-should-never-leave"));
  assert.ok(!d.text.includes("hunter2"));
  fs.rmSync(root, { recursive: true, force: true });
});
