# WORKFLOW —— 本仓库的 AI 原生 SDLC

> 参考 Anthropic《The AI-Native SDLC Playbook》（academy.claude.com/courses/ai-native-sdlc-playbook）组织。
> 核心转变：流程从线性改为循环，AI 嵌入每个节点，阶段之间以**版本化的工件**交接，证据由自动化产生，人类判断保留在关键门禁上。

## 制品链（每阶段消费上一阶段的产出，commit 历史即审计轨迹）

```
intent.md ──► spec.md ──► plan.md ──► 带测试的代码变更 ──► REVIEW.md 评审记录 ──► 发布/回归记录
 (Plan)       (Design)     (Build 门禁)   (Build/Test)        (Deploy 门禁)      (Maintain)
```

模板在 `docs/workflow/templates/`，实际工件按约定放 `docs/workflow/<日期>-<主题>/`。

## 阶段映射：playbook → 本仓库

| 阶段 | Playbook 主张 | 本仓库的落地 |
|---|---|---|
| **Plan** | 头脑风暴固化为 `intent.md`，人工评审放行 | `docs/workflow/templates/intent.md`；问题陈述+可判定完成标准，确认前不写代码 |
| **Design** | AI 依据 intent + 组织 Skills 起草 `spec.md` | 模板强制回答 intent 的待解决问题；仓库规范沉淀在 `AGENTS.md`（命令/架构/铁律/已知坑），起草时作为 agent 上下文注入 |
| **Build** | plan mode 起步：先出计划、人工确认、测试与代码同步生成 | `plan.md` 模板含变更文件清单+验证清单；**改行为必改测试**（packages/*/test 与代码同 PR） |
| **Test** | 测试封装成单条命令，agent 自行迭代到全绿；持续 eval 通过率作合并门槛 | `pnpm gate`（validate + 单元测试 + **评测回归** + build）一条命令；`scripts/eval-regression.mjs` 把三个样例的结论固化为行为不变量——本体/流水线的任何改动若悄悄改变"优质项目点亮、空壳全灭"等结论，门禁即红 |
| **Deploy** | AI 按 REVIEW.md 分轮审查；分级环境+审批闸门；写代码的 agent 不能自我批准 | `REVIEW.md` 按变更类型定义必查清单与严重度（本体变更=最高强度）；agent 评审意见不构成批准，人批才算批；上线即"合并进 main"（本地工具阶段），CI 门禁见 `.github/workflows/ci.yml` |
| **Maintain** | 确定性监控按控制带触发响应，事故沉淀为新的 intent.md | 目前对应：`reports/` 的报告即运行记录；**rubric 漂移监控**=每次本体变更跑 `pnpm rubric:impact` 产出抽样重评对比（DESIGN §5.3 的 MAJOR 必附项）；生产化后接入真实监控再扩展 |

## 门禁一览（谁在什么条件下拦什么）

| 门禁 | 执行者 | 拦截条件 |
|---|---|---|
| `pnpm validate` | 机器 | 本体 schema/前置 DAG 非法 |
| `pnpm test` | 机器 | 纯函数/摘要/pipeline 行为破坏（16 用例） |
| `pnpm eval:regression` | 机器 | 样例行为不变量被破坏（含红队必标记、空壳必全灭） |
| `pnpm rubric:impact` | 机器产出 + 人判断 | 本体变更未附影响报告（MAJOR/MINOR 由人定级） |
| `REVIEW.md` 清单 | agent 初审 + 人终审 | 清单任一 🔴 项命中 |
| 人工批准 | 人 | 一切合并的最终条件 |

## 与 AI agent 的会话约定

1. 开工先声明处于哪个阶段、消费哪个上游工件；
2. Build 阶段 agent 自己跑 `pnpm gate` 迭代到全绿，再交人评审（人不在执行路径上，在批准路径上）；
3. 事故/线上反馈回流为新的 `intent.md`，进入下一圈循环；
4. 新踩的坑写进 `AGENTS.md`「已知坑」——工程经验与代码一起版本化。
