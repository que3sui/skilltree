import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load, save, resolveStorePath, StoreError } from "../src/store.js";

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "todo-test-")), "store.json");
}

test("load：文件不存在时返回空存储", () => {
  const empty = load(path.join(tmpFile(), "not-exist.json"));
  assert.deepEqual(empty, { seq: 0, items: [] });
});

test("save → load 往返一致", () => {
  const file = tmpFile();
  save({ seq: 2, items: [{ id: 1, title: "a" }, { id: 2, title: "b" }] }, file);
  const data = load(file);
  assert.equal(data.seq, 2);
  assert.equal(data.items.length, 2);
  assert.equal(data.items[1].title, "b");
});

test("save：损坏的旧文件不会损坏新数据", () => {
  const file = tmpFile();
  fs.writeFileSync(file, "{not-json", "utf8");
  assert.throws(() => load(file), StoreError);
  // 用户删除损坏文件后可继续使用
  fs.rmSync(file);
  save({ seq: 1, items: [] }, file);
  assert.equal(load(file).seq, 1);
});

test("save：原子写入不留临时文件", () => {
  const file = tmpFile();
  save({ seq: 0, items: [] }, file);
  const leftovers = fs.readdirSync(path.dirname(file)).filter((f) => f.includes(".tmp"));
  assert.deepEqual(leftovers, [], "临时文件应被 rename 消化或清理");
});

test("resolveStorePath：TODO_FILE 环境变量覆盖默认路径", () => {
  const p = resolveStorePath({ TODO_FILE: "relative/path.json" });
  assert.ok(path.isAbsolute(p), "自定义路径应被解析为绝对路径");
  const def = resolveStorePath({});
  assert.ok(def.endsWith(".todo.json"));
});
