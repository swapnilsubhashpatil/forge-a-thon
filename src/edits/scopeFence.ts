import type { Hunk } from "./hunks.ts";

export interface LineRange {
  start: number;
  end: number;
}

export interface ScopeFence {
  ranges: LineRange[];
  label: string;
  slack?: number;
}

export function hunkSpan(hunk: Hunk): LineRange {
  const start = hunk.baselineStart + 1;
  return { start, end: hunk.removed > 0 ? start + hunk.removed - 1 : start };
}

export function flagHunks(hunks: Hunk[], fence: ScopeFence | undefined): Array<string | undefined> {
  if (!fence) return hunks.map(() => undefined);
  const slack = fence.slack ?? 0;
  const inside = (span: LineRange, insertion: boolean) =>
    fence.ranges.some((range) => span.start >= range.start - slack && span.end <= range.end + slack + (insertion ? 1 : 0));
  return hunks.map((hunk) => (inside(hunkSpan(hunk), hunk.removed === 0) ? undefined : fence.label));
}

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

export function describeFlags(hunks: Hunk[], flags: Array<string | undefined>): string | undefined {
  const flagged = hunks.filter((hunk) => flags[hunk.index]);
  if (!flagged.length) return undefined;
  const parts = flagged.map((hunk) => {
    const span = hunkSpan(hunk);
    return `change ${hunk.index + 1} (line ${span.start}${span.end > span.start ? `-${span.end}` : ""}): ${flags[hunk.index]}`;
  });
  return `The user was warned about: ${parts.join("; ")}. Only change code the request needs, and read code before editing it.`;
}
