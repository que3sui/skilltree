# 架构与系统边界（v1 · 2026-09-06）

> 一句话：**ontology 是数据，evaluator 是规则引擎，server 是编排与传输，web 是呈现，
> schema 是契约，scripts 是工具链。** 跨边界的每一条通道都有唯一、显式的闸。

## 1. 模块与所有权

| 模块 | 拥有 | 绝不 |
|---|---|---|
| `packages/schema` | 领域模型与校验（SkillPack/Report/zod）——所有模块的公共契约 | 不含任何 I/O |
| `packages/evaluator` | 证据摘要（digest）、四 agent 流水线、provider 出站、本体加载（pack/library/resources） | 不 import web/server；不启动网络服务 |
| `apps/server` | HTTP 编排：jobs、packs/reports 读写、推荐、远程克隆、静态托管 | 不含评价业务规则（规则只在 evaluator）；不做渲染 |
| `apps/web` | 呈现与交互：三视图、面板、主题、API 客户端 | 不触文件系统；不含评测逻辑 |
| `ontology/` | **数据不是代码**：packs（学科本体）/library（可复用原子）/resources（资源索引），YAML+PR 治理 | 不写逻辑 |
| `scripts/` | 工具链：打包/组装/回归/动线检查 | 不被运行时 import |

依赖方向（只允许向下）：web → schema；server → evaluator → schema；scripts → evaluator。反向与横向（web→evaluator、server→web）一律禁止。

## 2. 跨边界通道清单（每条通道一个闸）

| 通道 | 闸 | 位置 |
|---|---|---|
| evaluator → 外部模型 API | `assertSafeBaseUrl`：仅 http/https、拒环回/私有/保留地址与本地主机名、拒 URL 凭据 | provider.ts |
| server ← 远程仓库 URL | 白名单 github.com/gitee.com + https + URL 形状 + 浅克隆 + 临时目录焚毁 | server/index.ts `assertSafeRepoUrl`/`shallowClone` |
| digest/clone → 本地文件系统 | `inRoot` 界内断言 + 条目名白名单（拒 `../`、分隔符、空名）+ 符号链接跳过 | digest.ts / pack.ts |
| 证据摘要内容 → LLM | 机密文件排除（.env*、*.pem、*.key、*credential*、*secret* 不进摘要） | digest.ts `EXCLUDE_FILE_RE` |
| web ↔ server | REST 契约（api.ts 是唯一客户端）；web 对页面内容只用作定位、绝不执行 | api.ts |
| 评测并发 | 同时最多 2 个评测作业；evaluate/recommend 每 IP 限速 | server/index.ts 护栏 |

## 3. 残余攻击面与本机工具定位的取舍

建木评测器当前定位是**单用户本机工具**（127.0.0.1），无鉴权与多租户——这是刻意边界而非遗漏：
- 本机 CLI/服务的 `--repo`/`repoPath` 允许用户指定任意本地目录（工具本职）；公网部署前必须加鉴权与路径白名单，见 backlog。
- digest 会把仓库文本发给配置的模型端点（端点受 `assertSafeBaseUrl` 约束且 key 只走环境变量）；机密文件已在摘要层排除，双保险。
- 报告 JSON 含仓库文件名与行号证据（可复现性所需）——不含文件全文本；导出/上传前无密钥（打包脚本红线校验）。

## 4. 主题与呈现的边界

主题层（styles.css 令牌 + themes/*.css）只允许覆盖令牌与少量组件形态，**不改布局与信息结构**；五主题（ant 默认/notion/linear/ustc/dark）共享同一 DOM 与令牌契约。

## 5. 评测全链路时序（谁在什么时候做什么）

```
[web 抽屉]  POST /api/evaluate {repoPath|repoUrl, provider, packId}
    │
[server]    限速/并发闸 → repoUrl? assertSafeRepoUrl → git clone --depth 50 (临时目录)
    │        本地路径? 存在性校验
    ├────────► [evaluator] buildDigest（机密文件排除 + git 历史通道）
    │             ├─► provider.complete ──► 校内网关（assertSafeBaseUrl）→ 四 agent 逐个
    │             │    surveyor → assessor×分支 → redteam（含 git_history）→ arbiter
    │             ├─► 前置封顶（纯函数）→ ReportSchema → assertNoSecrets 脱敏闸
    │             └─► 写 reports/<时间>_<仓库>_<provider>.json
    │◄──────── onProgress（进度日志）
[web]       轮询 /api/jobs/:id → done → onDone 刷新报告列表 → 自动点亮回放
```

## 6. REST 契约（web ↔ server 唯一通道，客户端实现=apps/web/src/api.ts）

| 端点 | 方法 | 入参 | 出参 | 错误 |
|---|---|---|---|---|
| /api/packs | GET | — | `{packs:[{id,name,version}]}` | 500 加载失败 |
| /api/pack | GET | `?name=<packId>` | `{pack,issues}` | 500 |
| /api/reports | GET | `?pack=<packId>` | `{reports:[{file,repoName,provider,lit,total,risk,createdAt}]}`（新→旧） | — |
| /api/reports/:file | GET | basename+.json | Report JSON | 400 非法名 / 404 |
| /api/evaluate | POST | `{repoPath|repoUrl,provider,packId}` | `{id}` | 429 限速/并发 / 400 校验 |
| /api/jobs/:id | GET | — | `{status,log[],error?,reportFile?}` | — |
| /api/resources | GET | — | `{resources[]}` | 500 |
| /api/recommend | POST | `{skillId,skillName,packId,reportFile,blocked}` | `{path[],picks[]}` | 429 / 静态回退 |

演示模式（静态托管）：api/* 失败 → 逐级回退 demo/*（fetch）→ 构建期内嵌 JS 包（file:// 也可开）。

