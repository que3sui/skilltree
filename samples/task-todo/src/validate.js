const MAX_TITLE = 200;
const PRIORITIES = new Map([
  ["high", 2],
  ["normal", 1],
  ["low", 0],
]);

export function parseTitle(raw) {
  if (typeof raw !== "string") throw new ValidationError("标题必须是一个字符串");
  const title = raw.trim();
  if (title.length === 0) throw new ValidationError("标题不能为空");
  if (title.length > MAX_TITLE) throw new ValidationError(`标题过长（最多 ${MAX_TITLE} 字符，当前 ${title.length}）`);
  return title;
}

export function parsePriority(raw = "normal") {
  const p = String(raw).toLowerCase();
  if (!PRIORITIES.has(p)) {
    throw new ValidationError(`未知优先级 "${raw}"，可选：${[...PRIORITIES.keys()].join(" / ")}`);
  }
  return p;
}

/** 优先级 → 排序权重，供 list 分桶使用 */
export function priorityWeight(priority) {
  return PRIORITIES.get(priority) ?? 1;
}

export function parseIndex(raw, max) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new ValidationError(`序号必须是正整数，收到 "${raw}"`);
  if (n > max) throw new ValidationError(`序号 ${n} 超出范围（当前共 ${max} 项）`);
  return n;
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.userFacing = true;
  }
}
