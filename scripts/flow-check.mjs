#!/usr/bin/env node
/**
 * 动线回归：对运行中的服务（默认 127.0.0.1:8787）做 API 级全流程检查。
 * 覆盖：本体列表/切换、报告按 pack 过滤、资源库、推荐（阻塞链）、直评安全闸。
 * 运行：pnpm flow-check   （需要 server 在跑；退出码非 0 = 有断点）
 */
const BASE = process.env.FLOW_BASE ?? "http://127.0.0.1:8787";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " —— " + detail : ""}`);
  if (!ok) failures++;
}

async function get(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.json() };
}
async function post(path, data) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  // 1) 本体列表与切换
  const packs = await get("/api/packs");
  const ids = (packs.body.packs ?? []).map((p) => p.id);
  check("本体列表 ≥2（cs+mds+…）", ids.length >= 2, ids.join(","));
  check("含 cs 与 mds", ids.includes("cs") && ids.includes("mds"));

  const csPack = await get("/api/pack?name=cs");
  check("cs 本体可加载", csPack.body.pack?.id === "cs" && csPack.body.pack.branches?.length >= 5);
  const mdsPack = await get("/api/pack?name=mds");
  check("mds 本体可加载", mdsPack.body.pack?.id === "mds" && mdsPack.body.pack.branches?.length >= 3);

  // 2) 报告按本体过滤（隔离性）
  const csReports = await get("/api/reports?pack=cs");
  const mdsReports = await get("/api/reports?pack=mds");
  const csAllCs = csReports.body.reports.every((r) => !r.repoName.includes("modeling-comp"));
  const mdsOnlyMds = mdsReports.body.reports.every((r) => r.repoName.includes("modeling-comp"));
  check("cs 报告不含 mds 样本", csAllCs);
  check("mds 报告只含 mds 样本", mdsOnlyMds && mdsReports.body.reports.length >= 1);

  // 3) 资源库
  const res = await get("/api/resources");
  check("资源库 ≥50 条", (res.body.resources ?? []).length >= 50, String(res.body.resources?.length));

  // 4) 推荐阻塞链（cs · algo.dp 依赖 recursion/stackqueue）
  const csReportFile = csReports.body.reports[0]?.file;
  const rec = await post("/api/recommend", {
    skillId: "algo.dp",
    skillName: "动态规划",
    packId: "cs",
    reportFile: csReportFile,
    blocked: true,
  });
  check("推荐返回结构", Array.isArray(rec.body.path) && Array.isArray(rec.body.picks));

  // 5) 直评安全闸
  const bad1 = await post("/api/evaluate", { repoUrl: "http://127.0.0.1:9/x", provider: "mock" });
  check("安全闸拒非 https", bad1.status === 400 && /https/.test(bad1.body.error ?? ""));
  const bad2 = await post("/api/evaluate", { repoUrl: "https://evil.example.com/a/b", provider: "mock" });
  check("安全闸拒非白名单 host", bad2.status === 400 && /github|gitee/.test(bad2.body.error ?? ""));

  // 6) REST 契约对账：逐端点断言出参形状（ARCHITECTURE §6 的执法版）
  const packBody = csPack.body;
  check("契约 /api/packs 形状", packs.body.packs.every((p) => typeof p.id === "string" && typeof p.name === "string"));
  check("契约 /api/pack 形状", typeof packBody.pack?.id === "string" && Array.isArray(packBody.pack?.branches) && Array.isArray(packBody.issues));
  check("契约 /api/reports 条目形状", csReports.body.reports.every((r) => "file" in r && "lit" in r && "total" in r && "createdAt" in r && "packId" in r && "scoped" in r));
  const oneReport = await get(`/api/reports/${encodeURIComponent(csReportFile)}`);
  check("契约 /api/reports/:file 返回 Report", oneReport.status === 200 && "assessments" in oneReport.body && "redteam" in oneReport.body);
  const badFile = await get("/api/reports/..%2Fsecret.json");
  check("契约 :file 拒绝路径段", badFile.status === 400 || badFile.status === 404);

  // 7) 组装日志端点（空态引导数据源）：200/404 两分支 + 32KB 截断闸上限
  const asmOk = await fetch(BASE + "/api/assembly/eie");
  const asmOkText = await asmOk.text();
  check(
    "assembly eie=200 且为 markdown",
    asmOk.status === 200 && (asmOk.headers.get("content-type") ?? "").includes("text/markdown") && /组装/.test(asmOkText),
  );
  check("assembly 体积 ≤32KB（截断闸）", Buffer.byteLength(asmOkText, "utf8") <= 32 * 1024 + 256);
  const asmMiss = await fetch(BASE + "/api/assembly/cs");
  check("assembly 无日志 pack=404", asmMiss.status === 404 && /组装日志/.test(await asmMiss.text()));
  const asmBad = await fetch(BASE + "/api/assembly/..%2Fevil");
  check("assembly 拒路径段 packId", asmBad.status === 400 || asmBad.status === 404);

  // 8) 证据链对账：reports/ 全部报告独立重算逐项吻合（证据链可复现性的常驻断言）
  const { execSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  try {
    const out = execSync("pnpm exec tsx scripts/verify-report.mjs", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    check("证据链对账 verify:report 全过", /全部 \d+ 份报告证据链对账通过/.test(out));
  } catch (e) {
    check("证据链对账 verify:report 全过", false);
    console.error(String(e.stderr || e.stdout || e.message || "").slice(-600));
  }

  console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("flow-check 无法连接服务或异常：", e.message);
  process.exit(1);
});
