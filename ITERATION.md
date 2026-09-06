# 建木 滚动迭代计划（rolling）

> 本文件是自动迭代的**唯一活跃计划**；每轮迭代（45 分钟）收尾时重写。
> 四轨：**B=系统边界 / S=安全边界 / U=视觉与流畅 / C=竞品追平**。
> 纪律：gate 全绿（含 arch:check）；key 只走环境变量；打包前 git add -A；提交包基线不可破坏。

## 当前轮次：I21（2026-09-06 10:40 规划；I1-I20 已完成见文末记录）

> **低频核验节奏**：每轮=终包 zipcheck + 四件材料核对 + 服务健康 + 等用户动作（审看 v4 / commit / 上传）。
> 无可证实高价值项不写代码。已过 2026-09-06 20:00 则纯收尾（验收清单+瀚海步骤置顶）。

### I21 核验清单（每轮重复）
- [ ] node E:\A-GLM\登楼\02\recordings\zipcheck.cjs（216 条目/0 反斜杠/0 mimosa/0 env/mp4=1/docx=2）
- [ ] 视频 v4 4:47 在位；四件材料 mtime 无意外变化（基线：视频 04:03 / 简介 docx 03:47 / 设计 docx 04:08 / zip 04:36）
- [ ] curl 8787 /api/packs=200（服务死则重启：cd apps/server && npx tsx src/index.ts 后台）
- [ ] git status 应为 198 暂存全同步、无未跟踪文件（PPT 只在仓库外 defense/，绝入 git/zip）
- [ ] 若用户已反馈审看意见 → 按意见处理（这是唯一改代码的正当理由）

### 下一轮：I22+
同上核验；20:00 后附验收清单与上传步骤。答辩材料（PPT 已成片于 E:\A-GLM\登楼\02\defense\）待用户试讲反馈后修订。

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
### I20（09:53-10:40 完成）✅ 核验轮 + **用户审看通过里程碑**：核验四项全绿（10:40）。**用户确认「我觉得很好了」= v4 视频 + 09:45 版 PPT 审看通过，授权代执行更新**；代执行 commit 被 Mimosa 拦（8 高 3 中，全部为 REVIEW.md 已裁决误报类别——CLI 路径参数入口判 path-traversal、localeCompare 触发 mongo-sort、样例跨文件污点；按红线不绕行）→ 完整提交信息已备 **E:\A-GLM\登楼\02\commit-message.txt**（仓库外不污染暂存区），等用户终端 `git commit -F ..\commit-message.txt` + `gh repo create que3sui/skilltree --public --source . --push`。剩余用户动作仅两件：终端 commit+push、瀚海上传。
