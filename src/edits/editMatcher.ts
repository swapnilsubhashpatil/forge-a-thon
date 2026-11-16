export type MatchKind = "exact" | "whitespace" | "indentation" | "fuzzy";

export type MatchResult =
  | { ok: true; text: string; matchKind: MatchKind; occurrences: number }
  | { ok: false; reason: string; hint: string };

const FUZZY_THRESHOLD = 0.85;
const FUZZY_MARGIN = 0.05;
const MAX_CHANGED_SHARE = 0.15;
const LINE_FLOOR = 0.8;
const MIN_FUZZY_LINES = 4;
const HINT_LINES = 8;
const TAB_WIDTH = 4;

interface LineMatch {
  start: number;
  end: number;
}

export function applyReplacement(source: string, oldString: string, newString: string, replaceAll = false): MatchResult {
  const crlf = source.includes("\r\n");
  const text = toLf(source);
  const oldText = toLf(oldString);
  const newText = toLf(newString);
  const finish = (result: string, matchKind: MatchKind, occurrences: number): MatchResult => ({
    ok: true,
    text: crlf ? result.replace(/\n/g, "\r\n") : result,
    matchKind,
    occurrences,
  });

  if (oldText === "") {
    if (text === "") return finish(newText, "exact", 1);
    return failure(text, oldText, "old_string is empty but the file is not.");
  }
  if (oldText === newText) return failure(text, oldText, "old_string and new_string are identical; nothing to change.");

  const exact = countOccurrences(text, oldText);
  if (exact === 1 || (exact > 1 && replaceAll)) {
    const result = replaceAll ? text.split(oldText).join(newText) : replaceFirst(text, oldText, newText);
    return finish(result, "exact", exact);
  }
  if (exact > 1) return ambiguous(text, oldText, exact);

  const lines = text.split("\n");
  const oldLines = blockLines(oldText);
  const newLines = newText === "" ? [] : blockLines(newText, oldText.endsWith("\n"));

  const stages: Array<{ kind: MatchKind; same: (a: string, b: string) => boolean; reindent: boolean }> = [
    { kind: "whitespace", same: (a, b) => a.trimEnd() === b.trimEnd(), reindent: false },
    { kind: "indentation", same: (a, b) => a.trim() === b.trim(), reindent: true },
  ];
  for (const stage of stages) {
    const matches = findLineMatches(lines, oldLines, stage.same);
    if (matches.length === 0) continue;
    if (matches.length > 1 && !replaceAll) return ambiguous(text, oldText, matches.length);
    const chosen = replaceAll ? matches : matches.slice(0, 1);
    return finish(spliceMatches(lines, chosen, oldLines, newLines, stage.reindent), stage.kind, chosen.length);
  }

  const ranked = rankWindows(lines, oldLines, true);
  const best = ranked[0];
  if (best && best.score >= FUZZY_THRESHOLD) {
    const rival = ranked.find((w) => w.end < best.start || w.start > best.end);
    if (rival && rival.score > best.score - FUZZY_MARGIN) return ambiguous(text, oldText, 2);
    return finish(spliceMatches(lines, [best], oldLines, newLines, true), "fuzzy", 1);
  }
  return failure(text, oldText, "old_string was not found in the file, even ignoring whitespace and indentation.");
}

function toLf(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) count++;
  return count;
}

function replaceFirst(text: string, needle: string, replacement: string): string {
  const at = text.indexOf(needle);
  return text.slice(0, at) + replacement + text.slice(at + needle.length);
}

function blockLines(value: string, dropTrailingNewline = value.endsWith("\n")): string[] {
  const body = dropTrailingNewline && value.endsWith("\n") ? value.slice(0, -1) : value;
  return body.split("\n");
}

function findLineMatches(lines: string[], oldLines: string[], same: (a: string, b: string) => boolean): LineMatch[] {
  const matches: LineMatch[] = [];
  for (let start = 0; start + oldLines.length <= lines.length; start++) {
    if (oldLines.every((line, offset) => same(lines[start + offset], line))) {
      matches.push({ start, end: start + oldLines.length - 1 });
      start += oldLines.length - 1;
    }
  }
  return matches;
}

function spliceMatches(lines: string[], matches: LineMatch[], oldLines: string[], newLines: string[], reindent: boolean): string {
  const out = [...lines];
  for (const match of [...matches].reverse()) {
    const block = out.slice(match.start, match.end + 1);
    const cleaned = newLines.map((line) => line.trimEnd());
    const replacement = reindent ? reindentLines(cleaned, baseIndent(oldLines), baseIndent(block)) : cleaned;
    out.splice(match.start, block.length, ...replacement);
  }
  return out.join("\n");
}

function baseIndent(lines: string[]): string {
  const first = lines.find((line) => line.trim() !== "");
  return first ? leading(first) : "";
}

function leading(line: string): string {
  return /^[ \t]*/.exec(line)![0];
}

function columns(indent: string): number {
  let width = 0;
  for (const char of indent) width = char === "\t" ? width + TAB_WIDTH - (width % TAB_WIDTH) : width + 1;
  return width;
}

function reindentLines(newLines: string[], fromIndent: string, toIndent: string): string[] {
  const shift = columns(toIndent) - columns(fromIndent);
  const useTabs = toIndent.includes("\t");
  return newLines.map((line) => {
    if (line.trim() === "") return line.trim();
    const width = Math.max(0, columns(leading(line)) + shift);
    const indent = useTabs ? "\t".repeat(Math.floor(width / TAB_WIDTH)) + " ".repeat(width % TAB_WIDTH) : " ".repeat(width);
    return indent + line.trimStart();
  });
}

interface Window {
  start: number;
  end: number;
  score: number;
}

function rankWindows(lines: string[], oldLines: string[], strict: boolean): Window[] {
  const wanted = oldLines.map((line) => line.trim()).filter((line) => line !== "");
  if (wanted.length === 0 || (strict && wanted.length < MIN_FUZZY_LINES)) return [];
  const content = lines.flatMap((line, index) => (line.trim() === "" ? [] : [index]));
  const maxChanged = Math.max(1, Math.ceil(wanted.length * MAX_CHANGED_SHARE));
  const windows: Window[] = [];
  for (let first = 0; first + wanted.length <= content.length; first++) {
    let total = 0;
    let changed = 0;
    for (let offset = 0; offset < wanted.length; offset++) {
      const score = similarity(lines[content[first + offset]].trim(), wanted[offset]);
      total += score;
      if (score < 1) changed++;
      if (strict && (score < LINE_FLOOR || changed > maxChanged || total + wanted.length - offset - 1 < FUZZY_THRESHOLD * wanted.length)) {
        total = 0;
        break;
      }
    }
    windows.push({ start: content[first], end: content[first + wanted.length - 1], score: total / wanted.length });
  }
  return windows.sort((a, b) => b.score - a.score);
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) / longest > 0.5) return 0;
  return 1 - levenshtein(a, b) / longest;
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

function ambiguous(text: string, oldText: string, count: number): MatchResult {
  return failure(
    text,
    oldText,
    `old_string matches ${count} places. Include more surrounding lines to make it unique, or set replace_all.`,
  );
}

function failure(text: string, oldText: string, reason: string): MatchResult {
  const lines = text.split("\n");
  const best = oldText.trim() === "" ? undefined : rankWindows(lines, blockLines(oldText), false)[0];
  const from = Math.max(0, (best?.start ?? 0) - 1);
  const shown = lines.slice(from, from + Math.max(HINT_LINES, (best ? best.end - best.start : 0) + 2));
  const width = String(from + shown.length).length;
  const excerpt = shown.map((line, offset) => `${String(from + offset + 1).padStart(width)} | ${line}`).join("\n");
  const label = best ? "Closest lines in the file" : "Start of the file";
  return { ok: false, reason, hint: `${label}:\n${excerpt}` };
}
