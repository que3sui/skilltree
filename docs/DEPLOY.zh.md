# 部署与演示指南

> 目标读者：要在比赛提交 / 答辩现场展示「建木 SkillTree」的人。
> 两条路径：**静态演示包**（评委可点开链接，零后端零 key）与 **本地完整服务**（可现场触发真实评测）。

## 一、静态演示包（推荐用于提交与分享）

构建产物是一个纯静态目录，含内置演示数据（技能本体 + 4 份真实评测报告：
task-todo×2 模型对照 / algo-notebook / empty-stub）。不需要服务器、不需要 API key。

```bash
pnpm install
pnpm demo:build          # = 打包演示数据 + vite 构建
```

产物在 `apps/web/dist/`，可直接整目录拖到任意静态托管：

| 平台 | 做法 | 备注 |
|---|---|---|
| Cloudflare Pages | Create project → Direct Upload → 拖 dist | `*.pages.dev` 域名国内一般可访问 |
| Vercel | `npx vercel deploy apps/web/dist --prod`（需登录） | 默认域名国内时好时坏 |
| GitHub Pages | 建 repo 推送 dist → Settings/Pages 选分支 | 子路径也能跑（构建已用相对 base） |

拿到 URL 后生成二维码（海报 / PPT 用）：

```bash
npx qrcode-terminal "https://你的域名/"
```

评委在微信里直接打开这个链接即可浏览（H5，无需安装任何东西）。

**演示模式说明**：静态托管下界面右上会显示「演示数据」标注，评测按钮隐藏——
这是有意设计（没有后端就无法安全触发评测），本地跑服务即可恢复完整功能。

## 二、本地完整服务（答辩现场 / 录屏推荐）

```bash
pnpm install
pnpm server              # http://127.0.0.1:8787 ，托管构建产物 + API
```

支持三种演示动作：
1. 选报告切换对比（真实项目 12/41 · 来源存疑 9/41 · 空壳 0/41）；
2. `⚡ 评测项目` 现场跑 mock（秒级，无需 key）或 deepseek（约 11–14 分钟，需 `DEEPSEEK_API_KEY`）;
3. `▶ 回放点亮` 重播点亮动画（录屏黄金镜头）。

录屏建议顺序：问题 30s → 选报告自动回放 → 点开节点看 rubric 与证据引用 →
评审留痕面板（红队质疑 + 仲裁下调）→ 切 empty-stub 展示 0/41 的区分度。

## 三、接入校园大模型平台（比赛算力）

评测器走 OpenAI 兼容协议，换端点只改环境变量：

```bash
export DEEPSEEK_BASE_URL="https://校园平台端点/v1"
export DEEPSEEK_API_KEY="赛事分发的队伍 key"
export DEEPSEEK_MODEL="DeepSeek-V4"   # 按平台实际模型名
```

词元计划每日保障 50 亿 token，跑几十次完整评测绰绰有余。

## 四、关于微信小程序（结论：本次不做，理由如下）

1. **重写成本**：现有界面是 React + SVG，小程序需 WXML/WXSS 重写三视图与 3D 层叠，一周量级；
2. **平台限制**：即使做 webview 套壳，小程序要求域名 HTTPS + ICP 备案，比赛周期内拿不下来;
3. **等效替代已达成目的**：静态 H5 + 二维码，评委微信扫码即开，体验与"小程序入口"一致。

若比赛后仍要做小程序，建议做成「查看端」（只读图谱 + 分享卡片），评测仍留在服务端。

## 安全红线

- `dist/` 与提交压缩包**绝不包含** `.env`、API key；
- 公开部署前轮换所有曾出现在聊天/日志里的 key。
