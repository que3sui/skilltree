import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { add, list, complete, remove, stats } from "../src/commands.js";
import { ValidationError } from "../src/validate.js";

// 测试隔离：add/complete 等命令内部会调用 save() 落盘，
// 不重定向的话会污染真实的 ~/.todo.json
process.env.TODO_FILE = path.join(os.tmpdir(), `todo-commands-test-${process.pid}.json`);

function freshStore() {
  return { seq: 0, items: [] };
}

test("add：正常添加并分配自增 id", () => {
  const store = freshStore();
  const a = add(store, { title: "写实验报告", priority: "high" });
  const b = add(store, { title: "  复习线性代数  ", priority: "normal" });
  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
  assert.equal(b.title, "复习线性代数", "标题应去除首尾空白");
  assert.equal(store.items.length, 2);
});

test("add：空标题与超长标题被拒绝", () => {
  const store = freshStore();
  assert.throws(() => add(store, { title: "   " }), ValidationError);
  assert.throws(() => add(store, { title: "x".repeat(201) }), ValidationError);
  assert.equal(store.items.length, 0, "失败的添加不应留下脏数据");
});

test("add：未知优先级被拒绝", () => {
  const store = freshStore();
  assert.throws(() => add(store, { title: "ok", priority: "urgent" }), /未知优先级/);
});

test("list：按优先级分桶排序，桶内保持插入顺序", () => {
  const store = freshStore();
  add(store, { title: "normal-1", priority: "normal" });
  add(store, { title: "high-1", priority: "high" });
  add(store, { title: "normal-2", priority: "normal" });
  add(store, { title: "low-1", priority: "low" });
  const titles = list(store).map((it) => it.title);
  assert.deepEqual(titles, ["high-1", "normal-1", "normal-2", "low-1"]);
});

test("list：默认隐藏已完成，--all 时全部显示", () => {
  const store = freshStore();
  add(store, { title: "t1", priority: "normal" });
  add(store, { title: "t2", priority: "normal" });
  complete(store, { index: 1 });
  assert.equal(list(store).length, 1);
  assert.equal(list(store, { all: true }).length, 2);
});

test("complete：重复完成被拒绝", () => {
  const store = freshStore();
  add(store, { title: "只做一次", priority: "normal" });
  complete(store, { index: 1 });
  assert.throws(() => complete(store, { index: 1 }), /无需重复/);
});

test("complete / remove：越界与非整型序号被拒绝", () => {
  const store = freshStore();
  add(store, { title: "唯一", priority: "normal" });
  assert.throws(() => complete(store, { index: 2 }), /超出范围/);
  assert.throws(() => remove(store, { index: "abc" }), /正整数/);
  assert.throws(() => remove(store, { index: 0 }), /正整数/);
});

test("remove：删除后其余条目不受影响", () => {
  const store = freshStore();
  add(store, { title: "a", priority: "normal" });
  add(store, { title: "b", priority: "normal" });
  const removed = remove(store, { index: 1 });
  assert.equal(removed.title, "a");
  assert.deepEqual(store.items.map((it) => it.title), ["b"]);
});

test("stats：统计数字与待办优先级分布正确", () => {
  const store = freshStore();
  add(store, { title: "1", priority: "high" });
  add(store, { title: "2", priority: "high" });
  add(store, { title: "3", priority: "low" });
  complete(store, { index: 1 });
  const s = stats(store);
  assert.equal(s.total, 3);
  assert.equal(s.done, 1);
  assert.equal(s.pending, 2);
  assert.deepEqual(s.byPriority, { high: 1, low: 1 });
});
