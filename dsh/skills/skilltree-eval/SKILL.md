---
name: skilltree-eval
description: 用「建木 SkillTree」对本地项目仓库做 AI 技能评测：四 agent 流水线（勘察→取证→红队→仲裁）产出可申诉的技能点亮报告，并生成科技树/蜂窝网格可视化。
whenToUse: 当用户想要评估一个项目/代码仓库体现了哪些计算机技能、生成技能图谱、或对项目能力出具可追溯的评价报告时使用。
---

# 建木技能评测

你可以通过 `skilltree` CLI 驱动评测流水线。工作目录为 skilltree 仓库根（含 `pnpm-workspace.yaml`）。

## 步骤

1. **校验本体**（首次或本体被修改后）：

   ```bash
   pnpm validate            # 等价于 --pack ontology/packs/cs
   ```

2. **运行评测**：

   ```bash
   pnpm evaluate --repo <项目路径> --provider mock     # 确定性规则，无需 API key
   pnpm evaluate --repo <项目路径> --provider deepseek # 需要 DEEPSEEK_API_KEY
   ```

   `<项目路径>` 是本地目录（相对 skilltree 根或绝对路径）。输出报告写入 `reports/*.json`。

3. **解读报告**（JSON 字段）：
   - `effective[]`：每个技能的 `assessedLevel`（取证裁决）与 `effectiveLevel`（应用前置约束后的最终点亮等级）；`blockedBy` 非空表示"评估达标但前置未达"。
   - `assessments[].criteria[]`：rubric 逐条裁决（met/partial/unmet/not-evidenced）+ 证据文件引用。
   - `redteam.checks[]`：红队质疑（tests_present / provenance / oversized_file / stub_evidence…），`overallRisk` 为总体风险。
   - `arbitration`：仲裁降级记录（from/to/reason），被降级技能需人工复核。
   - `pack.contentHash` 与 `evidence.digestHash`：复现评测时用于锁定 rubric 版本与证据指纹。

4. **可视化**：`pnpm server` + `pnpm web`，浏览器打开后右上角选择报告；科技树看进度路径，蜂窝网格看覆盖版图。

## 解释原则

对学生/用户解释结论时：

- 引用具体 rubric 条目与证据文件，不凭空概括；
- 被红队标记（provenance/stub）的结论必须说明"存疑、建议复核"，不可当作定论；
- 前置阻塞是规则（`@skilltree/schema` 的确定性函数），不是模型意见；
- 等级语义：L1 认知与模仿 / L2 独立应用 / L3 迁移与权衡（见本体 pack.yaml `levelSemantics`）。
