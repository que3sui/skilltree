import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
// 主题变体（多 agent 设计分支）：ant=AntD5 企业秩序 / notion=温暖纸感 / linear=Linear 精密深色
// 全部以科大蓝为魂；?theme=ant|notion|linear|ustc|dark 切换，默认见下方
import "./themes/ant.css";
import "./themes/notion.css";
import "./themes/linear.css";

// 主题：默认科大配色；?theme= 可切 ant/notion/linear/ustc/dark。布局与令牌结构各主题共享。
document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get("theme") ?? "ant";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
