/**
 * 落盘脱敏闸：任何要写入 reports/（进而进入演示包/公开仓库）的内容，
 * 必须先过这道闸。命中密钥形态即抛错——宁可评测失败，不让密钥出边界。
 */

const SECRET_PATTERNS: [RegExp, string][] = [
  [/sk-[A-Za-z0-9]{20,}/, "OpenAI 风格 API key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "PEM 私钥块"],
  [/ghp_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, "GitHub 细粒度 token"],
];

/** 对任意可序列化对象做密钥扫描；命中即抛错（错误信息面向用户可读）。 */
export function assertNoSecrets(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(serialized)) {
      throw new Error(
        `报告内容触发脱敏闸（检测到 ${label} 形态的串）——拒绝落盘。` +
          `请检查被评测仓库是否把密钥写进了源码/README，或模型输出是否泄露了 key。`,
      );
    }
  }
}

/** 返回命中清单（不抛错），供启动自检等非致命场景使用 */
export function findSecrets(value: unknown): string[] {
  const serialized = JSON.stringify(value);
  const hits: string[] = [];
  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(serialized)) hits.push(label);
  }
  return hits;
}
