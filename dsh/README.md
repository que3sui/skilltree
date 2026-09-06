# 与 DeepSeek Harness（dsh）的集成

本项目的评测 pipeline 是**纯 TypeScript 模块**（`@skilltree/evaluator`），不直接依赖 dsh 内部 API；
dsh 作为运行时与模型接入层，有三条由浅入深的集成路径。以下内容基于 dsh 源码
（`docs/architecture.zh.md`、`docs/cordis-primer.zh.md`、`packages/llm/`、`packages/sdk/`）梳理。

## 路径一（已实现）：OpenAI 兼容 wire API

dsh 的 DeepSeek 适配器走的就是 OpenAI 兼容 `POST {baseURL}/chat/completions`，
凭据约定同为环境变量 `DEEPSEEK_API_KEY`（可选 `DEEPSEEK_BASE_URL`）。
我们的 `DeepseekProvider` 使用完全相同的约定，因此与 dsh 生态零冲突：

```bash
export DEEPSEEK_API_KEY=sk-...
pnpm evaluate -- --repo samples/task-todo --provider deepseek
# dsh 用户注意：dsh 默认模型目录是 deepseek-v4-flash / deepseek-v4-pro，
# 本项目默认 deepseek-chat，可用 DEEPSEEK_MODEL 环境变量切换。
```

## 路径二：作为 dsh 技能（skill）驱动 CLI

dsh 的技能系统扫描项目根 `.dsh/skills`（rank 100）与 `.agents/skills`（rank 200）下的
`SKILL.md`（YAML frontmatter：`name` + `description`）。本目录提供了现成的技能包：

```bash
# 在任何 dsh 工作区
mkdir -p .dsh/skills
cp -r skilltree/dsh/skills/skilltree-eval .dsh/skills/
# 之后对 dsh agent 说："用 skilltree-eval 评测 ~/projects/my-todo"
```

agent 会获得指令：如何调用 `skilltree evaluate` CLI、如何解读 EvaluationReport、
如何向学生解释点亮/阻塞/红队结论。见 `skills/skilltree-eval/SKILL.md`。

## 路径三（规划）：评测器注册为 dsh 插件

dsh 是"一切皆插件"的 Cordis 应用。把四 agent 评测做成原生插件的要点：

- **工具注册**：`defineTool`（`@deepseek-ai/dsh-tools`）+ `ctx.tools.register(...)`，
  可暴露 `read_digest`（证据摘要）、`rubric_lookup`（按技能 id 查标准）、
  `submit_verdict`（提交结构化裁决）三个工具，让 dsh agent loop 自己驱动取证过程；
- **LLM 调用**：consumer 插件声明 `export const inject = ['llm']`，
  经 `ctx.llm.stream({ provider, model, messages })` 调用模型（`GenerateOptions` 为 provider 无关词汇表）；
- **无界面运行**：`dsh --profile headless "任务"` 单进程出结果；或用
  `@deepseek-ai/dsh-sdk-client` 的 `DeepSeekHarness` spawn `dsh --profile sdk`，
  通过 `patches: ['./automation.cordis.yml']` 注入自定义插件，`harness.run(task)` 拿结构化返回；
- **组合配置**：插件插入 `cordis.patch.yml`（profile 层），或用户级 `$DSH_HOME` patch。

建议时机：dsh 发布首个 tagged release、插件 API 稳定后再做路径三；
在此之前路径一/二已覆盖"模型接入"与"agent 生态分发"两个需求，且不受 dsh 破坏性变更影响。

## 版本对冲

- 评测核心（pipeline/agents/规则）与 dsh 解耦，dsh API 变更只影响可选适配层；
- `EvaluationReport` 记录 `model.provider/details` 与 rubric 内容哈希，任何接入方式产物格式一致。
