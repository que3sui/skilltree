# econ 草稿 · 人工审阅清单（REVIEW-NOTE）

> 生成：2026-09-06，assemble-pack v3（`--syllabus docs/examples/syllabus-econ.md`，
> deepseek-v4-pro @ 科大统一入口）。本目录是**草稿**，未被 `/api/packs` 扫描、不参与评测，
> 人审通过并走 PR 后才合入 `ontology/packs/econ/`。

## 已知待裁决项（validate 黄牌）

- **metrics.regression（tier 1）前置 lib.stats@L2（tier 2）**——tier 方向倒挂警告。
  前置关系本身教学上正确（回归需要统计推断）；两个处置选项：
  1. 把 metrics.regression 升 tier 2（视其为方法核心节点）；或
  2. 保持 tier 1 但把前置降到 lib.stats@L1（若认为 L1 统计足够支撑回归入门）。
  建议选 1（与 mds 包 foundation.probstat 的处理一致性更好）。

## 逐条审阅建议（按优先级）

1. **rubric 行为化抽查**：每分支抽 2 个技能，确认 criteria 是「可从项目证据判定」的行为
   （有动词、有产物、可引用文件），而非知识点罗列。重点：micro.consumer-theory 的
   L3（能否从学生仓库证据判定"迁移与权衡"？数理推导类技能的证据形态要明确）。
2. **前置链语义**：macro.open-economy 依赖 short-run-fluctuation@L2——是否符合教学顺序。
3. **keywords 实用性**：对照 mds/eie 的标准（代码 token + 短中文词，如 OLS/IV/DID/双重差分/
   回归/Stata/R），为 mock 通道跨学科泛化补齐——本草稿 keywords 由 LLM 起草，风格未对齐。
4. **tracks 分级**：基地班/普通班要求映射是否与原大纲 §四 一致（理论 L3/L2、计量 L3/L2）。

## 合入流程（审阅通过后）

```bash
# 1. 处置黄牌 + 修订 rubric/keywords（直接改本草稿目录）
pnpm validate --pack ontology/drafts/econ          # 必须无红
# 2. 资源预置：ontology/resources/index.yaml 增补 econ 领域条目并 links 到技能，
#    跑 pnpm resource:coverage 确认 100%
# 3. 移入正式目录并升版：
#    git mv ontology/drafts/econ ontology/packs/econ（pack.yaml version 0.1.0）
# 4. PR 立法：说明逐技能审阅结论，附 pnpm rubric:impact（如已有过往评测）
```

## 组装溯源

- 输入：docs/examples/syllabus-econ.md（编写示例大纲，非真实教学文件——合入前应换为
  经济学院真实大纲并重新组装或修订）
- 报告：本目录 ASSEMBLY.md（复用 8 原子逐字抄录 + 新起草 12，前置边 12）
