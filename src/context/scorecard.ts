import type { ContextReport } from "../shared/protocol.ts";

export const SCORECARD_TOP_K = 5;

export interface ContextScore {
  /** Edited files that were among the top-k predicted files. */
  hits: number;
  /** Edited files in total. */
  edited: number;
  /** Predicted files the agent actually read. */
  predictedRead: number;
  /** Top-k predicted paths, in rank order. */
  topPredicted: string[];
}

/**
 * Compares Anvil's prediction (the ranked context pack) with what the agent actually read and edited.
 * "Hits" is file-level Acc@k restricted to edited files, the measure used by localisation papers (LocAgent, ContextBench).
 */
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

/** Cache-hit share of the latest input, or undefined when the provider reports no cache data. */
export function cacheHitRatio(inputTokens: number, cacheReadTokens: number | undefined): number | undefined {
  if (cacheReadTokens === undefined || inputTokens <= 0) return undefined;
  return Math.min(1, cacheReadTokens / inputTokens);
}
