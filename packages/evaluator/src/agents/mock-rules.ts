/**
 * Mock 评测规则：与真实模型走完全相同的提示词通道，
 * 只依据提示词中的证据摘要做确定性裁决——保证 demo/回归测试可离线、可复现。
 * 这些规则是"最朴素的合理性底线"，不代表真实模型水平。
 */
import type { ChatRequest } from "../provider.js";

export function mockComplete(agent: string, req: ChatRequest): string {
  switch (agent) {
    case "surveyor":
      return mockSurveyor(req.user);
    case "assessor":
      return mockAssessor(req.user);
    case "redteam":
      return mockRedteam(req.user);
    case "arbiter":
      return mockArbiter(req.user);
    default:
      return JSON.stringify({ error: `mock: 未知 agent ${agent}` });
  }
}

// ---------------------------------------------------------------------------
// 从提示词文本中还原证据摘要（只读取呈现给模型的内容，不依赖额外状态）
// ---------------------------------------------------------------------------

interface MockFile {
  path: string;
  lines: number;
  content: string;
}

function parseFiles(text: string): MockFile[] {
  const marks = [...text.matchAll(/===== FILE: (.+?) \((\d+) 行[^)]*\) =====\n/g)].map((m) => ({
    path: m[1] ?? "",
    lines: Number(m[2] ?? 0),
    idx: m.index ?? 0,
  }));
  const files: MockFile[] = [];
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i]!;
    const next = marks[i + 1];
    const contentStart = text.indexOf("\n", cur.idx) + 1;
    const contentEnd = next ? next.idx : text.length;
    files.push({ path: cur.path, lines: cur.lines, content: text.slice(contentStart, contentEnd) });
  }
  return files;
}

function countHits(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let count = 0;
  let pos = h.indexOf(n);
  while (pos !== -1) {
    count++;
    pos = h.indexOf(n, pos + n.length);
  }
  return count;
}

const SOURCE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|py|java|c|h|cpp|hpp|cs|go|rs|rb|php|swift|kt|scala|vue|svelte)$/i;

// ---------------------------------------------------------------------------
// surveyor
// ---------------------------------------------------------------------------

function mockSurveyor(user: string): string {
  const files = parseFiles(user);
  const languages: Record<string, number> = {};
  let packageJson = "";
  const entryPoints: string[] = [];
  for (const f of files) {
    const ext = f.path.includes(".") ? f.path.slice(f.path.lastIndexOf(".") + 1).toLowerCase() : "other";
    languages[ext] = (languages[ext] ?? 0) + 1;
    if (f.path.endsWith("package.json")) packageJson = f.content;
    if (/(^|\/)(index|main|app)\.[a-z]+$/i.test(f.path)) entryPoints.push(f.path);
  }
  const top = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}×${v}`);
  const totalLines = files.reduce((s, f) => s + f.lines, 0);
  const scripts: string[] = [];
  if (packageJson) {
    if (/"build"\s*:/.test(packageJson)) scripts.push("npm run build");
    if (/"test"\s*:/.test(packageJson)) scripts.push("npm test");
  }
  const observations: string[] = [];
  const readme = files.find((f) => /(^|\/)readme/i.test(f.path));
  observations.push(readme ? `包含 README（${readme.lines} 行）` : "缺少 README");
  const testFiles = files.filter((f) => /(test|spec)/i.test(f.path));
  observations.push(testFiles.length > 0 ? `测试文件 ${testFiles.length} 个` : "未发现测试文件");
  const largest = [...files].sort((a, b) => b.lines - a.lines)[0];
  if (largest) observations.push(`最大文件 ${largest.path}（${largest.lines} 行）`);

  return JSON.stringify({
    summary: `证据包含 ${files.length} 个文本文件、约 ${totalLines} 行；语言分布 ${top.join("、") || "未知"}。`,
    languages,
    entryPoints: entryPoints.slice(0, 5),
    buildCommands: scripts,
    testCommands: scripts.filter((s) => s.includes("test")),
    observations,
  });
}

// ---------------------------------------------------------------------------
// assessor：关键词命中密度 → 等级；命中文件 → 引用
// ---------------------------------------------------------------------------

interface SkillMarker {
  id: string;
  keywords: string[];
}

function parseSkillMarkers(user: string): SkillMarker[] {
  return [...user.matchAll(/\[\[SKILL:([\w.-]+)\|([^\]]+)\]\]/g)].map((m) => ({
    id: m[1] ?? "",
    keywords: (m[2] ?? "").split("|").filter(Boolean),
  }));
}

function mockAssessor(user: string): string {
  const files = parseFiles(user);
  const skills = parseSkillMarkers(user);
  const assessments = skills.map(({ id, keywords }) => {
    const scored = files
      .map((f) => {
        let hits = 0;
        const matched: string[] = [];
        for (const kw of keywords) {
          const c = countHits(f.content, kw);
          if (c > 0) {
            hits += c;
            matched.push(kw);
          }
        }
        return { file: f, hits, matched };
      })
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);

    const score = scored.reduce((s, x) => s + x.hits, 0);
    const spread = scored.length;
    const sourceScored = scored.filter((s) => SOURCE_EXT.test(s.file.path));
    const level =
      score >= 25 && spread >= 5 && sourceScored.length >= 3
        ? 3
        : score >= 8 && spread >= 2 && sourceScored.length >= 1
          ? 2
          : score >= 2
            ? 1
            : 0;
    const confidence = Math.min(0.95, 0.4 + spread * 0.09 + Math.min(score, 40) * 0.008);

    // criteria 平铺数组：按等级推导逐条裁决（真实条目文本由 pipeline 按本体回填）
    const criteria: unknown[] = [];
    for (let lv = 1; lv <= 3; lv++) {
      const verdict = level >= lv ? "met" : level === lv - 1 ? "partial" : "not-evidenced";
      criteria.push({
        verdict,
        citations:
          verdict === "not-evidenced"
            ? []
            : scored.slice(0, 2).map((s) => ({
                file: s.file.path,
                note: `命中关键词：${s.matched.slice(0, 3).join("、")}`,
              })),
        comment: verdict === "met" ? `证据密度达到 L${lv} 档` : verdict === "partial" ? "证据部分覆盖" : "",
      });
    }
    return {
      skillId: id,
      level,
      confidence: Number(confidence.toFixed(2)),
      rationale: `关键词命中 ${score} 处、分布于 ${spread} 个文件（其中源码文件 ${sourceScored.length} 个）。`,
      criteria,
    };
  });
  return JSON.stringify({ assessments });
}

// ---------------------------------------------------------------------------
// redteam：来源核验 / 测试存在性 / 巨型文件 / 空壳证据
// ---------------------------------------------------------------------------

function mockRedteam(user: string): string {
  const files = parseFiles(user);
  const checks: { name: string; title: string; verdict: string; detail: string }[] = [];
  let risk = "low";

  const readme = files.find((f) => /(^|\/)readme/i.test(f.path));
  checks.push({
    name: "readme_quality",
    title: "项目说明完整性",
    verdict: readme && readme.lines >= 15 ? "pass" : "warn",
    detail: readme ? `README ${readme.lines} 行` : "缺少 README，无法了解项目自述",
  });

  const testFiles = files.filter((f) => /(test|spec)/i.test(f.path));
  checks.push({
    name: "tests_present",
    title: "自动化测试存在性",
    verdict: testFiles.length > 0 ? "pass" : "warn",
    detail:
      testFiles.length > 0
        ? `发现 ${testFiles.length} 个测试文件：${testFiles.map((f) => f.path).join("、")}`
        : "未发现测试文件，能力等级证据的可信度下降",
  });
  if (testFiles.length === 0 && risk === "low") risk = "medium";

  const provenanceFiles: string[] = [];
  const provenance = /copied from|转载|来源\s*[:：]|参考自|基于\s*https?:\/\/|github\.com\/[^\s/]+\/[^\s/]+\/blob/i;
  for (const f of files) {
    if (provenance.test(f.content)) provenanceFiles.push(f.path);
  }
  if (provenanceFiles.length > 0) {
    risk = "high";
    checks.push({
      name: "provenance",
      title: "来源标注与原创性",
      verdict: "flag",
      detail: `以下文件包含外部来源/转载标记，需降级核查：${provenanceFiles.join("、")}`,
    });
  } else {
    checks.push({ name: "provenance", title: "来源标注与原创性", verdict: "pass", detail: "未发现外部来源标记" });
  }

  const oversized = files.filter((f) => f.lines > 800 && SOURCE_EXT.test(f.path));
  if (oversized.length > 0) {
    if (risk === "low") risk = "medium";
    checks.push({
      name: "oversized_file",
      title: "巨型文件（疑似整体粘贴/生成）",
      verdict: "warn",
      detail: oversized.map((f) => `${f.path}（${f.lines} 行）`).join("、"),
    });
  } else {
    checks.push({ name: "oversized_file", title: "巨型文件（疑似整体粘贴/生成）", verdict: "pass", detail: "无异常大文件" });
  }

  const sourceFiles = files.filter((f) => SOURCE_EXT.test(f.path));
  const sourceLines = sourceFiles.reduce((s, f) => s + f.lines, 0);
  const todoCount = sourceFiles.reduce(
    (s, f) => s + countHits(f.content, "TODO") + countHits(f.content, "FIXME") + countHits(f.content, "未实现"),
    0,
  );
  const isStub = sourceLines < 40 || (sourceLines > 0 && todoCount * 8 > sourceLines);
  if (isStub) {
    risk = "high";
    checks.push({
      name: "stub_evidence",
      title: "证据充分性",
      verdict: "flag",
      detail: `源码仅约 ${sourceLines} 行${todoCount > 0 ? `，含 ${todoCount} 处 TODO/未实现标记` : ""}，不足以支撑任何技能点亮`,
    });
  } else {
    checks.push({ name: "stub_evidence", title: "证据充分性", verdict: "pass", detail: `源码约 ${sourceLines} 行，证据充分` });
  }

  return JSON.stringify({ checks, overallRisk: risk });
}

// ---------------------------------------------------------------------------
// arbiter：依据红队结果做确定性降级
// ---------------------------------------------------------------------------

function mockArbiter(user: string): string {
  // 提示词中嵌入了 {"assessments":[...],"redteam":{...}} 的单行 JSON 块，直接取回。
  // 注意提示词末尾还有"输出模板"也是花括号行，因此逐行尝试解析，取第一个含 assessments 的对象。
  let payload: {
    assessments?: { skillId: string; level: number; citedFiles?: string[] }[];
    redteam?: { checks?: { name: string; verdict: string; detail: string }[]; overallRisk?: string };
  } | null = null;
  for (const line of user.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{") || !t.endsWith("}")) continue;
    try {
      const parsed = JSON.parse(t) as typeof payload;
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.assessments)) {
        payload = parsed;
        break;
      }
    } catch {
      // 不是 payload 行，继续
    }
  }
  if (!payload) return JSON.stringify({ adjustments: [], notes: "mock 仲裁：状态解析失败，维持原判" });
  const assessments = payload.assessments ?? [];
  const redteam = payload.redteam ?? { checks: [], overallRisk: "low" };
  const adjustments: { skillId: string; from: number; to: number; reason: string }[] = [];
  const notes: string[] = [];

  const stub = (redteam.checks ?? []).find((c) => c.name === "stub_evidence" && c.verdict === "flag");
  if (stub) {
    for (const a of assessments) {
      if (a.level > 0) {
        adjustments.push({ skillId: a.skillId, from: a.level, to: 0, reason: "证据充分性不足（空壳/占位项目），全部不予点亮" });
      }
    }
    notes.push("红队判定证据不充分：所有等级清零。");
    return JSON.stringify({ adjustments, notes: notes.join(" ") });
  }

  const flaggedFiles = new Set<string>();
  for (const c of redteam.checks ?? []) {
    if (c.verdict === "flag") {
      for (const m of c.detail.matchAll(/[\w./\\-]+\.\w+/g)) flaggedFiles.add(m[0] ?? "");
    }
  }
  if (flaggedFiles.size > 0) {
    for (const a of assessments) {
      if (a.level <= 1) continue;
      const cited = a.citedFiles ?? [];
      const hit = cited.some((f) => f && [...flaggedFiles].some((ff) => f.endsWith(ff) || ff.endsWith(f)));
      if (hit) {
        adjustments.push({
          skillId: a.skillId,
          from: a.level,
          to: 1,
          reason: "主要证据引用了被红队标记的文件（来源存疑），等级降为 L1 待人工复核",
        });
      }
    }
    notes.push("存在来源存疑证据，相关技能降级并建议人工复核。");
  }
  if (redteam.overallRisk === "medium") {
    notes.push("存在一般性警示（如缺少测试），建议结合面试/答辩复核。");
  }
  if (adjustments.length === 0 && notes.length === 0) notes.push("红队未发现风险，维持取证结论。");
  return JSON.stringify({ adjustments, notes: notes.join(" ") });
}
