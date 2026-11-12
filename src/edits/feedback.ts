import { computeHunks, splitLines } from "./hunks.ts";

/**
 * M3: after a partial or full rejection the model's picture of the file is stale. Send the current text around
 * every rejected change, numbered like read_file output, so the next old_string matches first time
 * (Roo: "use these changes as the new baseline"; Aider: "don't re-send them").
 */
export function currentRegion(finalText: string, proposal: string, radius = 4, maxLines = 60): string | undefined {
  const lines = splitLines(finalText).map((line) => line.replace(/\r?\n$/, ""));
  const spans: Array<[number, number]> = computeHunks(finalText, proposal).map((hunk) => [
    Math.max(0, hunk.baselineStart - radius),
    Math.min(lines.length, hunk.baselineStart + hunk.baselineLines.length + radius),
  ]);
  if (!spans.length || !lines.length) return undefined;
  const merged: Array<[number, number]> = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  const out: string[] = [];
  let used = 0;
  for (const [start, end] of merged) {
    if (out.length) out.push("  ...");
    for (let i = start; i < end; i++) {
      if (used >= maxLines) {
        out.push("  ... (truncated; use read_file for more)");
        return out.join("\n");
      }
      out.push(`${String(i + 1).padStart(5)}  ${lines[i]}`);
      used++;
    }
  }
  return out.join("\n");
}

export const NEW_BASELINE =
  "Accepted changes are already written; do not re-send them. Rejections were the user's decision, not a tool failure. " +
  "Use the current text below as the new baseline for any further edit to this file.";

export const STALE_HINT = "The file may have changed since you last read it: read it again with read_file before retrying.";
