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
  type Report,
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

  const provider = createProvider(opts.providerKind);
  report("survey", "勘察 agent 分析项目结构", 12);
  const survey = await runSurveyor(provider, digest);

  report("assess", "取证 agent 逐技能对照 rubric", 25);
  const assessments = await runAssessor(provider, pack, digest, (branch, i, total) => {
    report("assess", `取证：${branch.name}（${i}/${total}）`, 25 + Math.round((i / total) * 45));
  });

  report("redteam", "红队 agent 质疑取证结论", 75);
  const redteam = await runRedTeam(provider, digest, survey, assessments);

  report("arbitrate", "仲裁 agent 汇总裁决", 85);
  const arbitration = await runArbiter(provider, pack, assessments, redteam);

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
  const result = ReportSchema.parse(candidate);

  // 落盘脱敏闸（实现见 redact.ts：四种密钥形态，命中即拒绝落盘）
  assertNoSecrets(result);

  const outDir = path.resolve(opts.outDir ?? "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const safeName = digest.name.replace(/[^\w.-]+/g, "_");
  const file = path.join(outDir, `${result.createdAt.replace(/[:.]/g, "-")}_${safeName}_${provider.name}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), "utf8");

  report("done", file, 100);
  return result;
}
