import { createTwoFilesPatch, diffArrays } from "diff";
import type { DiffStat } from "../shared/protocol.ts";

export type HunkDecision = "pending" | "accepted" | "rejected" | "both";

export interface Hunk {
  index: number;
  baselineStart: number;
  baselineLines: string[];
  proposalLines: string[];
  added: number;
  removed: number;
}

export interface ReviewRender {
  text: string;
  removedLines: number[];
  addedLines: number[];
  hunkAnchors: Array<{ index: number; line: number }>;
}

export function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

export function computeHunks(baseline: string, proposal: string): Hunk[] {
  const hunks: Hunk[] = [];
  let line = 0;
  let open: Hunk | undefined;
  for (const change of diffArrays(splitLines(baseline), splitLines(proposal))) {
    if (!change.added && !change.removed) {
      open = undefined;
      line += change.count;
      continue;
    }
    if (!open) {
      open = { index: hunks.length, baselineStart: line, baselineLines: [], proposalLines: [], added: 0, removed: 0 };
      hunks.push(open);
    }
    if (change.added) {
      open.proposalLines.push(...change.value);
      open.added += change.count;
    } else {
      open.baselineLines.push(...change.value);
      open.removed += change.count;
      line += change.count;
    }
  }
  return hunks;
}

export function resolveText(baseline: string, hunks: Hunk[], decisions: HunkDecision[]): string {
  const lines = splitLines(baseline);
  const out: string[] = [];
  let cursor = 0;
  for (const hunk of hunks) {
    out.push(...lines.slice(cursor, hunk.baselineStart));
    out.push(...resolvedLines(hunk, decisions[hunk.index]));
    cursor = hunk.baselineStart + hunk.baselineLines.length;
  }
  out.push(...lines.slice(cursor));
  return out.join("");
}

function resolvedLines(hunk: Hunk, decision: HunkDecision): string[] {
  if (decision === "accepted") return hunk.proposalLines;
  if (decision !== "both" || !hunk.proposalLines.length) return hunk.baselineLines;
  const kept = [...hunk.baselineLines];
  const last = kept.at(-1);
  if (last !== undefined && !last.endsWith("\n")) kept[kept.length - 1] = last + (hunk.proposalLines[0].endsWith("\r\n") ? "\r\n" : "\n");
  return [...kept, ...hunk.proposalLines];
}

export function renderReview(baseline: string, hunks: Hunk[], decisions: HunkDecision[]): ReviewRender {
  const eol = baseline.includes("\r\n") || (baseline === "" && hunks.some((h) => h.proposalLines.some((l) => l.endsWith("\r\n")))) ? "\r\n" : "\n";
  const lines = splitLines(baseline);
  const shown: string[] = [];
  const render: ReviewRender = { text: "", removedLines: [], addedLines: [], hunkAnchors: [] };
  const emit = (block: string[], marks?: number[]) => {
    for (const line of block) {
      marks?.push(shown.length);
      shown.push(line);
    }
  };
  let cursor = 0;
  for (const hunk of hunks) {
    emit(lines.slice(cursor, hunk.baselineStart));
    render.hunkAnchors.push({ index: hunk.index, line: shown.length });
    const decision = decisions[hunk.index];
    if (decision !== "accepted") emit(hunk.baselineLines, decision === "pending" ? render.removedLines : undefined);
    if (decision !== "rejected") emit(hunk.proposalLines, decision === "pending" ? render.addedLines : undefined);
    cursor = hunk.baselineStart + hunk.baselineLines.length;
  }
  emit(lines.slice(cursor));
  render.text = shown.map((line, i) => line.replace(/\r?\n$/, "") + (i < shown.length - 1 || /\n$/.test(line) ? eol : "")).join("");
  return render;
}

export function sameText(a: string, b: string): boolean {
  return a === b || a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");
}

export function diffStat(baseline: string, text: string): DiffStat {
  return computeHunks(baseline, text).reduce((stat, hunk) => ({ added: stat.added + hunk.added, removed: stat.removed + hunk.removed }), { added: 0, removed: 0 });
}

export function formatPatch(path: string, baseline: string, text: string): string {
  return createTwoFilesPatch(`a/${path}`, `b/${path}`, baseline, text, undefined, undefined, { context: 3 });
}
