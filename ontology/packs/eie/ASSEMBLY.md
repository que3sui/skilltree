# 组装报告 · 电子信息与嵌入式（eie）

- 模型：deepseek-v4-pro @ api.llm.ustc.edu.cn（temperature=0, json mode, stream）
- 输入：电路分析,模拟电子技术,数字逻辑,微机原理与接口,嵌入式系统,信号与系统；分级：竞赛班:系统节点 L3、方法节点 L2;课程班:系统节点 L2、方法节点 L1
- 分支：circuit, digital, embedded, engineering
- 技能：19（复用库原子 9 + 新起草 10）；前置边 9

## 复用的库原子（逐字抄录，rubric 与库一致）
- lib.vcs（版本控制）→ engineering
- lib.testing（测试与验证）→ engineering
- lib.doc（成果文档化）→ engineering
- lib.debug（系统化调试）→ engineering
- lib.search（技术检索与甄别）→ engineering
- lib.abstract（抽象与复用）→ embedded
- lib.performance（性能剖析）→ embedded
- lib.experiment（实验设计与对照）→ circuit
- lib.literature（文献检索与综述）→ circuit

## 新起草节点（LLM 起草，待人工逐条审阅）
- circuit.analysis（电路分析）→ circuit；前置 无
- circuit.analog（模拟电子电路）→ circuit；前置 circuit.analysis@L2
- circuit.signals（信号与系统分析）→ circuit；前置 circuit.analysis@L2
- digital.logic（数字逻辑设计）→ digital；前置 无
- digital.interface（微处理器接口与外设）→ digital；前置 digital.logic@L2
- embedded.mcu（微控制器编程）→ embedded；前置 无
- embedded.rtos（实时操作系统应用）→ embedded；前置 embedded.mcu@L2
- embedded.driver（外设驱动开发）→ embedded；前置 embedded.mcu@L2
- engineering.pcb（PCB 设计与硬件实现）→ engineering；前置 circuit.analog@L2, digital.interface@L2
- engineering.integration（软硬件系统集成）→ engineering；前置 embedded.mcu@L2, engineering.pcb@L2

> 分工纪律：LLM 只组装与起草，人审阅立法。合入走 PR。
