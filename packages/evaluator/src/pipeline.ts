/**
 * 评测流水线：证据摘要 → 勘察 → 逐分支取证 → 红队 → 仲裁 → 前置约束 → 报告落盘。
 * 前置约束与统计是确定性纯函数（@skilltree/schema），不经过模型——点亮逻辑可独立复核。
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ReportSchema,
  applyPrereqCaps,
  computeStats,
  mergeReports,
  type Report,
  type SkillPack,
} from "@skilltree/schema";
import { buildDigest, type Digest } from "./digest.js";
import { createProvider, type ProviderKind } from "./provider.js";
import { loadPack } from "./pack.js";
import { assertNoSecrets } from "./redact.js";
import { runArbiter, runAssessor, runRedTeam, runSurveyor } from "./agents.js";

export interface ProgressEvent {
  stage: "digest" | "survey" | "assess" | "redteam" | "arbitrate" | "finalize" | "done";
  message: string;
  percent: number;
}

export interface RunEvaluationOptions {
  repoPath: string;
  packDir: string;
  providerKind: ProviderKind;
  /** 报告输出目录，默认 reports/ */
  outDir?: string;
  /** 专项评测：只重评这些技能 id，结果合并进基础报告（未给 baseReportFile 时自动取输出目录中同仓库同本体的最新报告） */
  skills?: string[];
  /** 专项评测的基础报告路径（省略则自动定位） */
  baseReportFile?: string;
  /** GitHub 直评时的仓库 URL——写入报告复现命令（克隆目录用后即焚，本地路径不可复现） */
  repoUrl?: string;
  onProgress?: (e: ProgressEvent) => void;
}

export async function runEvaluation(opts: RunEvaluationOptions): Promise<Report> {
  const started = Date.now();
  const report = (stage: ProgressEvent["stage"], message: string, percent: number): void =>
    opts.onProgress?.({ stage, message, percent });

  const { pack, contentHash, issues } = loadPack(opts.packDir);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(`技能本体校验失败：\n${errors.map((e) => `- ${e.message}`).join("\n")}`);
  }

  report("digest", `读取证据 ${opts.repoPath}`, 5);
  const digest: Digest = buildDigest(opts.repoPath);

  // —— 专项评测：校验技能子集，定位基础报告 ——
  const outDir = path.resolve(opts.outDir ?? "reports");
  const totalSkills = pack.branches.reduce((n, b) => n + b.skills.length, 0);
  let skillSet: Set<string> | null = null;
  if (opts.skills && opts.skills.length > 0) {
    const known = new Set(pack.branches.flatMap((b) => b.skills.map((s) => s.id)));
    const unknown = opts.skills.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new Error(`未知技能 id：${unknown.join(", ")}（须属于本体 ${pack.id}）`);
    }
    skillSet = new Set(opts.skills);
    if (skillSet.size >= totalSkills) skillSet = null; // 覆盖全部技能 = 全量评测
  }
  let baseReport: Report | null = null;
  if (skillSet) {
    let baseFile: string | null = null;
    if (opts.baseReportFile) {
      // 基础报告必须位于报告输出目录内（防 ../ 越出；服务端另做 basename 白名单，双层防线）
      const resolved = path.resolve(opts.baseReportFile);
      if (resolved !== outDir && !resolved.startsWith(outDir + path.sep)) {
        throw new Error(`基础报告路径越出报告目录 ${outDir}：${opts.baseReportFile}`);
      }
      baseFile = resolved;
    } else {
      baseFile = findLatestBaseReport(outDir, digest.name, pack.id);
    }
    if (!baseFile) {
      throw new Error(`专项评测需要基础报告：${outDir} 中没有 ${digest.name} × ${pack.id} 的历史全量报告，请先跑一次全量评测`);
    }
    const parsed = ReportSchema.safeParse(JSON.parse(fs.readFileSync(baseFile, "utf8")));
    if (!parsed.success) throw new Error(`基础报告无法解析: ${baseFile}`);
    baseReport = parsed.data;
    report("digest", `专项模式：重评 ${skillSet.size} 个技能，完成后合并进基础报告（${path.basename(baseFile)}）`, 8);
  }

  const provider = createProvider(opts.providerKind);
  report("survey", "勘察 agent 分析项目结构", 12);
  const survey = await runSurveyor(provider, digest);

  // 专项模式：assessor/arbiter 只看子集所在分支与子集技能；红队只质证子集裁决
  const evalPack: SkillPack = skillSet
    ? {
        ...pack,
        branches: pack.branches
          .map((b) => ({ ...b, skills: b.skills.filter((s) => skillSet.has(s.id)) }))
          .filter((b) => b.skills.length > 0),
      }
    : pack;

  report("assess", "取证 agent 逐技能对照 rubric", 25);
  const assessments = await runAssessor(provider, evalPack, digest, (branch, i, total) => {
    report("assess", `取证：${branch.name}（${i}/${total}）`, 25 + Math.round((i / total) * 45));
  });

  report("redteam", "红队 agent 质疑取证结论", 75);
  const scopeNote = skillSet
    ? `【专项重评说明】本次为子集重评，取证等级概览仅含本次重评的 ${skillSet.size} 项技能；仓库级必查项（readme/tests/provenance/oversized/stub/git_history）照常全查——它们针对仓库本身，与子集大小无关。`
    : undefined;
  const redteam = await runRedTeam(provider, digest, survey, assessments, scopeNote);

  report("arbitrate", "仲裁 agent 汇总裁决", 85);
  const arbitration = await runArbiter(provider, evalPack, assessments, redteam);

  report("finalize", "应用前置约束并生成报告", 92);
  // 仲裁调整写回取证等级（保留 from/to 留痕）
  const adjusted = new Map(assessments.map((a) => [a.skillId, a.level]));
  for (const adj of arbitration.adjustments) adjusted.set(adj.skillId, adj.to);
  const finalAssessments = assessments.map((a) => ({ ...a, level: adjusted.get(a.skillId) ?? a.level }));

  const effective = applyPrereqCaps(pack, finalAssessments);
  const stats = computeStats(pack, effective);
  stats.durationMs = Date.now() - started;

  const candidate: Report = {
    reportVersion: 1,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    evidence: {
      kind: "local-dir",
      path: digest.root,
      name: digest.name,
      fileCount: digest.fileCount,
      totalLines: digest.totalLines,
      digestHash: digest.hash,
    },
    pack: { id: pack.id, version: pack.version, contentHash },
    model: { provider: provider.name, details: provider.details },
    survey,
    assessments: finalAssessments,
    redteam,
    arbitration,
    effective,
    stats,
  };
  // 一键复现命令：报告自证怎么跑出这份结论（GitHub 直评写仓库 URL——临时克隆目录不留存）
  const repoArg = opts.repoUrl ?? candidate.evidence.path;
  candidate.repro =
    `pnpm evaluate --repo ${repoArg} --pack ontology/packs/${pack.id} --provider ${provider.name}` +
    (skillSet ? ` --skills ${[...skillSet].join(",")}` : "");
  const result = ReportSchema.parse(candidate);

  // 落盘脱敏闸（实现见 redact.ts：四种密钥形态，命中即拒绝落盘）
  assertNoSecrets(result);

  // 专项模式：合并进基础报告后落盘（范围外技能沿用 base 裁决，前置约束与统计用全量 pack 重算）
  const finalReport = skillSet && baseReport ? mergeReports(baseReport, result, pack) : result;
  assertNoSecrets(finalReport);

  fs.mkdirSync(outDir, { recursive: true });
  const safeName = digest.name.replace(/[^\w.-]+/g, "_");
  const file = path.join(outDir, `${finalReport.createdAt.replace(/[:.]/g, "-")}_${safeName}_${provider.name}.json`);
  fs.writeFileSync(file, JSON.stringify(finalReport, null, 2), "utf8");

  report("done", file, 100);
  return finalReport;
}

/** 在输出目录里找同仓库同本体的最新可解析报告作为专项评测的基础（全量或已合并报告均可；不可解析的跳过） */
function findLatestBaseReport(outDir: string, evidenceName: string, packId: string): string | null {
  if (!fs.existsSync(outDir)) return null;
  const cands: { file: string; createdAt: string }[] = [];
  for (const name of fs.readdirSync(outDir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed = ReportSchema.safeParse(JSON.parse(fs.readFileSync(path.join(outDir, name), "utf8")));
      if (!parsed.success) continue; // 无法按当前 schema 解析的历史/损坏文件不作为基础
      const r = parsed.data;
      if (r.evidence?.name === evidenceName && r.pack?.id === packId) {
        cands.push({ file: path.join(outDir, name), createdAt: r.createdAt });
      }
    } catch {
      // 非报告 JSON（如临时文件）跳过
    }
  }
  cands.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return cands[0]?.file ?? null;
}
