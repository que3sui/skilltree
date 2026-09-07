# 更新日志（Changelog）

本文件记录「建木 SkillTree」的版本演进。格式参照 [Keep a Changelog](https://keepachangelog.com/)。

## [1.1.0] — 2026-09-07（赛后增强，夜间对抗迭代 N1-N7）

### 新增
- **专项评测**：单节点 ↔ 单独评审任务——`pnpm evaluate --skills <id,...>`（或技能侧栏「⚡ 专项评测此技能」）只重评目标技能并经 `mergeReports` 合并进该仓库基础报告，实测 2.6 分钟（全量 7-11 分钟）；报告带 `scope` 字段溯源（本次重评技能 / 基础报告 / 基础通道），合并报告在前端诚实标注混合通道
- **证据链对账**：`pnpm verify:report` 独立重算 effective/stats 并与报告逐项对账（schema / 仲裁留痕 / scope 结构），已纳入 flow-check 作常驻断言
- **报告内嵌复现命令**（`repro` 字段）：GitHub 直评写仓库 URL、专项带 `--skills`；申诉模板优先引用
- 轨迹/时间线对专项重评合并报告标 ⚡（曲线突变来源一目了然）

### 变更
- 红队 prompt 在专项模式下注入子集重评说明（仓库级必查项不受影响）
- 演示模式「评测回放」+ 报告按本体对齐 + 落地默认旗舰报告（ Pages 在线演示可操作性）
- README/DESIGN/DEFENSE/DEPLOY 口径更新（专项评测、verify:report、Pages 真实管线、二维码命令修正）

### 修复
- 合并语义：拒绝跨 rubric 版本合并（范围外裁决基于旧标准不可比）；合并报告可再作基础（链条合并）
- schema 演进兼容：scope 字段 default 化，旧报告可解析；基础报告自动定位跳过不可解析文件
- 跨本体同名仓库的轨迹/对比混排（报告 meta 增加 packId + 序列过滤）
- 窄屏横向溢出（报告下拉 min-content 撑爆 flex 行）

### 安全
- digest 资源上限（枚举 ≤5000 文件 / 深度 ≤12，确定性 DFS 保「同树同哈希」）——消除超大目录树 DoS 面
- 专项基础报告路径边界（须落在报告目录内）+ /api/evaluate skills 形状闸
- 详见 REVIEW.md「N1-N7 安全相关变更补记」

## [1.0.0] — 2026-09-06（一〇七杯提交版）

- 四 agent 评测流水线（勘察→取证→红队→仲裁）+ 前置约束纯函数
- 三学科本体 cs(41)/mds(18)/eie(19) + econ 课程大纲直读草稿 + 24 原子节点库
- mock/deepseek/ustc 三模型通道（SSE 流式 + 按模型 json mode）
- GitHub 直评（白名单 + 浅克隆 + 用后即焚，git 历史作过程证据；三项目梯度战报）
- 三视角可视化 + 点亮回放 + 评审留痕 + 学习轨迹 + 成长对比 + 申诉流 + 分享卡
- gate（arch:check + validate + 24 测试 + 回归 + build）+ flow-check + CI（含样本 g++/pytest 实测）
