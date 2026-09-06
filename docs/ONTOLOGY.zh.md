# 技能本体接入指南（节点仓库如何设计）

> 回答一个问题：**一个学科/课程/团队，要怎样设计自己的节点仓库，才能接入建木平台。**
> 核心结论先说：节点（技能）是一个**自包含、可复用、可组合的单元**——一个 YAML
> 条目；本体仓库就是一个 Git 仓库，每个领域一个 pack（目录），增删改走 PR。
> LLM 可以起草节点（`pnpm suggest-skill`），也可以**从节点库组装整个 pack**
> （`pnpm assemble-pack`），人审阅立法。

---

## 0. 三层结构（2026-09-06 起）

```
ontology/
├── library/          # ① 可复用节点库：跨专业原子能力（lib.vcs / lib.testing / lib.viz…）
│   └── common.yaml   #    组装器从这里选材；与 pack 内技能同构
├── resources/        # ② 学习资源索引：权威公开资料 → 关联到节点（卡壳即给路径）
│   └── index.yaml    #    LLM 推荐只允许从表内选取，不得发明 URL
└── packs/            # ③ 学科本体：一领域一目录
    ├── cs/           #    计算机与软件工程（41 技能/6 分支）
    └── mds/          #    数学建模与数据科学（LLM 组装首个实装：4 分支/18 技能 + tracks 分级）
```

多 pack 即插即用：服务端扫描 packs/ 目录，Web 顶栏直接切换本体；
报告按 `report.pack.id` 归属各自本体，互不混串。

## 0.1 LLM 组装（assemble-pack）：从需求到本体草稿

```bash
USTC_API_KEY=sk-... pnpm assemble-pack --provider ustc \
  --id mds --major 数学建模与数据科学 \
  --desc "用数据、统计与优化模型解决实际问题的能力体系" \
  --courses "数学分析,线性代数,概率统计,数学建模,计算方法" \
  --tracks "拔尖班:核心节点 L3、方法节点 L2;普通班:核心 L2、方法 L1"
```

流程：LLM 读节点库 + 需求 → 产出分支/技能/分级 tracks → 逐项过 zod 校验
（前置只准引用库内或本次输出的 id）→ 落盘 pack 草稿 → loadPack 终检。
产物含 `tracks.yaml`（班型 → 节点最低等级映射，供课程教师审阅）。
**分工纪律：LLM 只组装与起草，人审阅、PR 立法。**（首例 mds 由 deepseek-v4-pro
组装，4 分支 18 技能一次通过校验；红队随后在其样本里抓出两处真问题，体系咬合正常。）

**v3：课程大纲 .md 直读**（`--syllabus` + `--out`，2026-09-06 实装）。教师手头的
教学大纲原文直接进提示词，LLM 按真实教学计划起草；草稿可重定向到
`ontology/drafts/<id>/`（不被 `/api/packs` 扫描，不覆盖已立法 pack）：

```bash
USTC_API_KEY=sk-... USTC_MODEL=deepseek-v4-pro pnpm assemble-pack --provider ustc \
  --id econ --major 经济学 \
  --desc "用经济理论与数据回答现实问题的能力体系" \
  --syllabus docs/examples/syllabus-econ.md \
  --out ontology/drafts/econ
```

首例 econ（经济学，大纲样例见 `docs/examples/syllabus-econ.md`）：**4 分支/20 技能
一次通过**——复用库原子 8（data-clean/stats/viz/repro/literature/academic-writing/sql/doc
逐字抄录）+ 新起草 12（微观三节/宏观四节/计量三节/沟通两节，前置链与课程先后一致）；
validate 通过（仅 1 条 tier 方向黄色提示，正好留给人工审阅——校验层职责的现场演示）。

## 0.2 学习资源与卡壳推荐

节点 ↔ 资源多对多关联（`links: [{skill, minLevel}]`）。Web 侧栏每个节点直显资源；
未点亮/被阻塞的节点自动提示「从这里补基础」。服务端 `/api/recommend`：
LLM 只从注册表候选中选取并给一句话理由（无 key 时回退静态匹配）——
推荐可解释、可审计，不产出编造链接。

## 1. 节点 = 可复用组合单元

一个节点（技能）长这样（LLM 起草的真实示例见 `docs/examples/draft-regex.example.yaml`）：

```yaml
- id: ds.regex          # 全图唯一 id：小写点分路径（分支前缀.技能名）
  name: 正则表达式
  summary: 使用模式匹配语法对字符串进行搜索、替换和验证的能力。
  keywords: [正则表达式, regex, 模式匹配]   # 评测时用于证据预选
  tier: 1               # 层级 0-6：布局用（越深越进阶）
  prereqs:              # 组合方式：引用其他节点（DAG 边）
    - skill: ds.string  #   前置节点 id + 需达到的最低等级
      minLevel: 1
  levels:               # 等级 rubric：行为化、可举证的标准
    - level: 1
      criteria:
        - 能调用语言内置的正则函数对指定字符串执行简单的模式匹配操作。
    - level: 2
      criteria:
        - 能独立编写正则完成邮箱校验等需求，并处理特殊字符转义边界。
    - level: 3
      criteria:
        - 能分析回溯失控等性能瓶颈，并论证正则与手写解析器的取舍。
```

**为什么这就是"可复用组合单元"**：
- `id` 全图唯一 → 任何节点都能被引用；
- `prereqs` 是指向其他节点的边 → 组合即连线（Obsidian 式关系图谱的节点-边模型，约束为无环有向图）；
- `minLevel` 让边带强度（引用 L2 的递归，而不是只引用"学过递归"）；
- `levels.criteria` 让节点自包含（评价标准跟着节点走，不依赖外部评分表）。

跨分支引用**已经支持**（`prog.functions` 依赖 `algo.recursion` 之类）；层叠视图就是为跨分支连线设计的视角。

## 2. 仓库结构契约

```
ontology/packs/<领域id>/          # 一个领域一个 pack（目录即模块）
├── pack.yaml                     # 元信息：id/name/semver/等级语义
└── branches/                     # 每个分支一个文件（分支 = 领域内的子方向）
    ├── algo.yaml                 #   skills: [ ...节点列表 ]
    ├── db.yaml
    └── ds.yaml
```

`pack.yaml` 关键字段：`levelSemantics`（L1-L3 的全校统一语义：L1 认知与模仿 /
L2 独立应用 / L3 迁移与权衡）——**等级语义全校统一，节点内容领域自洽**，
这是跨学科可比性的根基。

接入一个新领域 = 新建一个 pack 目录，零代码改动：`pnpm validate` 校验全图
（id 唯一、无环、前置可达、rubric 非空），Web 与评测器自动发现。

## 3. 标准怎么写才算合格（rubric 铁律）

- **行为化**：写成"能观察到的行为/产物"（能调用 X、能处理 Y 边界、能论证 Z 取舍），
  不写"了解/掌握/熟悉"——后者不可判定，红队与申诉都无从下手。
- **可举证**：每条标准都能在项目证据（文件、行号、提交、测试）里找到对应物。
- **递进正交**：L1 模仿（改既有代码）、L2 独立（从零写出）、L3 权衡（解释为什么这么选）。

## 4. 共建流程（含 LLM 参与节点设计）

```
课程教师/助教/学生 ──┬── 手写 YAML（小改动）
                    └── pnpm suggest-skill --provider ustc --name 正则表达式 --branch algo
                          │  LLM 读现有技能图，起草 PR-ready 草稿
                          │  （前置只能引用现有 id，草稿过 zod schema 校验）
                          ▼
                    人工审阅（LLM 只起草，人立法）
                          ▼
                    pnpm validate（全图合法性）
                          ▼
                    fork → PR → 种子编辑组评审 → semver 合入
```

治理要点：MAJOR 本体变更须附 `pnpm rubric:impact` 的逐技能等级影响对比；
每次评测报告锁定本体的 contentHash——**旧结论永远可以按当时的标准复现**。

## 5. 组合式的演进规格（v2，未实装）

现状：组合发生在**单 pack 内的跨分支 DAG**。下一步让组合跨 pack：

1. **跨 pack 引用**：prereq.skill 允许 `pack:skill` 形式（如 `math:calculus`），
   加载器合并多个 pack 为一个评测上下文，跨 pack 边在层叠视图中高亮——
   "计算机视觉 L2 需要 概率统计 L2"这类跨学科依赖即可表达；
2. **软边（推荐）**：`prereqs` 之外增加 `related: [ids]` 弱关联（Obsidian 的
   反链语义），不参与点亮约束，只参与图谱导航；
3. **节点模板**：把"实验报告类/工具使用类"节点的 rubric 骨架抽成可引用模板，
   新领域起草时 LLM 以模板为底稿，保证跨学科标准的一致口感。

这三项都是数据层演进（schema + 加载器 + 边计算），不动评测管线——
本体即数据，这正是目录即仓库的红利。

## 6. 新领域冷启动清单

1. 定分支：3-6 个子方向（多了拆、少了并）；
2. 用 `pnpm suggest-skill` 批量起草种子节点（每分支 5-8 个先跑通）；
3. 人工过一遍 rubric（重点删掉不可判定的形容词）；
4. 找 2-3 个真实学生项目跑 mock 通道校准，再上真实模型；
5. PR 合入，semver 从 0.1.0 起。
