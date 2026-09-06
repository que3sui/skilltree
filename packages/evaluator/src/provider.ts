/**
 * 模型适配层。
 *
 * 设计约束：评测 pipeline 只依赖本接口，不依赖任何具体 SDK / dsh 内部 API。
 * - DeepseekProvider 走 DeepSeek 官方 OpenAI 兼容 wire API（与 deepseek-harness 的
 *   llm-deepseek adapter 同一端点、同一 DEEPSEEK_API_KEY 约定）。
 * - UstcProvider 走科大统一模型入口（api.llm.ustc.edu.cn，OpenAI 协议；
 *   glm-5.2-107 / deepseek-v4-pro 等，key 走 USTC_API_KEY 环境变量）。
 * - MockProvider 为确定性规则评测：无 key 也能端到端演示与回归测试。
 * - 未来接入 dsh 运行时（ctx.llm.stream / dsh sdk profile）时，只需新增一个 Provider。
 */
import { mockComplete } from "./agents/mock-rules.js";

export interface ChatRequest {
  system: string;
  user: string;
  /** 要求模型输出单个 JSON 对象 */
  json: boolean;
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
}

export interface ModelProvider {
  readonly name: string;
  readonly details: string;
  complete(req: ChatRequest): Promise<ChatResponse>;
}

export type ProviderKind = "mock" | "deepseek" | "ustc";

export function createProvider(kind: ProviderKind): ModelProvider {
  if (kind === "mock") return new MockProvider();
  if (kind === "ustc") return new UstcProvider();
  return new DeepseekProvider();
}

// ---------------------------------------------------------------------------
// 出站端点安全闸：仅 http/https，拒绝环回/私有/保留地址的 IP 字面量与本地主机名。
// base URL 来自环境变量（可被运行环境改写），服务端发起请求前必须过这道闸。
// ---------------------------------------------------------------------------

function assertSafeBaseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`模型端点不是合法 URL：${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`模型端点仅允许 http/https，收到：${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error("模型端点 URL 不允许携带凭据（key 请走环境变量）");
  }
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    throw new Error(`模型端点拒绝本地主机名：${h}`);
  }
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    const blocked =
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
    if (blocked) throw new Error(`模型端点拒绝环回/私有/保留地址：${h}`);
  } else if (h.includes(":")) {
    if (h === "::" || h === "::1" || /^f[cd]/.test(h) || /^fe[89ab]/.test(h)) {
      throw new Error(`模型端点拒绝环回/私有/保留地址：${h}`);
    }
  }
  return url;
}

// ---------------------------------------------------------------------------
// OpenAI 兼容基类（wire API：{base}/chat/completions）
// ---------------------------------------------------------------------------

interface OpenAICompatConfig {
  name: string;
  keyEnv: string;
  keyHint: string;
  baseUrlEnv: string;
  baseUrlDefault: string;
  modelEnv: string;
  modelDefault: string;
  /**
   * 是否发送 response_format=json_object。科大统一入口的 glm-5.2-107 等
   * 推理型模型在 json mode 下会把答案落进 reasoning_content 而 content 为
   * null——这类端点必须关闭；deepseek 系实测 json mode 可靠（输出更严格）。
   * 传 RegExp 时按模型名判定（网关混布多系列模型），否则按布尔。
   */
  jsonMode: boolean | RegExp;
  /** 单次调用看门狗；推理型网关需要更长（reasoning token 也要时间生成） */
  timeoutMs: number;
  /**
   * 是否走 SSE 流式。推理型网关（glm-5.2-107 等）可能在首字节前思考数分钟，
   * 超过 Node fetch（undici）默认 5 分钟 headersTimeout 会以 "fetch failed" 断连；
   * 流式让响应头立即到达、token 增量推送，彻底绕开该限制。
   */
  streamMode: boolean;
}

abstract class OpenAICompatProvider implements ModelProvider {
  readonly name: string;
  readonly details: string;
  protected readonly apiKey: string;
  protected readonly baseUrl: URL;
  protected readonly model: string;
  protected readonly jsonMode: boolean;
  protected readonly timeoutMs: number;
  protected readonly streamMode: boolean;

  constructor(cfg: OpenAICompatConfig) {
    this.name = cfg.name;
    this.apiKey = process.env[cfg.keyEnv] ?? "";
    if (!this.apiKey) {
      throw new Error(`未设置 ${cfg.keyEnv} 环境变量。获取 key 后：export ${cfg.keyEnv}=${cfg.keyHint}`);
    }
    const raw = (process.env[cfg.baseUrlEnv] ?? cfg.baseUrlDefault).replace(/\/+$/, "");
    this.baseUrl = assertSafeBaseUrl(raw);
    this.model = process.env[cfg.modelEnv] ?? cfg.modelDefault;
    this.jsonMode = cfg.jsonMode instanceof RegExp ? cfg.jsonMode.test(this.model) : cfg.jsonMode;
    this.timeoutMs = cfg.timeoutMs;
    this.streamMode = cfg.streamMode;
    this.details = `${this.model} @ ${this.baseUrl.hostname}（temperature=0${this.jsonMode ? ", json mode" : ", prompt-json"}${this.streamMode ? ", stream" : ""}）`;
  }

  async complete(req: ChatRequest): Promise<ChatResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl.href}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: req.maxTokens ?? 8192,
          ...(this.streamMode ? { stream: true } : {}),
          ...(this.jsonMode && req.json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 400);
        throw new Error(`${this.name} API ${res.status}: ${body}`);
      }
      if (this.streamMode && res.body) {
        return await this.consumeSse(res.body);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
      };
      const msg = data.choices?.[0]?.message;
      // 推理型网关兜底：content 为空但 reasoning_content 有正文时取后者
      const text = (msg?.content ?? "") || (msg?.reasoning_content ?? "");
      if (!text) throw new Error(`${this.name} API 返回空内容`);
      return { text };
    } finally {
      clearTimeout(timer);
    }
  }

  /** 聚合 OpenAI SSE 增量：delta.content 与 delta.reasoning_content 都收，content 优先 */
  private async consumeSse(body: ReadableStream<Uint8Array>): Promise<ChatResponse> {
    const decoder = new TextDecoder();
    let buf = "";
    let content = "";
    let reasoning = "";
    for await (const chunk of body) {
      buf += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const delta = (JSON.parse(payload) as { choices?: { delta?: { content?: string | null; reasoning_content?: string | null } }[] }).choices?.[0]?.delta;
          if (delta?.content) content += delta.content;
          if (delta?.reasoning_content) reasoning += delta.reasoning_content;
        } catch {
          // 半行/噪声帧：等下一个分块拼齐
        }
      }
    }
    const text = content || reasoning;
    if (!text) throw new Error(`${this.name} API 流式返回空内容`);
    return { text };
  }
}

// DeepSeek 官方（OpenAI 兼容；json mode 实测可靠）
export class DeepseekProvider extends OpenAICompatProvider {
  constructor() {
    super({
      name: "deepseek",
      keyEnv: "DEEPSEEK_API_KEY",
      keyHint: "sk-...，或先用 --provider mock 演示",
      baseUrlEnv: "DEEPSEEK_BASE_URL",
      baseUrlDefault: "https://api.deepseek.com",
      modelEnv: "DEEPSEEK_MODEL",
      modelDefault: "deepseek-chat",
      jsonMode: true,
      timeoutMs: 180_000,
      streamMode: false,
    });
  }
}

// 科大统一模型入口（大赛词元计划发放的队内 key；glm-5.2-107 / deepseek-v4-pro 等实测在列）
export class UstcProvider extends OpenAICompatProvider {
  constructor() {
    super({
      name: "ustc",
      keyEnv: "USTC_API_KEY",
      keyHint: "sk-...（大赛词元计划渠道领取）",
      baseUrlEnv: "USTC_BASE_URL",
      baseUrlDefault: "https://api.llm.ustc.edu.cn/v1",
      modelEnv: "USTC_MODEL",
      modelDefault: "glm-5.2-107",
      jsonMode: /^deepseek/,
      timeoutMs: 900_000,
      streamMode: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Mock：确定性规则评测（演示 / 回归 / 无 key 环境）
// 约定：各 agent 的 user prompt 首行以 [[AGENT:<name>]] 标记自身，mock 据此分派；
//       规则只读取提示词中同时呈现给真实模型的结构化信息，不读取额外状态。
// ---------------------------------------------------------------------------

export class MockProvider implements ModelProvider {
  readonly name = "mock";
  readonly details = "确定性规则评测（关键词密度 + 来源核验 + 仲裁规则），非模型输出";

  complete(req: ChatRequest): Promise<ChatResponse> {
    const marker = req.user.match(/\[\[AGENT:(\w+)\]\]/);
    const agent = marker?.[1] ?? "unknown";
    const text = mockComplete(agent, req);
    return Promise.resolve({ text });
  }
}
