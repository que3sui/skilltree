# AGENTS.md —— AI 协作上下文（本仓库的 CLAUDE.md）

任何 AI agent（Claude Code / ZCode / dsh 等）在本仓库工作前必读。人写给人看的架构文档在 `docs/DESIGN.zh.md`；本文件只放 agent 需要的**可执行知识**，随代码一起版本化。

## 命令

| 目的 | 命令 |
|---|---|
| 一键质量门禁（改完代码必跑） | `pnpm gate`（= validate + test + eval 回归 + build） |
| 校验技能本体 | `pnpm validate` |
| 单元测试 | `pnpm test` |
| 评测回归（样例行为不变量） | `pnpm eval:regression` |
| 本体改动后的影响报告 | `pnpm rubric:impact` |
| 真实模型评测 | `DEEPSEEK_API_KEY=… DEEPSEEK_MODEL=deepseek-v4-flash pnpm evaluate --repo <路径> --provider deepseek` |
| 本地起服务/前端 | `pnpm server`（8787）/ `pnpm web`（5173，代理到 8787） |

## 架构一页图

```
ontology/packs/cs/   技能本体（pack.yaml + branches/*.yaml，纯数据）
packages/schema      领域模型 + 前置约束/统计【纯函数，最可靠的层，改动需过测试】
packages/evaluator   digest 证据摘要 / provider 适配 / 四 agent pipeline / CLI
apps/server          Hono 本地服务（内存任务表，无鉴权，仅 127.0.0.1）
apps/web             React + 手写 SVG/CSS3D（科技树/蜂窝/层叠三视角）
dsh/                 deepseek-harness 集成（技能包 + 路径文档）
scripts/             eval-regression（合并门禁）/ rubric-impact / compare
```

数据流：`repo → digest(有预算摘要+内容指纹) → surveyor → assessor(逐分支) → redteam → arbiter → applyPrereqCaps(纯函数) → reports/*.json`。

## 铁律

1. **rubric 条目文本永远由本体回填，模型只填裁决**——不要让任何代码把模型输出的文本写进 rubric 字段。
2. **前置约束/统计只允许纯函数**（packages/schema），禁止把点亮逻辑放进 prompt 或模型。
3. 改 `ontology/` 后必须跑 `pnpm rubric:impact` 并把输出贴进 PR；改动现有条目可判定范围的按 MAJOR 走（docs/DESIGN.zh.md §5.3）。
4. 改 evaluator/ontology 后必须跑 `pnpm eval:regression`；破坏样例行为不变量（scripts/eval-regression.mjs 的 INVARIANTS）需要显式更新不变量并说明理由。
5. 评测结论引用必须指向 digest 中真实存在的文件路径；不要为了"好看"伪造 citation。

## 已知坑（前人踩过，别再踩）

- **pnpm 会把 `--` 原样转发**：`pnpm evaluate -- --repo x` 的裸 `--` 会被 node:parseArgs 当选项终止符（CLI 已过滤，但写文档/脚本时直接用 `pnpm evaluate --repo x`）。
- **Mimosa 安全钩子会拦截写入**：正则的 `.exec(` 会被误判为命令注入（用 `matchAll`/`match`）；`path.resolve(动态输入)` 需紧跟 `p === root || p.startsWith(root + path.sep)` 边界断言；动态 `import(变量)` 会被拦（用静态 import）。
- **clipPath 子元素上的 CSS transform 在部分 Chromium 不生效**（transform-box 不被尊重）——SVG 裁剪用直接几何计算，别用 transform 缩放（见 GridView）。
- **deepseek-v4-flash 是推理模型**：reasoning tokens 计入 max_tokens，大 JSON 输出的调用要给足预算（assessor 用 32768）。
- **Windows 控制台是 GBK**：curl 直接打中文会坏，测试脚本用 ASCII 或落盘后用 node 读。
- **SVG 文本无法被 Playwright 文本引擎定位**（无 innerText）：UI 自动化用 `page.evaluate` 派发事件。
- 证据目录里的符号链接必须跳过（`digest.ts` 已做），否则会读出根目录之外的内容。

## 工作循环（AI 原生 SDLC）

按 `docs/WORKFLOW.zh.md` 执行：intent → spec → plan（人工确认）→ build（测试同步写）→ `pnpm gate` 全绿 → 按 `REVIEW.md` 评审。写代码的 agent 不能自我批准。
