# 建木 SkillTree · 基于技能树的去绩点化能力评价体系（MVP）

> 用 AI 依据公开、版本化、社区共建的评价标准（rubric），把学生的真实项目证据映射为
> 可点亮、可前置约束、可申诉的技能图谱——绩点之外的另一种能力证据。

**[🌐 在线演示（无需安装，扫码即玩）](https://que3sui.github.io/skilltree/)** —— 内置三学科本体与真实模型评测报告的静态演示包。

详见 [设计文档 docs/DESIGN.zh.md](docs/DESIGN.zh.md)（§10 为大赛提交版摘要）。

## 结构

```
ontology/
  packs/      三个学科本体：cs 计算机(41) / mds 数学建模(18) / eie 电子信息(19)，PR 共建
  drafts/     LLM 组装草稿（econ 经济学：课程大纲 .md 直读首例，人审后合入 packs/）
  library/    可复用节点库：24 原子四域（通用/研究/数据/设计）
  resources/  学习资源索引（84 条，三本体 100% 覆盖）
packages/
  schema/     共享 zod 类型与点亮/前置约束纯函数
  evaluator/  四 agent 评测 pipeline（勘察→取证→红队→仲裁）+ CLI
apps/
  server/     本地服务（Hono）：本体/报告/组装日志/推荐 API + 评测触发 + GitHub 直评
  web/        三视角可视化 + 学习轨迹/成长对比/申诉/分享卡；五套主题（默认科大配色）
samples/      五个示例项目（优质 / 来源存疑 / 空壳 / 数模课程设计 / Arduino 数字钟）
scripts/      组装器 / 评测回归 / 资源覆盖 / 提交打包等工具链
```

## 快速开始

```bash
pnpm install

# 质量门禁（改完代码必跑）：校验 + 24 单元测试 + 评测回归 + 构建 + 架构边界检查
pnpm gate

# 动线回归（先起服务）：20 项 API 断言
pnpm flow-check

# 离线演示：对示例仓库跑 mock 评测（无需 API key，三学科均可）
pnpm demo

# 静态演示包：内置本体 + 真实模型评测报告，零后端零 key 可部署（见 docs/DEPLOY.zh.md）
pnpm demo:build

# 起服务 + 前端（两个终端）
pnpm server   # http://127.0.0.1:8787
pnpm web      # http://127.0.0.1:5173

# 从课程大纲组装一个新学科本体草稿（LLM 起草，人审立法；key 只走环境变量）
USTC_API_KEY=sk-... USTC_MODEL=deepseek-v4-pro pnpm assemble-pack --provider ustc \
  --id econ --major 经济学 --syllabus docs/examples/syllabus-econ.md --out ontology/drafts/econ
```

接真实模型：`DEEPSEEK_API_KEY`（deepseek 官方通道）或 `USTC_API_KEY` + `USTC_MODEL`
（科大统一模型入口，如 deepseek-v4-pro）环境变量切换；mock 通道零 key 离线可跑。
GitHub 直评：Web 评测框直接粘贴 github.com/gitee.com 公开仓库链接（浅克隆 + git 历史
进红队核查 + 用后即焚）。

## 开发工作流

本仓库按《The AI-Native SDLC Playbook》组织自动化工作流：制品链 intent → spec → plan → 带测试的变更 → 评审，`pnpm gate` 为合并门禁，CI 另含样本仓库 g++/pytest 实测。见 [docs/WORKFLOW.zh.md](docs/WORKFLOW.zh.md)；AI 协作上下文见 [AGENTS.md](AGENTS.md)；评审策略见 [REVIEW.md](REVIEW.md)；竞品对比与答辩口径见 [docs/COMPETITIVE.zh.md](docs/COMPETITIVE.zh.md)；决赛大纲见 [docs/DEFENSE.zh.md](docs/DEFENSE.zh.md)。
