import type { ContextReport } from "../shared/protocol.ts";

export const SCORECARD_TOP_K = 5;

export interface ContextScore {
  hits: number;
  edited: number;
  predictedRead: number;
  topPredicted: string[];
}

export function scoreContext(report: Pick<ContextReport, "files" | "read" | "edited">, k = SCORECARD_TOP_K): ContextScore {
  const topPredicted = report.files.filter((file) => file.role !== "mentioned").slice(0, k).map((file) => file.path);
  const predicted = new Set(report.files.map((file) => file.path));
  const top = new Set(topPredicted);
  return {
    hits: report.edited.filter((path) => top.has(path)).length,
    edited: report.edited.length,
    predictedRead: report.read.filter((path) => predicted.has(path)).length,
    topPredicted,
  };
}

export function cacheHitRatio(inputTokens: number, cacheReadTokens: number | undefined): number | undefined {
  if (cacheReadTokens === undefined || inputTokens <= 0) return undefined;
  return Math.min(1, cacheReadTokens / inputTokens);
}
