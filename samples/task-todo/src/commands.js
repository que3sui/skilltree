import { load, save } from "./store.js";
import { parseTitle, parsePriority, parseIndex, priorityWeight, ValidationError } from "./validate.js";

/**
 * 业务规则层：只操作数据结构，不碰文件系统细节（store 注入 path 即可测试）。
 * 返回给展示层的数据都是已经排好序、标好序号的纯数据。
 */

export function add(store, { title, priority }) {
  const cleanTitle = parseTitle(title);
  const cleanPriority = parsePriority(priority);
  const item = {
    id: store.seq + 1,
    title: cleanTitle,
    priority: cleanPriority,
    done: false,
    createdAt: new Date().toISOString(),
    doneAt: null,
  };
  store.seq = item.id;
  store.items.push(item);
  save(store);
  return item;
}

export function list(store, { all = false } = {}) {
  const visible = store.items.filter((it) => all || !it.done);
  // O(n) 分桶替代全量比较排序：只有 3 个优先级桶，桶内保持插入序
  const buckets = new Map();
  for (const it of visible) {
    const w = priorityWeight(it.priority);
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w).push(it);
  }
  const sorted = [...buckets.keys()].sort((a, b) => b - a).flatMap((w) => buckets.get(w));
  return sorted.map((it, i) => ({ index: i + 1, ...it }));
}

export function complete(store, { index }) {
  const items = list(store, { all: true });
  const target = items[parseIndex(index, items.length) - 1];
  // list 返回的是带序号的展示副本；真正要改的是 store 里同 id 的原始条目
  const original = store.items.find((it) => it.id === target.id);
  if (!original) throw new ValidationError(`内部错误：找不到条目 #${target.id}`);
  if (original.done) throw new ValidationError(`第 ${index} 项已完成（${original.title}），无需重复操作`);
  original.done = true;
  original.doneAt = new Date().toISOString();
  save(store);
  return original;
}

export function remove(store, { index }) {
  const items = list(store, { all: true });
  const target = items[parseIndex(index, items.length) - 1];
  store.items = store.items.filter((it) => it.id !== target.id);
  save(store);
  return target;
}

export function stats(store) {
  const total = store.items.length;
  const done = store.items.filter((it) => it.done).length;
  const byPriority = {};
  for (const it of store.items) {
    if (!it.done) byPriority[it.priority] = (byPriority[it.priority] ?? 0) + 1;
  }
  return { total, done, pending: total - done, byPriority };
}
