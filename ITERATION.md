# 建木 滚动迭代计划（rolling）

> 本文件是自动迭代的**唯一活跃计划**；每轮迭代（45 分钟）收尾时重写。
> 四轨：**B=系统边界 / S=安全边界 / U=视觉与流畅 / C=竞品追平**。
> 纪律：gate 全绿（含 arch:check）；key 只走环境变量；打包前 git add -A；提交包基线不可破坏。

## 当前轮次：I25（2026-09-06 12:3x 规划；I1-I24 已完成见文末记录）

> **低频核验节奏**：每轮=终包 zipcheck + 四件材料核对 + 服务健康 + 等用户动作（推送 I21+I22 / 瀚海上传）。
> 无可证实高价值项不写代码。已过 2026-09-06 20:00 则纯收尾（验收清单+瀚海步骤置顶）。

### I25 核验清单（每轮重复，基线已于 I24 更新为 228）
- [ ] node E:\A-GLM\登楼\02\recordings\zipcheck.cjs（**228** 条目/0 反斜杠/0 mimosa/0 env/mp4=1/docx=2）
- [ ] 材料 mtime 基线：视频 04:03 / 简介 docx 12:3x / 设计 docx 12:3x / zip 12:3x
- [ ] curl 8787 /api/packs=200（死则重启：cd apps/server && npx tsx src/index.ts 后台；带 key 版启动需 USTC_API_KEY/USTC_MODEL 环境变量）
- [ ] git 全同步（staged M 计入正常；PPT 只在仓库外 defense/，绝入 git/zip）
- [ ] 若用户已推送 I24 → 线上验收 Pages（chalk/kilo 报告入演示包 + 回放可选到新项目）
- [ ] 若用户反馈新意见 → 按意见处理（唯一改代码入口）

### 下一轮：I26+

### 决赛窗口开发清单（用户 09-06 12:50 确认「晚上闲时再开发」——夜间提交上传完成后开工，只动仓库不动已上传 zip）
1. **专项评测（单节点 ↔ 单独评审任务）**——用户提出，判断为决赛演示杀手锏：评委点一个节点→2-3 分钟专项重评出结果。设计要点：
   - evaluator 加 `--skills` 子集参数（取证只跑目标分支，红队/仲裁只作用目标裁决；成本 9 调用/11 分钟 → 3-4 调用/约 3 分钟）
   - **合并语义**（核心难点）：专项结果覆盖合并进该仓库上一份完整报告（其余节点裁决沿用、指纹与 rubric 版本对齐），applyPrereqCaps 纯函数重算；轨迹曲线天然记录单技能进步
   - UI：SidePanel「专项评测此技能」按钮 + EvalDrawer 节点多选
   - 必须补：合并纯函数单测 + eval:regression 不变量核对 + mock 通道子集行为
   - 产品闭环：推荐补技能 → 练 → 专项提交 → 单节点重评 → 图谱单点亮起（"登天之梯"的梯级感）
2. 真实同学仓库试点（1-3 例 + 本人反馈）｜盲测信度实验｜LLM 生成达标仓库对抗压测｜信度白皮书（task-todo ×3 方差）
同上核验；20:00 后附验收清单与上传步骤。答辩材料（PPT 09:45 版于 E:\A-GLM\登楼\02\defense\）待用户试讲反馈后修订。

## 夜间对抗迭代协议（09-06 22:4x 起生效，用户授权「每晚11点到次日9点自动迭代」）

- **窗口与轮次**：每晚 23:00-次日 8:45（automation-6d640a1b，每 45 分钟）；夜间轮编号 **N1、N2…**（与日间 I 轮区分）。**每轮收尾必须写下「下一轮计划」**——本轮提出、下轮执行，迭代链不断。
- **三目标**：①**找茬式刁难**——数据正确性/原理漏洞/操作体验/汇报口径四方向主动挑刺，发现即修，gate+flow 全绿才算完成；②**功能 steelman**——候选功能→最强论证→无情精简→只落地当下最优且不降级（有测试保护、不破坏既有口径），落选入备选池；③**三链补全**——证据链（指纹/引用/复现命令对账）、操作链（README 命令实测）、安全链（输入校验/路径边界/密钥闸，库层同样要边界）。
- **红线**：已提交 zip 与四件材料冻结不重打包；commit/push 留用户（agent 只 git add）；真实模型每轮 ≤2 次调用，默认 mock/离线；PPT 改动须过 COM 验证。
- **N1 计划（23:00 执行）**：找茬方向=①专项评测合并语义边界——重复合并（N 次叠加）、scope 报告再作 base 的链条正确性、跨 provider 混合 base（mock base + ustc partial）的口径显示；②操作链实测——README 快速开始逐命令跑一遍；③安全链复查——/api/evaluate 的 skills 数组元素格式校验（当前只查存在性，未查字符串形状）。发现即修。

## 夜间轮记录

### N1（23:05-23:3x 完成）✅ 找茬四杀 + 一次自伤式真 bug：
1. **合并语义边界**（schema）：①mergeReports 新增 rubric 版本闸——base 与 partial 的 pack.contentHash 不一致直接拒绝（范围外裁决基于旧标准不可比），报错引导重跑全量；②scope 新增 `baseProvider`（范围外裁决的通道溯源，default "unknown" 兼容中间版报告）；③链条合并验证（merged 再作 base，scope 指向最近一次 partial、早轮结果不丢）。+2 单测。
2. **自伤式真 bug（schema 演进兼容性）**：给 scope 加必填 baseProvider 后，schema 中间版本写出的报告（有 scope 无 baseProvider）解析失败 → 专项自动定位选中它即爆「基础报告无法解析」。修：baseProvider 改 default("unknown") + findLatestBaseReport 改用 schema safeParse 只挑可解析报告。实弹复测链条合并通过（15-19 报告 baseProvider=mock 正确溯源）。
3. **安全链**：/api/evaluate 的 skills 形状闸（字母开头/字符集/≤64 字符/1-64 个/去重），三组恶意形状实测 400。
4. **汇报口径**：合并报告画布头原先只显示本次通道——现诚实标注「合并（N 项本次重评，其余沿自 X）」，title 含完整溯源；"unknown" 兜底显示「早期通道」。
5. **操作链**：flow-check 20 项全过（新代码服务实测）；gate 29/29（+2 链条/版本闸单测）+ 回归不变量未破；mock 专项实弹 ds.stackqueue 链条合并 OK。
- 落选备选池：轨迹导出 PNG、报告 diff 增强视图（steelman 后判定当前证据不足其复杂度，留决赛窗口再议）。
- **N2 计划**：①找茬=红队对专项子集的输入适配（levelSummary 只含子集——红队缺全库上下文是否产生误导性结论？定设计口径或修 prompt）；轨迹/对比视图拿 scope 报告与全量报告 diff 的语义正确性；②三链=证据链对账脚本 scripts/verify-report.mjs（读任意报告→重算 stats/前置约束/指纹比对）；③操作体验=IAB 走查专项按钮→抽屉→完成后轨迹新增点的完整动线。

### N2（23:45-00:1x 完成）✅ 四项全过：
1. **红队子集适配（设计口径落定+prompt 修正）**：审查结论——红队 6 项必查全是仓库级检查，不依赖全库等级，scoped 模式无需给全库上下文（保持"红队只质证本次裁决"的对抗边界）；但红队会困惑"等级概览为何只有一项"。修：buildRedTeamPrompt 加可选 scopeNote，专项模式注入「子集重评说明：概览仅含本次重评 N 项；仓库级必查照常全查」。全量模式零变化。
2. **轨迹/对比 scope 语义**：对比视图已有"上次/本次 provider"双标注（诚实，无需改）；轨迹面板语义正确性**实弹验证**——专项合并报告入时间线（task-todo ×10 次，曲线 22/41→19/41 逐点带通道标注），scope 报告 lit=合并后全库状态，作时间线点语义自洽。
3. **证据链对账脚本落地**：scripts/verify-report.mjs（`pnpm verify:report`）——schema 解析/仲裁留痕写回/独立重算 effective+stats 逐项对账/scope 结构自洽，多本体按报告所属 pack 分别对账。**实弹 17/17 全过**（cs/mds/eie + 4 份 scope 合并报告）。这是"报告可复现"主张从口头变成可执行验证的一环。
4. **IAB 完整动线绿**：节点→专项按钮→抽屉预设（banner/路径/通道）→切 mock 执行→「✓ 完成」→列表 9→10→canvas 切新合并报告（N1 合并标注在）→轨迹面板 ×10 次。另实弹复查 /api/reports/:file 路径安全——已有 basename+后缀白名单，穿越攻击 400（历史已设防）。
- gate 29/29 + 回归未破；全部暂存。
- **N3 计划**：①找茬=reports/ 目录膨胀对可用性的污染（task-todo 已 10 个选项，测试产物与真实使用混排——设计隔离/分组方案）；ComparePanel 跨 pack 同名 repo 的守卫核查；②三链=把 verify:report 纳入 flow-check（对账既有报告作为第 21 断言，轻量不拖慢）；③操作体验=窄屏（≤760px）下专项按钮与抽屉表单的可达性走查。

### N3（00:30-01:0x 完成）✅ 三项全过 + 修一个窄屏真溢出：
1. **reports 膨胀治理**：三个夜间测试产物（mock 合并报告）git mv 入 `reports/dev/`（/api/reports 顶层扫描天然不收录，UI 回到干净列表：task-todo 7 个有意义选项）；顶层保留 15 份含 ustc ds.hash 专项展示件。zip 存档无涉。
2. **跨 pack 同名守卫**：坐实风险——meta 无 packId 时轨迹/对比按 repoName 匹配，同名仓库跨本体评测会混排垃圾 diff。修：/api/reports meta 增加 `packId` + ReportMeta 类型 + App 三处序列过滤（轨迹/对比上次/轨迹面板）同 pack 守卫。
3. **对账纳入 flow-check**：第 21 断言「证据链对账 verify:report 全过」——报告可复现性成为动线回归的常驻关卡；实测 21/21 全过（dev/ 子目录不参与对账，符合预期）。
4. **窄屏走查（375×720）**：专项按钮 44px 触控✓、滚动可达✓、抽屉表单可用✓；**发现真溢出**——report-select 的 min-content（最长选项文本）撑爆 flex 行，把「⚡评测项目」顶出视口（docW 397>375）。修：`min-width: 0`（文本由浏览器截断），复测 docW=375 零溢出、按钮完整可见。截图通道间歇 guest 故障（既有坑），以 DOM 几何数据判定。
- gate 29/29 + flow 21/21 + 回归未破；全部暂存。
- **N4 计划**：①找茬=汇报口径：README/DESIGN §10.3 补专项评测文档（mergeReports 语义+scope 溯源），DEFENSE 演示脚本增补「专项重评」一步（决赛演示新动线）；②三链=overflow 通用排查（对 segment/主题切换器等其余工具栏元素做窄屏扫描，沉淀为 mini 审计）；③steelman=备选池复审（轨迹导出 PNG / 报告 diff 增强 / 报告分享链接）。

### N4（01:15-01:4x 完成）✅ 汇报口径补全 + overflow 审计收官 + steelman 三连裁：
1. **汇报口径（找茬命中 1 处不一致）**：DEFENSE 演示脚本标注「与视频 v3 同序」——实际提交的是 v4，改 v4；演示表增补「扩展 +40s」行：专项评测现场动线（推荐→练→专项提交→单节点重评→图谱点亮，真实实测 2.6 分钟），供评委追问时展开；DESIGN §10.3 评测流水线行补专项评测（--skills + mergeReports + scope 溯源 + 2.6 分钟实测）；§10.5 可验证性补 `pnpm verify:report` 常驻对账。README 已含（N1），零改动。
2. **overflow 通用审计**：375px 全元素扫描（滤 SVG 假阳性）——主视图/蜂窝零溢出；层叠视图 deck-card 超界属 3D 场景设计内（overflow=false 无滚动条，拖拽平移交互）；抽屉态表单贴合视口。结论：N3 修复后工具栏/抽屉/列表全清洁，无新溢出源。
3. **steelman 备选池复审（三连裁，全落选留池）**：①轨迹导出 PNG——steelman 最强论点"教师可分享学员成长轨迹"；裁：分享卡已承担分享职责，轨迹导出是重复入口，价值密度不足。②报告 diff 增强（专项变化标注）——裁：mergeReports 语义下 diff 天然呈现（范围外不变范围内变），加标注是装饰性复杂度。③报告分享深链（?report= 参数）——steelman"评委直达指定报告"；裁：当前默认落地已是旗舰报告，深链需求等评委真实反馈再说。三候选均记入备选池附裁决理由。
- 本轮零产品代码改动（仅 md 文档）；gate/flow 沿用 N3 绿态。
- **N5 计划**：①找茬=「问 AI/推荐」对 scope 合并报告的输入语义（recommend 以 reportFile 读报告——scope 报告作输入时建议是否失真）+ ComparePanel 实际开一次 scope vs 全量对比走查；②三链=报告 JSON 自带复现命令字段审查（当前复现命令只在申诉模板拼装——报告本体是否该有 evidence.reproCommand，schema 加字段走 default 兼容）；③安全链=mock 通道对超大 digest 的资源上限审查（文件数/行数上限防 DoS）。

### N5（02:00-02:5x 完成）✅ 三线全过：
1. **推荐语义（审查通过，零改动）**：/api/recommend 从报告 assessments 取当前等级——合并报告=当前真实状态（范围内最新裁决+范围外沿用），阻塞链追溯语义自洽；recommendFile 已有 basename+后缀白名单。
2. **复现命令进报告本体（证据链补全）**：ReportSchema 顶层新增 `repro`（default "" 向后兼容）——pipeline 按最终形态生成（GitHub 直评写仓库 URL 而非用后即焚的临时路径；专项带 --skills 后缀）；mergeReports 携带 partial.repro；服务端透传 repoUrl；申诉模板优先引用 report.repro（旧报告回退现场拼装）。mock 实弹：repro 正确含 --skills。
3. **digest 资源上限（安全链）**：坐实 DoS 面——内容有 90KB/文件 12KB 预算但**枚举无上限**（指向超大目录树可拖死评测）。修：枚举封顶 MAX_FILES=5000 + MAX_DEPTH=12，且遍历改为**名字排序的确定性 DFS**——截断子集对同一棵树仍确定（同树→同摘要→同哈希承诺不破）。
4. **IAB 对比走查**：scope 合并报告开「对比上次」——面板双 provider 标注 + 1↑1↓ 恰为 scope 链等级变化，diff 语义正确。
- gate 29/29 + flow 21/21 + 回归未破。**运维注**：`&` 起的服务可脱离 shell 存活（EADDRINUSE 即信号——先查存活实例与其代码版本再杀，勿盲目重启）。
- **N6 计划**：①找茬=数据正确性：三视图（tree/grid/deck）点亮计数与 stats 同源一致性走查（前端 buildVM 对账）；ComparePanel 对 scope 报告的仲裁留痕分区是否有视觉区分需求（评估，可能落备选池）；②steelman=「轨迹面板 scope 点标 ⚡ 徽标」（ReportMeta 加 scope 布尔——帮观众理解曲线突变是专项非全量；小改动，下轮评估是否过不降级线）；③三链=操作链：docs/DEPLOY.zh.md 部署说明逐命令实测。

### N6（02:30-02:5x 完成）✅：
1. **steelman 过线落地：轨迹 ⚡ 徽标**（N5 评估项转实施）——steelman 最强论点成立：曲线 22→19 的跳变无标注会误导观众（"怎么退步了"），徽标一词消除歧义且成本极小（meta scoped 布尔 + 类型 + 行内徽标 + circle title）。实装：/api/reports meta 加 `scoped`、ReportMeta 类型、TrackPanel 时间线行与圆点 title 标注。**IAB 实测：3 份 scoped 报告全部 ⚡ 正确标注**（dev/ 隐藏件不入列）。
2. **三视图计数一致性**：stat-chip 在科技树/蜂窝/层叠三视图恒为 20/41——单一 buildVM 源自洽；DOM 类名计数噪音大（边线类名含 lit），以 stat 同源一致为结论，不再深挖类名对账。
3. **汇报口径（DEPLOY）**：GitHub Pages 行与实际不符（文档写手动分支法，实为 pages.yml workflow 自动部署且线上即此管线）——改为真实管线描述。
- gate 29/29 + 回归未破；全部暂存。
- **N7 计划**：①找茬=数据正确性：申诉模板对 scope 报告的语义实测（生成申诉说明验证 repro 带 --skills、申诉范围=本次重评技能；范围外沿自 base 是否需在模板注明——评估后落决策）；②三链=操作链：DEPLOY 其余平台行与 README 快速开始最终复核（日间终验留痕）；③收尾整理：夜间轮汇总表（N1-N7 发现/修复清单）写入 ITERATION 供晨间汇报。

### N7（03:15-03:4x 完成）✅：
1. **申诉模板 scope 语义实测（抓到缺口并修）**：repro 带 `--skills` ✓（N5 字段生效），但模板未说明"为何只评一项"——复核者会困惑。修：SidePanel 申诉模板在 scope 报告时注入「报告性质：专项重评合并——X 为本次重评，其余沿自 Y 基础报告（日期）」。IAB 复测：说明行正确渲染、repro 完整。
2. **操作链（DEPLOY/README 终复核）**：实弹测出 `npx qrcode-terminal` 在 Windows Git Bash **静默空输出**（exit 0 零内容）——文档命令换成已验证的 python qrcode 方案（答辩二维码即此生成）并加勿用警示；README 快速开始各命令在 N1-N6 期间已全部实测过（gate/flow/demo/demo:build/evaluate --skills/server），留此为证。
3. **晨间汇总表**：见下。

## 夜间轮汇总（N1-N7，晨间汇报用）

| 轮 | 类型 | 发现 → 处置 |
|---|---|---|
| N1 | 找茬×5 | rubric 版本闸（拒绝跨标准合并）/ 链条合并验证 / scope 加 baseProvider 溯源 / **自伤式 schema 兼容 bug**（中间版报告解析失败→default+safeParse 定位）/ skills 形状闸（恶意 400）/ 合并口径画布标注 |
| N2 | 三链+找茬 | 红队 scopeNote（对抗边界保住）/ 对比 provider 双标注（已诚实）/ **verify-report 对账脚本 17/17** / IAB 专项动线绿 |
| N3 | 找茬×3 | 测试产物隔离 reports/dev/ / **跨 pack 同名守卫**（meta packId + 三处过滤）/ 对账入 flow-check 第 21 断言 / **窄屏真溢出**（min-width:0） |
| N4 | 汇报口径+steelman | DEFENSE v3→v4 口径修正 / 演示表补专项扩展行 / DESIGN §10.3+§10.5 补专项与对账 / overflow 审计收官 / **steelman 三连裁**（轨迹 PNG、diff 标注、深链——全落池） |
| N5 | 三链 | **repro 字段**（schema default 兼容→pipeline 生成→GitHub 用 URL→申诉引用）/ **digest 资源上限**（MAX_FILES=5000+DEPTH=12，确定性 DFS 保同树同哈希）/ 推荐语义审查通过 / IAB 对比走查 |
| N6 | steelman+口径 | **轨迹 ⚡ 徽标**（3 份 scoped 实测标注）/ 三视图 stat 同源 20/41 / DEPLOY Pages 行改真实管线 |
| N7 | 找茬+操作链 | **申诉模板 scope 说明**（复核者语境补全）/ qrcode-terminal 静默失败→换 python 方案 / README 命令全实测留证 |
| N8 | 原理审查+收尾 | verdict-level 口径注释（不做机械强制）/ **过时记忆修正**（report.effective 已是真实对账数据）/ **CHANGELOG.md v1.0.0+v1.1.0** / REVIEW 安全补记 |
| N9 | 找茬（机理级） | **mock ds.hash 误报根因**（index 命中文件名→移除，cs 0.1.1；map/set 保留=有效信号）/ AGENTS 命令册补 verify:report+专项 / 晨间包就绪 |
| N10 | 找茬（裁定） | demo 快照漂移=**版本锁定设计自证，不重建** / flow-check 契约断言补 packId+scoped / 池复审无新候选 |
| N11 | 三链+一致性 | 三文档专项评测口径交叉核对（2.6 分钟/--skills/语义四处一致，零修正）/ **端点安全矩阵**入 REVIEW（10 端点×闸逐行） |

**净结果**：新增 1 个产品能力（专项评测）+ 6 处修复 + 2 个常驻质量关卡（verify:report、flow 21 项）+ 文档口径三处修正；测试 24→29；备选池 5 项留痕。gate 29/29、flow 21/21 持续绿。**晨间动作**：`git add -A && git commit`（建议信息：`feat: 专项评测 + 夜间对抗迭代 N1-N7（对账脚本/安全闸/口径修正）`）+ push；推送后可打 **v1.1.0** release。**注：09:00 夜间 automation 到窗停**，日间无值守 automation（需要可说一声再加）。
- **N8 计划（04:00 执行）**：①找茬=原理深挖：assessor 的 verdict-level 一致性审查（coerceAssessment 对未提供 criteria 的 fallback 规则——level 与逐条 verdict 是否可能矛盾）；②收尾=CHANGELOG.md 草拟 v1.0.0→v1.1.0（专项评测+夜间迭代成果，供 release 页用）；③安全链扫尾=REVIEW.md 补记 N1-N7 的安全相关变更（digest 上限/baseReportFile 边界/skills 形状闸）。

### N9（04:45-05:1x 完成）✅ mock 机理定位 + 新工具入册：
1. **mock ds.hash 误报机理定位（数据正确性深挖）**：grep 实证 task-todo 源码零 hash/哈希内容——mock 判 L1 来自泛化 token：`index` 命中 9 处（全是 index.js 文件名/package.json/README，零语义）+ `map`/`set` 命中 Array.map/Set 类通用代码。处置：**移除 `index`**（文件名级假阳性，净改进）+ cs pack 0.1.0→0.1.1；**保留 map/set**（真哈希仓库的有效信号词，误报属关键词启发式固有局限——mock 系统性虚高已有明文口径）。回归不变量全过（task-todo 22/41 未变）。README mock 描述补局限注记（诚实口径）。cs 0.1.1 → 旧报告链按新 rubric 闸拒绝合并（预期行为，需全量重评）。
2. **AGENTS.md 命令册更新**：补 `pnpm verify:report`（含"flow-check 第 21 断言已常驻"）与专项评测条目（含 rubric 闸说明）——未来 agent 会话可见新工具。
3. **晨间包就绪**：33 文件暂存（16517 行新增）；HEAD 7ebed1c；建议晨间单串命令：
   `git commit -m "feat: 专项评测 + 夜间对抗迭代 N1-N9（对账脚本/资源上限/安全闸/口径修正）" && git push`，推送后 `gh release create v1.1.0 --target master --title "v1.1.0 · 专项评测与可信度加固" --notes-file CHANGELOG.md`（或网页按 CHANGELOG 粘贴）。
- gate 29/29（新关键词下回归不变量全过）。
- **N10 计划（05:30）**：①三链=flow-check 第 22 断言候选：/api/reports meta 断言补 `packId`/`scoped` 字段存在（N3/N6 新字段的契约执法——契约对账哲学的延续）；②找茬=reports/ 与 demo 快照的版本漂移（cs 0.1.1 后 demo 包内 mock 报告的 pack.version 仍是 0.1.0——评估是否重跑 demo:build 及 Pages 更新时机）；③steelman=暂无新候选，复审池。

### N10（05:30-05:5x 完成）✅：
1. **契约断言升级**：flow-check「/api/reports 条目形状」补 `packId`/`scoped` 字段存在——N3/N6 新字段进入契约执法面（对账哲学：端点出参形状逐字段锁定）。flow-check 21/21 复跑全过。
2. **demo 快照版本漂移——裁定不重建（找茬结论：漂移即设计）**：demo 报告自带 version 0.1.0 + contentHash ef17…（评判时锁定的标准），本体升 0.1.1 后旧报告携带旧哈希恰是「rubric 版本随报告锁定」承诺的诚实形态（简介 §二.1 原文）；重跑全量真实评测（10+ 次调用）只为对齐版本号属无意义动作。Pages 下次 push 自动重建时同样按此逻辑（pack.json 0.1.1 + 报告自带旧哈希）。历史证据的有效性不因本体演进失效。
3. **steelman 池复审**：无新候选（三连裁后池稳定：轨迹 PNG/diff 标注/深链/CHANGELOG 已出池）。
- gate/flow 绿态沿用（本轮仅 flow-check 断言加强）；全部暂存。
- **N11 计划（06:15）**：①收尾整理=晨间汇报最终版（夜间轮 N1-N10 全表已就绪，补 N8-N10 三行进汇总表）；②找茬=aggressive 收尾扫描：AGENTS/README/DESIGN 三文档交叉引用一致性（新命令在 AGENTS/README/DESIGN 的表述是否互相一致——如专项评测的三处描述措辞）；③安全链=全部已闸端点清单入 ARCHITECTURE 或 REVIEW（端点安全矩阵：路径/形状/限速逐端点一行），沉淀为可审计清单。

### N11（06:15-06:4x 完成）✅：
1. **三文档交叉一致性（找茬通过）**：专项评测四处描述（README 命令/AGENTS 命令册/DEFENSE 演示行/DESIGN 模块表）交叉核对——2.6 分钟、--skills 语法、mergeReports+scope 语义、闭环保留口径全部一致，零修正（夜间轮各自写入时口径自觉对齐）。
2. **端点安全矩阵入 REVIEW**：10 端点 ×（输入闸/备注）逐行成表——可审计清单沉淀（下新端点必增行）；结论：全部有界，唯一写路径 /api/evaluate 五层闸。
3. 汇总表补 N8-N10 三行（晨间汇报最终版就绪）。
- gate/flow 绿态沿用（本轮零代码，文档/记录）。
- **N12 计划（07:00）**：①夜班终检：全部暂存 diff 快速走读（防夜间疲劳期引入低级错误——重点看 schema/pipeline/agents 三核心文件 diff）；②备选池与 N1-N11 经验句典化（沉淀进 AGENTS.md「已知坑」或单独段）；③N13-N14 计划预置：若无可证实问题则轻量轮转至 08:45 窗停，晨间汇报以汇总表为准。

### N12（07:00-07:2x 完成）✅ 夜班终检 + 经验句典化：
1. **暂存 diff 走读（三核心文件全过）**：schema（scope/repro/mergeReports+版本闸+兼容 default）、pipeline（未知 id 校验/路径边界/safeParse 定位/repro 生成/合并落盘）、agents（scopeNote 透传）——闸/兼容/溯源齐备，**无疲劳期低级错误**。mergeReports 的 durationMs 取 partial 耗时（本次重评口径）确认符合 scope 语境。
2. **经验句典化**：AGENTS.md「已知坑」补三条夜间教训——schema 加字段必须 .default()（基础报告链断裂根因）、EADDRINUSE 先查存活实例（`&` 服务可脱离 shell）、本体 keywords 警惕泛化 token（先 grep samples 实测语义）。
3. **N13-N14 预置**：若无新发现即轻量轮转（维护态：gate/flow/暂存检查+记录），08:45 窗停；晨间汇报以汇总表为准，无新增动作。
- gate/flow 绿态沿用（本轮零代码——仅 AGENTS.md 文档）。
- **N13 计划（07:45）**：①找茬=最后角度：报告 JSON 的 criteria 引用文件存在性抽查（assessor 校验「引用必须在证据文件集合内」——抽 chalk/kilo 报告各 3 条 citation 与 digest 文件清单对账）；②维护检查（gate/flow/暂存）。**N14 计划（08:30）**：①窗停前终检（zip 存档/服务/Pages/git 四项+汇总表终稿）；②留下「白班交接行」（今日待办=晨间 commit+push+v1.1.0 release）。

### N13（07:45-08:0x 完成）✅：
1. **引用存在性抽查（chalk 88 条 / kilo 41 条）**：全部相对路径形状正确（chalk=source/index.js、examples/rainbow.js 与真实仓库结构一致；kilo=kilo.c 单文件仓库），可疑形状零。机制核查：引用校验=prompt 层约束 + coerce 形状过滤，**无事后存在性核验**——GitHub 仓库焚毁后引用只能信不能验，这是证据链最后一环的结构性缺口。
2. **入池（决赛窗口头号候选，附规格）**：「引用文件指纹快照」——评测时对被引用文件记录（路径+SHA-256，去重后体量小），报告自带后即使证据焚毁也能独立核验引用真伪。规格已明确（digest 采集/字段/verify-report 扩展），过不降级线但今晚不动（schema+digest+pipeline 三处联动，凌晨不做）。
3. 维护检查：gate 29/29（N6 后代码零变更）、flow 21/21（N10）、暂存全同步。
- **N14 计划（08:30）**：窗停前终检四项（zip 存档/服务/Pages/git）+ 汇总表终稿 + 白班交接行（今日待办：commit+push+v1.1.0 release+备选池头号候选「引用文件指纹快照」择期实现）。

### N14（08:30-08:5x 完成）✅ **夜班收官（窗停）**：终检四项全过——zip 存档 228 全净/服务 200/**Pages 线上 200（最新部署绿）**/git 全同步（HEAD 7ebed1c + 夜间成果全部暂存）。

---

## 🌅 白班交接行（2026-09-07 08:50，夜班 N1-N14 完毕，09:00 窗停）

**昨夜净产出**（全部已暂存，33+ 文件）：专项评测全链路（schema/pipeline/CLI/服务端/Web）+ 证据链对账脚本（常驻 flow 第 21 断言）+ 6 处修复（rubric 版本闸/边界双层防线/skills 形状闸/跨 pack 守卫/窄屏溢出/口径三处）+ cs 本体 0.1.1（mock 误报 token 清理）+ CHANGELOG/REVIEW/AGENTS/DEFENSE/DEPLOY 文档同步。**gate 29/29、flow 21/21、对账 17/17 全绿。**

**今日待办（按序）**：
1. `cd E:\A-GLM\登楼\02\skilltree && git commit -m "feat: 专项评测 + 夜间对抗迭代 N1-N14（对账脚本/资源上限/安全闸/口径修正）" && git push`
2. `gh release create v1.1.0 --target master --title "v1.1.0 · 专项评测与可信度加固" --notes-file CHANGELOG.md`
3. 决赛窗口待办（09-19/20 前）：真实同学仓库试点、盲测信度实验、备选池头号候选「引用文件指纹快照」（规格在 N13 记录）、答辩 PPT 试讲反馈修订
4. 答辩材料：PPT=E:\A-GLM\登楼\02\defense\建木SkillTree-答辩.pptx（09:45 终态版）；讲稿=每页备注；DEFENSE.zh.md 演示脚本已含专项评测扩展行

**夜间经验已沉淀**：AGENTS.md 已知坑 +3 条；REVIEW.md 端点安全矩阵 + 安全补记；ITERATION.md N1-N14 全记录 + 晨间汇总表。

---

## 迭代记录

> 时间更正（09-06 03:37 经文件 mtime 核实）：I1-I5 各条原时间戳为误标（早于实际的钟面错位），
> 实际发生区间为 09-06 00:00-03:30（v3 视频完成于 02:10）。相对顺序与内容不变；以本行之后的新时间为准。

### I1（02:30-03:15）✅ B：ARCHITECTURE｜S：机密排除/限速/CSP｜U：切换进度条｜C：COMPETITIVE+print.css。
### I2（03:20-04:05）✅ S：脱敏闸｜B：arch:check 进 gate｜U：hover 证据预览/过渡/分组｜C：对比视图+移动端。
### I3（04:10-04:55）✅ S：redact 单测+启动自检｜B：时序图+REST 契约｜U：分享卡 PNG（357KB）/级联动效｜C：覆盖率工具+eie/mds 100%。
### I4（05:00-05:45）✅ C：cs 资源清零（三 pack 100%/84 条）、申诉流 v1（模板实测）｜B：契约对账入 flow-check｜S：全树自检+.mimosa 修复｜U：报告淡入。
### I5（05:50-06:30）✅ C：**学习轨迹视图**（同仓库 sparkline+时间线，实测 task-todo 5 点曲线「22/41→20/41」）｜U：空态组装日志引导（/api/assembly/:packId，eie 实测 200/cs 404；入口随空态展示）｜B：/api/reports mtime 增量缓存｜S：REVIEW S 轨 I1-I5 全记录；分享卡二维码定为 fingerprint 文本终态（诚实标注）。gate+flow 绿，包 9.1MB/205。
### I6（03:00-03:40 完成）✅ C：**答辩 PPT 大纲 docs/DEFENSE.zh.md**（11 页+4 分钟演示脚本+预答 Q&A，按 COMPETITIVE 口径）｜**mock 通道按本体关键词泛化**——37 技能+11 库原子 keywords 从教学短语改为「代码 token+短中文词」，mds 1/18→**5/18**、eie 3/19→**6/19**（cs 22/41 回归不变），两包升 v0.1.1；离线无 key 可演示三学科｜COMPETITIVE 回填 I5/I6+矩阵两格（分享卡 ✓/移动端 △→精修）｜U：报告加载中隐藏分享卡/轨迹/对比按钮（防新旧混合数据）+轨迹曲线↔时间线双向 hover 联动｜B/S：/api/assembly 32KB 截断闸（x-truncated 头）+flow-check 补 4 断言（16→**20 项全绿**）。gate 全绿；包 **9.1MB/206**；zipcheck 全净。
### I7（03:40-03:50 完成）✅ C：**assemble v3 课程大纲 .md 直读**（--syllabus 64KB 闸 + --out 草稿目录不被 /api/packs 扫描）——**econ 首例一次通过**：经济学大纲 → 4 分支/20 技能（复用库原子 8 逐字抄录 + 新起草 12，前置链与课程先后一致），validate 过（仅 1 条 tier 方向黄牌，正好演示校验层留给人审）；ONTOLOGY §0.1 补 v3 用法｜**作品简介终稿回填**（三本体+v3 组装+轨迹/对比/申诉/分享卡+mock 多学科+eie 8/19 战报+gate/flow 数字刷新；docx pandoc 重生成并验证 5 处新内容命中）｜B：CI 新增 sample-tests job（eie-clock g++ 桌面测试 + modeling-comp pytest；pytest 本地 3/3 验过，g++ 三测人工推演正确；推 GitHub 后得绿章=样本过程证据自证）｜U：轨迹面板打印样式（@media print 用 :has(.track-drawer) 放行为附录区块，老浏览器维持隐藏降级）。gate 绿 + flow 20 项全过；包 **9.1MB/215**（196 源文件）；zipcheck 全净。
### I8（03:52-04:06 完成）✅ C：**演示视频 v4=4:47 全系统+评价工具组**（IAB 冷却后一次成功探针；三新镜头=学习轨迹悬停联动/分享卡导出/申诉模板——DOM 断言逐拍验证；9 旧段按字幕末尾安全尾剪合计 -28.6s 腾时长，-t -c copy 无损；concat 4:47.64 ≤5:00，五点抽帧 YAVG 167-227 非空白；v3 归档 versions/ 不动）｜产品补强：分享卡「已导出 PNG ✓」反馈、**申诉模板生成后页面内展示全文**（details+pre，剪贴板被拒也可看——修 IAB 无手势剪贴板必拒的现实缺口）、画布头 provider 标签修正（ustc 不再误标 deepseek）｜cs keywords 审计=**不改**（cs 词表本就 token 化，mock 22/41 健康，且 eval:regression 不变量钉死行为——临期改动风险>收益，留赛后）。gate 绿；包 **10.4MB/215**（v4 8.0MB）；zipcheck 全净；reports 11 份无串位。**IAB 新知：React 合成事件断言必须异步读 DOM**（派 pointerover 后同步查 .cmp-row-hot 必为 0——React 批处理；React enter/leave 由 over/out 根代理推导，直接派 enter 无效）。
### I9（04:06-04:10 完成）✅ C：**DESIGN §10 回填**（模块表 9 行含 drafts/econ、三通道、GitHub 直评、工具组、CI 样本测试；难点 5 条含 SSE/JSON-mode 适配、git 历史过程证据、脱敏闸；架构图更新；**设计文档.docx pandoc 重生成验证 4 处新内容**）｜**README 刷新**（结构补 library/drafts/resources/scripts；快速开始补 flow-check/assemble v3/ustc 通道/GitHub 直评；**口径修正「替代绩点」→「绩点之外的另一种能力证据」**与简介一致；样例数 3→5）｜**econ 草稿审阅清单**（drafts/econ/REVIEW-NOTE.md：tier 黄牌两个处置选项、rubric 抽查建议、合入流程、组装溯源）｜一致性修复：**静态演示包数据重生成**（demo:build——此前 public/demo 是 03:12 旧快照）。gate 绿 + flow 20 项；包 **10.4MB/216**；zipcheck 全净。资源 econ 预置=跳过（草稿未合入，做了无意义）。
### I10（04:10-04:30 完成）✅ 验证轮（零产品代码改动）：**静态演示包 smoke 9/9 绿**（python http.server 4174 无代理环境：api/packs 404→demo 回退 ✓、演示标注 ✓、隐藏评测按钮 ✓、43 边渲染 ✓、抽屉开合 ✓；**发现 vite preview 继承 server.proxy 会代理 /api 到 8787——测静态行为必须用哑静态服务器，preview 的"成功"是假阳性**）｜**v4 终验**（4:47.64/720p/h264；新镜头边界 159s/247s 抽帧非空白）｜**答辩走查实测计时**（S1 1.2s/S2 0.7s/S4 切包 0.6s/S5 1.0s/S6 问 AI 0.6s 静态回退·LLM 2-25s/S6b 申诉 0.1s/S7 mock 评测 0.1s——机器时间全 trivial，4 分钟脚本大头是讲述；已写入 DEFENSE 演示脚本）｜S7 评测作业报告已清理（11 份复位）。赛后待办发现：评测抽屉默认 repo 不随 pack 切换更新（cs 样本配了 mds 本体，机制无害）。
### I11（04:21-04:35 完成）✅ 核验轮 + **答辩 PPT 成片**：核验四项全过（zip 216 净/服务 200/材料在位/git 暂存正常）；按 DEFENSE 大纲 11 页 PPT 构建于 **E:\A-GLM\登楼\02\defense\建木SkillTree-答辩.pptx**（仓库外不进提交包；科大蓝三色制、微软雅黑、点亮圆点母题、四 agent 流程/竞品矩阵/三证据/红队战报/路线图全为原生形状，每页带讲者备注）。QA 三层：python-pptx 越界/重叠/溢出净（修复 S3/S5 微重叠+封面右缘过贴）；**PowerPoint COM 原生打开通过并导出 PNG（结构有效性硬证据）**；PIL 像素级边距/非空白 11/11 过。**视觉验收降级说明：本会话 judge/主上下文/emitImage 图像通道全不可用（模型配置拒图）——PPT 请用户开 PowerPoint 亲自过目，讲者备注即讲稿**。**关键工程教训：pptxgenjs LINE 形状负宽/高会产出 PowerPoint 拒开的损坏文件（python-pptx 却能读）——连线必须归一化正尺寸+flipH/flipV；另中文路径过 Git Bash→PowerPoint COM 会乱码报「损坏」，导出/打开需 ASCII 路径中转（E:\ppt-tmp）**。
### I12（04:39-04:41 完成）✅ 核验轮（零代码改动）：zipcheck 216/0 反斜杠/0 mimosa/0 env、mp4=1/docx=2 基线完好；服务 /api/packs 200；四件材料 mtime 与 I11 记录一致；git 198 暂存全同步、无未跟踪文件。曾疑「submission/ 出现 PPT 副本」——实为 `ls a && ls b | grep` 输出拼接误读，PPT 仅在仓库外 defense/（经验：多目录清点勿与 grep 拼接，逐目录单独跑）。
- 04:44 补记：一次携带 **I8 旧 prompt** 的重复调度触发（I8 早已完成），按规程以本文件为准执行 I13 清单复核——四项再次全绿、状态零变化；轮次不因重复触发空转。若再次出现旧 prompt 触发，同法处理（读本文件自校正）。
- 04:46 补记：又一发携带 **I12 旧 prompt**（距上发 2 分钟）。CronList 诊断：automation 仅 1 条、runCount=12 未增、nextRun 正常——两次均为**历史 prompt 回放投递而非调度执行**（I8→I12 恰为旧版本顺序，疑似积压清空）。策略：距上次全量核验 <10 分钟且 git 干净的重复触发，只做轻查（date+git status）即收，不重复 zipcheck；45 分钟真实节律不受影响。
### I13（04:44-05:23 完成）✅ 核验轮（零代码改动）：期内共三次触发（04:44 I8 旧prompt 回放、04:46 I12 旧prompt 回放、05:23 真实调度），历次核验全绿——zipcheck 216 全净、四件材料 mtime 恒为基线（04:03/03:47/04:08/04:36）、服务 200、git 198 全同步无未跟踪；回放投递未影响 45 分钟节律（runCount 稳定递增节奏正常）。无用户审看反馈 → 无代码改动。**注：本轮收尾时 CronUpdate 工具不可用（上下文压缩后工具集变化），automation 仍挂 I13 标签——prompt 第 1 步以本文件自校正，清单内容与 I14 完全一致仅轮次号差一，无实质影响；下轮若工具恢复请 CronUpdate 同步标题为当前轮次。**
### I14（05:23-06:08 完成）✅ 核验轮（零代码改动）：真实调度 06:08（runCount=14），四项全绿——zipcheck 216 全净、材料 mtime 恒为基线、服务 200、git 全同步无未跟踪。automation 标签仍为 I13（CronUpdate 自 I13 起不可用），prompt 第 1 步以本文件自校正，无碍。无用户审看反馈。
### I15（06:08-06:53 完成）✅ 核验轮（零代码改动）：真实调度 06:53（runCount=15），四项全绿（zipcheck 216 全净/材料 mtime 基线/服务 200/git 全同步）。CronUpdate 持续不可用，automation 标签滞留 I13——维持无害结论，后续轮次不再尝试更新（以本文件轮次为准）。无用户审看反馈。
### I16（06:53-07:38 完成）✅ 核验轮（零代码改动）：真实调度 07:38（runCount=16），四项全绿（zipcheck 216 全净/材料 mtime 基线/服务 200/git 全同步）。无用户审看反馈。距截止约 16.3 小时。
### I17（07:38-08:23 完成）✅ 核验轮（零代码改动）：真实调度 08:23（runCount=17），四项全绿（zipcheck 216 全净/材料 mtime 基线/服务 200/git 全同步）。无用户审看反馈。距截止约 15.6 小时。
### I18（08:23-09:08 完成）✅ 核验轮（零代码改动）：真实调度 09:08（runCount=18），四项全绿（zipcheck 216 全净/材料 mtime 基线/服务 200/git 全同步）。无用户审看反馈。距截止约 14.8 小时。
### 补记（09:38-09:46，用户切换视觉模型后要求检查）✅ **图像通道恢复确认 + I11 欠账闭环：答辩 PPT 机器视觉验收完成**——主上下文 Read 图片成功；重走 COM 导出（slides=11，结构有效性再证）后派 judge 全量验收 11 页：**10 过 / 1 fail**（封面说明文字与树形底部节点重叠）+ S8 右列时间轴悬空线头。已修 build-ppt.mjs 两处（说明文字移至树正下方 y5.2 居中；连线条件改 `(col===0&&row<3)||(col===1&&row<2)`），重建 → COM 重开通过 → **目视复核两页修复确认**。PPT 新时间戳 09:45（仓库外，zip 基线无涉）。judge 可选项（S5 行首闭引号/S3 卡片基线）评估为不值得临期改动，弃。**视觉验收流程自此恢复完整：judge 可用，交付物可走全量机器验收。**
### I19（09:08-09:53 完成）✅ 核验轮（零产品代码改动）：真实调度 09:53（runCount=19），四项全绿（zipcheck 216 全净/材料 mtime 基线/服务 200/git 一行 AM=上轮 PPT 补记未加，本轮 git add 收口）。PPT 终态 09:45 版（judge 验收+修复+目视复核完成，见上方补记）。无用户审看反馈。距截止约 14 小时。
### I20（09:53-10:40 完成）✅ 核验轮 + **用户审看通过里程碑**：核验四项全绿（10:40）。**用户确认「我觉得很好了」= v4 视频 + 09:45 版 PPT 审看通过，授权代执行更新**；代执行 commit 被 Mimosa 拦（8 高 3 中，全部为 REVIEW.md 已裁决误报类别）→ 完整提交信息已备 E:\A-GLM\登楼\02\commit-message.txt。**10:44 用户已在终端完成提交+推送**（c26be64；gh repo que3sui/skilltree 公开；CI gate 20s + sample-tests 16s 双绿——g++/pytest 首次真实执行即过）；随后我完成仓库门面（描述+8 topics）、v1.0.0 release（打在提交版 commit 上）、Pages 预启用、pages.yml 工作流+README 在线演示入口（用户 10:59 推送，Pages 33s 部署成功 https://que3sui.github.io/skilltree/ ）、在线演示二维码（defense/在线演示-二维码.png）。
### I21（10:40-11:2x）✅ **用户反馈驱动的改进：Pages 在线演示可操作性**：用户试用反馈「无法操作」——诊断=应用活着（全资产 200）但演示模式按设计隐藏评测入口；另发现演示包 index 不分 pack 导致首屏 eie 报告挂 cs 树（0/41 全暗）。修三处：①新增 `DemoReplay` 评测回放抽屉（演示模式 ⚡评测项目 按真实内置报告数据回放四 agent 阶段日志，诚实标注「回放+真实耗时」，结束自动载报告+点亮）；②报告列表按技能总数对齐当前 pack；③落地默认=真实通道优先+点亮最多（首屏 task-todo·ustc 20/41）。**IAB 完整冒烟绿**（落地 20/41/抽屉/回放 7 步/自动切报告 0/41·红队高风险/可重复开闭）；gate exit 0。zip 当时未动。
### I22（11:2x-11:3x 完成）✅ **用户要求的提交材料打磨（多维度比对后执行）**：比对结论=创新性/技术难度/一致性主体到位，最大缺口是**可验证性**（材料打包时 repo 未推送、Pages 未上线——所有主张都是纸面的）。执行（简介 4 处 + DESIGN 2 处 + 重生成 docx + 重打包）：①简介开头加「在线演示（无需安装）URL + 源代码 URL + CI 双绿 · v1.0.0」入口块；②**修正真 bug：§二「优质样例 12/41」与 §三「20/41」数字打架 → 20/41（科大统一入口·大赛官方模型；官方 API 通道 12/41）**；③§三演示与复现补「已部署 GitHub Pages 在线演示 + 评测回放」；④§五源代码行升完整 URL。DESIGN §10.3 可视化行补评测回放 + **新增 §10.5 可验证性**（三个 30 秒可点开验证项）。pandoc 重生成两 docx（python-docx 验证 8 处新内容全命中）。git add -A 后重打包：**新基线 10.4MB/218 条目**（+DemoReplay.tsx +pages.yml），zipcheck 全净（0/0/0、mp4=1/docx=2）。**视频/竞品表/架构内容/docx 排版按比对结论不动**（已达标或风险>收益）。核验清单的 216 预期自此改为 **218**。

## 下一轮起核验基线更新：zip=218 条目（其余不变：0 反斜杠/0 mimosa/0 env/mp4=1/docx=2；四材料 mtime 基线=视频 04:03 / 简介 docx 11:23 / 设计 docx 11:23 / zip 11:3x）
### I23（11:26）✅ 核验轮：新基线 218 全净、材料 mtime 符合、服务 200、git 全同步；确认用户已推送 Pages 提交（830c5e0 远端同步，Pages 10:59 上线）——I21+I22 仍在暂存区待用户推送。
### I24（11:35-12:3x）✅ **用户驱动：GitHub 直评「更具代表性的真实项目」**（用户指出 Hello-World 太简单）。定位：Hello-World 是打假侧战报（简单即故事），缺的是**正面侧真实第三方实证**；避开个人学生仓库（伦理），选组织级名项目。带 key 重启服务（USTC_API_KEY/USTC_MODEL=deepseek-v4-pro 只经环境变量），连续两次 GitHub 直评：**chalk/chalk 18/41·风险低·红队 6/6 全过·0 降级**（真测试真文档→全绿，11 分钟）；**antirez/kilo 14/41·风险中·flag 无测试→7 项 L2→L1 仲裁降级留痕**（真代码无测试→诚实扣分，9 分钟）。与 Hello-World 0/41·高 构成**三项目质量梯度**（全是真实第三方仓库）。已入演示包（demo:build，public/demo+src/demo-data 双位置）+ 简介 §二.7 战报升级为梯度表述 + DESIGN §10.5 补梯度；两 docx pandoc 重生成（6 处新内容命中）；gate exit 0；reports 11→13 无回归残留；**重打包 10.6MB/228 条目** zipcheck 全净（0/0/0、mp4=1/docx=2）。**期间发现用户 11:40 已推送 5beb24f（I21+I22 一并入库），Pages 11:40 重部署成功且线上已验证评测回放生效**；本轮新变更（6 新文件+材料梯度+演示包）在暂存区等下一次推送。
### I25（12:2x-12:54 完成）✅ **终验放行轮**：①官方提交预通知逐条核对全符合（四材料/单压缩/队长提交/文件名格式/分享 P0581 双勾/可重复提交以最新为准）。②正式包**九项终验全过**（解包检查包内实际内容：简介 11 项命中/设计文档模型说明 27 处/视频 4:47.64 H.264 720p/学号手机号密钥在内容中零出现/zipcheck 228 全净）——**发现并修正真问题：用户改名漏「伍」字（本科生队→本科生队伍），官方明示其他文件名可能无效**；正式文件名=PB24261891+15396665755+智能体赛道+本科生队伍.zip（zipcheck.cjs 硬编码路径同步更新——曾发现传参被忽略，此前同名故历史结果有效）。③按官方 12 细分项给用户作品自评（创新 8.5/实用 8/难度 7.5/完成度 9；三大软肋=零真实用户/无 RAG 关键词/单机部署，均有答辩口径）。④12:54 核验：228 全净/材料稳定/服务 200/git 全同步；**用户已推送 7ebed1c（chalk/kilo）**，Pages 12:18 部署成功，线上演示已含 chalk 18/低 + kilo 14/中（curl 实证）。⑤剩余唯一动作=用户瀚海上传正式 zip。
### I26（13:38 完成）✅ 核验轮：228 全净/服务 200/git 全同步（HEAD 7ebed1c）/材料 mtime 稳定。零改动。用户上传状态待其确认。
### I27（14:23 完成）✅ 核验轮：228 全净/服务 200/git 全同步/材料稳定。零改动。距截止约 9.5 小时，唯一剩余=用户瀚海上传。
### I28（15:08 完成）✅ 核验轮：228 全净/服务 200/git 全同步（HEAD 7ebed1c）/材料稳定。零改动。距截止约 8.8 小时。
### I29（15:53 完成）✅ 核验轮：228 全净/服务 200/git 全同步/材料稳定。零改动。距截止约 8 小时。
### I30（16:38 完成）✅ 核验轮：228 全净/服务 200/git 全同步/材料稳定。零改动。距截止约 7.3 小时。
### I31（17:23 完成）✅ 核验轮：228 全净/服务 200/git 全同步/材料稳定。零改动。距截止约 6.6 小时。
### I32（18:08 完成）✅ 核验轮：228 全净/服务 200/git 全同步/材料稳定。零改动。距截止约 5.8 小时。
### I33（18:53 完成）✅ 核验轮：228 全净/服务 200/git 全同步/材料稳定。零改动。距截止约 5 小时。
### I34（19:38 完成）✅ 核验轮：228 全净/服务 200/git 全同步/材料稳定。零改动。距截止约 4.3 小时。下轮（~20:23）过 20:00 收尾线。
### I35（20:23 完成）✅ 核验轮（进入收尾模式）：228 全净/本地服务 200/**Pages 在线 200（CI 最新 pages run 绿）**/git 全同步（7ebed1c）。距截止约 3.6 小时。**唯一剩余=用户瀚海上传**；上传完成后按用户授权开工夜间专项评测开发。
### I36（21:08 完成）✅ 收尾核验：228 全净/服务+Pages 双 200/git 同步。距截止约 2.8 小时。零改动。
### 🏁 **提交完成（2026-09-06 21:1x，用户确认「传完了」）**：正式 zip 已上传瀚海并分享 P0581（双勾），**距截止约 2.7 小时完成，全程无逾期风险**。参赛主线终结：评估立项（09-15 前）→ MVP → 改名建木 → 视频四版 → 四件材料三轮打磨 → 公开仓库+Pages+CI → 三项目梯度战报 → 终验放行 → 上传。磁盘 zip（228 版）自此为已提交存档，**不再重打包**。按用户授权，转入夜间开发：专项评测（决赛窗口清单第 1 项，设计要点见上）。
### I37（21:2x-22:2x 完成）✅ **夜间开发：专项评测（单节点 ↔ 单独评审任务）全链路落地**：
- **schema**：ReportSchema 新增可选 `scope`（skills/baseReportId/baseCreatedAt，向后兼容旧报告）；新增纯函数 **mergeReports(base, partial, pack)**——范围内技能被新裁决覆盖、范围外沿用 base（含 base 仲裁已生效的等级）、红队/勘察/证据/模型取本次重跑、仲裁留痕按技能分区合并、前置约束与统计用全量 pack 重算。
- **pipeline**：`skills?: string[]` + `baseReportFile`（省略自动定位输出目录中同仓库同本体最新报告，无基础报告则报错引导先跑全量）；scopedPack 只含目标分支/技能（取证只跑目标分支、红队/仲裁只作用子集）；合并后落盘为新报告（轨迹曲线天然记录单技能进步）。
- **CLI**：`--skills id,id --base 报告.json`；**服务端** /api/evaluate 透传 skills/baseReport（basename 防穿越）；**Web**：SidePanel「⚡ 专项评测此技能」（服务模式+本地目录证据；GitHub 证据暂隐藏）→ EvalDrawer 专项 preset（仓库路径自动填入、provider 预选 ustc、banner 说明 3 分钟 vs 11 分钟）。
- **验证**：gate 27/27（+3 mergeReports 单测）回归不变量未破；mock 实弹 ds.array（0.1s，自动定位 ustc base，20/41 保持）；**真实通道实弹 ds.hash = 2.6 分钟**（全量 7-11），合并后 20→19——**mock 虚高被专项真实重评自动纠正**（ds.hash L0·4 条引用），体系故事的活例；IAB 动线绿（按钮→抽屉 banner→路径/ustc 预填→可关）。
- 产品闭环成立：推荐补技能 → 练 → 专项提交 → 单节点重评 → 图谱单点亮。README 已补用法。**待用户晨间推送**：`git commit -m "feat: 专项评测——单节点重评合并进基础报告（--skills + mergeReports + 侧栏入口）" && git push`。
