# 组装报告 · 经济学（econ）

- 模型：deepseek-v4-pro @ api.llm.ustc.edu.cn（temperature=0, json mode, stream）
- 输入：（仅专业定位）；课程大纲 syllabus-econ.md
- 分支：micro, macro, metrics, econ-comm
- 技能：20（复用库原子 8 + 新起草 12）；前置边 12

## 复用的库原子（逐字抄录，rubric 与库一致）
- lib.data-clean（数据获取与清洗）→ metrics
- lib.stats（统计推断）→ metrics
- lib.viz（数据可视化叙事）→ metrics
- lib.repro（可复现研究）→ metrics
- lib.literature（文献检索与综述）→ econ-comm
- lib.academic-writing（学术写作）→ econ-comm
- lib.sql（关系数据与 SQL）→ metrics
- lib.doc（成果文档化）→ econ-comm

## 新起草节点（LLM 起草，待人工逐条审阅）
- micro.consumer-theory（消费者理论建模）→ micro；前置 无
- micro.producer-market（生产者与市场结构分析）→ micro；前置 micro.consumer-theory@L1
- micro.market-failure（一般均衡与市场失灵分析）→ micro；前置 micro.producer-market@L2
- macro.national-accounting（国民收入核算分析）→ macro；前置 无
- macro.growth-theory（经济增长模型分析）→ macro；前置 macro.national-accounting@L1
- macro.short-run-fluctuation（短期波动与政策分析）→ macro；前置 macro.national-accounting@L1
- macro.open-economy（开放经济与通胀分析）→ macro；前置 macro.short-run-fluctuation@L2
- metrics.regression（线性回归建模）→ metrics；前置 lib.stats@L2
- metrics.causal-inference（因果识别策略设计）→ metrics；前置 metrics.regression@L2
- metrics.econometric-software（计量软件实现）→ metrics；前置 lib.data-clean@L1
- econ-comm.empirical-paper（实证论文结构组织）→ econ-comm；前置 lib.academic-writing@L2, metrics.causal-inference@L1
- econ-comm.presentation（学术汇报与答辩）→ econ-comm；前置 lib.viz@L2, econ-comm.empirical-paper@L1

> 分工纪律：LLM 只组装与起草，人审阅立法。合入走 PR。
