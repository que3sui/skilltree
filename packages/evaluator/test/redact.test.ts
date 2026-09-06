import { test } from "node:test";
import assert from "node:assert/strict";
import { assertNoSecrets, findSecrets } from "../src/redact.js";

test("redact：干净报告放行", () => {
  assert.doesNotThrow(() =>
    assertNoSecrets({ model: { provider: "ustc" }, text: "正常评审结论：代码结构清晰" }),
  );
  assert.deepEqual(findSecrets({ a: 1 }), []);
});

test("redact：四种密钥形态全部拦截", () => {
  assert.throws(() => assertNoSecrets({ note: "key=sk-abc123def456ghi789jkl mno" }), /脱敏闸.*API key/);
  assert.throws(
    () => assertNoSecrets({ pem: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----" }),
    /PEM 私钥块/,
  );
  assert.throws(() => assertNoSecrets({ t: "ghp_" + "a".repeat(36) }), /GitHub token/);
  assert.throws(() => assertNoSecrets({ nested: { deep: [{ x: "gho_" + "b".repeat(24) }] } }), /GitHub 细粒度 token/);
});

test("redact：短前缀相似串不误伤（sk- 不足 20 位、普通文本）", () => {
  assert.doesNotThrow(() => assertNoSecrets({ a: "sk-short", b: "task-todo 评分：优秀", c: "ghp_" + "c".repeat(10) }));
});

test("redact：findSecrets 返回命中标签清单", () => {
  const hits = findSecrets({ a: "sk-" + "d".repeat(24), b: "-----BEGIN OPENSSH PRIVATE KEY-----" });
  assert.ok(hits.includes("OpenAI 风格 API key"));
  assert.ok(hits.includes("PEM 私钥块"));
});
