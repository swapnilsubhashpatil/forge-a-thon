import type { Hunk } from "./hunks.ts";

/** Inclusive 1-based line range in the file as it was before the edit. */
export interface LineRange {
  start: number;
  end: number;
}

/**
 * G2: the area an edit is expected to stay in. Inline edits: the selection. Agent edits: the lines the agent
 * actually saw (read_file ranges and context-pack slices). Hunks outside get a badge; nothing is blocked.
 */
export interface ScopeFence {
  ranges: LineRange[];
  label: string;
  /** Lines of tolerance around each range (docstrings, decorators, a blank line). */
  slack?: number;
}

/** 1-based lines the hunk touches in the baseline; a pure insertion touches the line it is inserted before. */
export function hunkSpan(hunk: Hunk): LineRange {
  const start = hunk.baselineStart + 1;
  return { start, end: hunk.removed > 0 ? start + hunk.removed - 1 : start };
}

/** Returns one label per hunk index, or undefined where the hunk is inside the fence. */
export function flagHunks(hunks: Hunk[], fence: ScopeFence | undefined): Array<string | undefined> {
  if (!fence) return hunks.map(() => undefined);
  const slack = fence.slack ?? 0;
  // A pure insertion right after the range ("add a line at the end") is still inside; a one-line *change* is not.
  const inside = (span: LineRange, insertion: boolean) =>
    fence.ranges.some((range) => span.start >= range.start - slack && span.end <= range.end + slack + (insertion ? 1 : 0));
  return hunks.map((hunk) => (inside(hunkSpan(hunk), hunk.removed === 0) ? undefined : fence.label));
}

/** Merges overlapping or touching ranges. */
export function mergeRanges(ranges: LineRange[]): LineRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: LineRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** Sentence for the tool result, so the model knows which hunks the user was warned about. */
export function describeFlags(hunks: Hunk[], flags: Array<string | undefined>): string | undefined {
  const flagged = hunks.filter((hunk) => flags[hunk.index]);
  if (!flagged.length) return undefined;
  const parts = flagged.map((hunk) => {
    const span = hunkSpan(hunk);
    return `change ${hunk.index + 1} (line ${span.start}${span.end > span.start ? `-${span.end}` : ""}): ${flags[hunk.index]}`;
  });
  return `The user was warned about: ${parts.join("; ")}. Only change code the request needs, and read code before editing it.`;
}
