import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * @typedef {{ seq: number, items: Array<Record<string, unknown>> }} Store
 */

const DEFAULT_FILE = path.join(os.homedir(), ".todo.json");

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveStorePath(env = process.env) {
  const custom = env.TODO_FILE?.trim();
  return custom ? path.resolve(custom) : DEFAULT_FILE;
}

/**
 * @param {string} [filePath]
 * @returns {Store}
 */
export function load(filePath = resolveStorePath()) {
  if (!fs.existsSync(filePath)) return { seq: 0, items: [] };
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new StoreError(`无法读取存储文件 ${filePath}: ${err.message}`);
  }
  if (raw.trim() === "") return { seq: 0, items: [] };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new StoreError(`存储文件损坏（不是合法 JSON）：${filePath}。已保留原文件，修复或删除后重试。`);
  }
  if (typeof data !== "object" || data === null || !Array.isArray(data.items)) {
    throw new StoreError(`存储文件结构不符合预期：${filePath}`);
  }
  return { seq: Number(data.seq) || 0, items: data.items };
}

/**
 * 原子写入：先写同目录临时文件（同分区保证 rename 原子），成功后再替换。
 * 任何一步失败都清理临时文件，原数据不受影响。
 *
 * @param {Store} data
 * @param {string} [filePath]
 */
export function save(data, filePath = resolveStorePath()) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* 清理失败不影响主错误 */
    }
    throw new StoreError(`写入失败: ${err.message}`);
  }
}

export class StoreError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "StoreError";
    this.userFacing = true;
  }
}
