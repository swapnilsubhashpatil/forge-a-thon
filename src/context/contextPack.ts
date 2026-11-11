import type { ContextReport } from "../shared/protocol.ts";
import type { RankedFile } from "./ranker.ts";
import { renderRepoMap } from "./repoMap.ts";
import { estimateTokens } from "./tokens.ts";
import type { WorkspaceIndex } from "./workspaceIndex.ts";

const TABLE_ROWS = 10;
const MAP_FILES = 6;
const SLICE_FILES = 4;
const SLICE_RADIUS = 20;
const OPEN = "<context>\n";
const CLOSE = "\n</context>";

export async function buildContextPack(
  index: WorkspaceIndex,
  ranked: RankedFile[],
  budgetTokens: number,
  verify?: { command: string; reason: string },
): Promise<{ text: string; report: ContextReport }> {
  const strategy =
    `Ranked ${index.files().length} files by @mentions, path match, BM25 term overlap, sibling symbols, test/docs companions and import-graph PageRank; ` +
    `this pack holds the top candidates, a repo map and code slices within ${budgetTokens} tokens. Use search_code, find_symbol and read_file for anything else.`;
  const included = new Map<string, number>();
  const slices: Array<{ path: string; start: number; end: number }> = [];
  const sections: string[] = [];
  const used = () => estimateTokens(OPEN + sections.join("\n\n") + CLOSE);
  const remaining = () => budgetTokens - used() - 2;
  const tryAdd = (section: string) => {
    if (estimateTokens(section) > remaining()) return false;
    sections.push(section);
    return true;
  };

  tryAdd(`Strategy: ${strategy}`);
  if (verify) tryAdd(`Verify with (likely): ${verify.command}  (${verify.reason})`);
  const rows = ranked.slice(0, TABLE_ROWS).map((file) => `| ${file.path} | ${file.role} | ${file.reasons.join("; ")} |`);
  const table = ["Candidates:", "| path | role | why |", "|---|---|---|"];
  for (const row of rows) {
    if (estimateTokens([...table, row].join("\n")) > remaining()) break;
    table.push(row);
  }
  if (table.length > 3) tryAdd(table.join("\n"));

  const mapBudget = Math.min(Math.floor(budgetTokens * 0.25), remaining());
  const map = renderRepoMap(index, ranked.slice(0, MAP_FILES).map((file) => file.path), mapBudget);
  if (map) tryAdd(map);

  const mentioned = ranked.filter((file) => file.role === "mentioned");
  for (const file of mentioned) {
    const share = Math.floor((remaining() * 0.6) / Math.max(1, mentioned.length - mentioned.indexOf(file)));
    const body = trimToTokens(await safeRead(index, file.path), share - 20);
    if (body && tryAdd(fence(`${file.path} (full${body.trimmed ? ", trimmed" : ""})`, body.text))) {
      if (!body.trimmed) slices.push({ path: file.path, start: 1, end: Number.MAX_SAFE_INTEGER });
      included.set(file.path, (included.get(file.path) ?? 0) + estimateTokens(body.text));
    }
  }

  const top = ranked.find((file) => file.role !== "mentioned")?.score ?? 0;
  const sliceFiles = ranked
    .filter((file) => file.role === "target" && file.anchors.length && file.score >= top * 0.5)
    .slice(0, SLICE_FILES);
  for (const [order, file] of sliceFiles.entries()) {
    const lines = (await safeRead(index, file.path)).split(/\r?\n/);
    const share = Math.floor(remaining() / (sliceFiles.length - order));
    let spent = 0;
    for (const [start, end] of windows(file.anchors, lines.length)) {
      const section = fence(`${file.path} lines ${start + 1}-${end}`, lines.slice(start, end).join("\n"));
      const cost = estimateTokens(section) + 1;
      if (spent + cost > share || !tryAdd(section)) break;
      spent += cost;
      slices.push({ path: file.path, start: start + 1, end });
      included.set(file.path, (included.get(file.path) ?? 0) + estimateTokens(lines.slice(start, end).join("\n")));
    }
  }

  let text = OPEN + sections.join("\n\n") + CLOSE;
  if (estimateTokens(text) > budgetTokens) text = OPEN + text.slice(OPEN.length, budgetTokens * 4 - OPEN.length - CLOSE.length) + CLOSE;
  const usedTokens = estimateTokens(text);
  if (usedTokens > budgetTokens) throw new Error(`context pack ${usedTokens} tokens exceeds budget ${budgetTokens}`);
  return {
    text,
    report: {
      strategy,
      budgetTokens,
      usedTokens,
      files: ranked.slice(0, TABLE_ROWS).map((file) => ({
        path: file.path,
        role: file.role,
        score: file.score,
        tokens: included.get(file.path) ?? 0,
        reasons: file.reasons,
      })),
      fetched: [],
      read: [],
      edited: [],
      verify: verify?.command,
      slices,
    },
  };
}

function windows(anchors: number[], total: number): [number, number][] {
  const spans = anchors
    .map((line): [number, number] => [Math.max(0, line - 1 - SLICE_RADIUS), Math.min(total, line + SLICE_RADIUS)])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push(span);
  }
  const order = anchors.map((line) => merged.findIndex(([start, end]) => line - 1 >= start && line - 1 < end));
  return [...new Set(order)].map((i) => merged[i]);
}

function trimToTokens(text: string, tokens: number): { text: string; trimmed: boolean } | undefined {
  if (tokens <= 0) return undefined;
  if (estimateTokens(text) <= tokens) return { text, trimmed: false };
  const lines = text.split(/\r?\n/);
  const chars = tokens * 4 - 60;
  let head = 0;
  let tail = 0;
  let size = 0;
  while (head + tail < lines.length) {
    const next = head <= tail * 2 ? lines[head] : lines[lines.length - 1 - tail];
    if (size + next.length + 1 > chars) break;
    size += next.length + 1;
    if (head <= tail * 2) head++;
    else tail++;
  }
  if (!head) return undefined;
  const omitted = lines.length - head - tail;
  return {
    text: [...lines.slice(0, head), `... ${omitted} lines omitted ...`, ...lines.slice(lines.length - tail)].join("\n"),
    trimmed: true,
  };
}

function fence(title: string, body: string): string {
  return `${title}\n\`\`\`\n${body}\n\`\`\``;
}

async function safeRead(index: WorkspaceIndex, path: string): Promise<string> {
  try {
    return await index.read(path);
  } catch {
    return "";
  }
}
