import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MentionItem } from "../shared/protocol.ts";
import { estimateTokens } from "./tokens.ts";
import type { SymbolEntry, WorkspaceIndex } from "./workspaceIndex.ts";

export interface SearchOptions {
  query: string;
  regex?: boolean;
  glob?: string;
  maxResults?: number;
}

export interface SymbolHit extends SymbolEntry {
  path: string;
}

interface Match {
  path: string;
  line: number;
  text: string;
}

const MAX_TOKENS = 4000;
const MAX_LINE = 200;

export async function searchCode(index: WorkspaceIndex, options: SearchOptions, rgPath?: string): Promise<string> {
  const limit = options.maxResults ?? 50;
  const { matches, total } = rgPath ? await ripgrep(index.root, options, rgPath, limit) : await scan(index, options, limit);
  return format(matches, total, options.query);
}

export async function findReferences(index: WorkspaceIndex, name: string, rgPath?: string): Promise<string> {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return searchCode(index, { query: `\\b${escaped}\\b`, regex: true }, rgPath);
}

export function findSymbol(index: WorkspaceIndex, nameOrPattern: string): SymbolHit[] {
  const pattern = /[*?]/.test(nameOrPattern)
    ? new RegExp(`^${nameOrPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i")
    : undefined;
  const all = index.files().flatMap((file) => file.symbols.map((symbol) => ({ ...symbol, path: file.path })));
  if (pattern) return all.filter((hit) => pattern.test(hit.name)).slice(0, 50);
  const lower = nameOrPattern.toLowerCase();
  const exact = all.filter((hit) => hit.name.toLowerCase() === lower);
  return (exact.length ? exact : all.filter((hit) => hit.name.toLowerCase().startsWith(lower))).slice(0, 50);
}

export function mentionCandidates(index: WorkspaceIndex, query: string, limit: number): MentionItem[] {
  const needle = query.toLowerCase().replace(/\\/g, "/");
  const scored: { item: MentionItem; score: number }[] = [];
  for (const file of index.files()) {
    const score = fuzzyScore(file.path.toLowerCase(), needle);
    if (score > 0) {
      const cut = file.path.lastIndexOf("/");
      scored.push({
        item: { kind: "file", label: file.path.slice(cut + 1), path: file.path, detail: cut < 0 ? "" : file.path.slice(0, cut) },
        score,
      });
    }
    if (!needle) continue;
    for (const symbol of file.symbols) {
      if (!symbol.name.toLowerCase().startsWith(needle)) continue;
      scored.push({
        item: { kind: "symbol", label: symbol.name, path: file.path, line: symbol.line, detail: `${symbol.kind} · ${file.path}:${symbol.line}` },
        score: 2 + needle.length / symbol.name.length + (symbol.name.length === needle.length ? 2 : 0),
      });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path) || (a.item.line ?? 0) - (b.item.line ?? 0))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function fuzzyScore(path: string, needle: string): number {
  if (!needle) return 1 / (1 + path.length / 40);
  let position = -1;
  let score = 0;
  let previous = -2;
  for (const char of needle) {
    position = path.indexOf(char, position + 1);
    if (position < 0) return 0;
    score += position === previous + 1 ? 2 : 1;
    if (position === 0 || "/_-.".includes(path[position - 1])) score += 1;
    previous = position;
  }
  const base = path.slice(path.lastIndexOf("/") + 1);
  const bare = base.replace(/[^a-z0-9]/g, "");
  const bareNeedle = needle.replace(/[^a-z0-9]/g, "");
  if (base.startsWith(needle) || bare.startsWith(bareNeedle)) score += needle.length * (bare === bareNeedle ? 3 : 2);
  else if (base.includes(needle) || bare.includes(bareNeedle)) score += needle.length;
  return score / needle.length + 1 / (1 + path.length / 40);
}

function ripgrep(root: string, options: SearchOptions, rgPath: string, limit: number): Promise<{ matches: Match[]; total: number }> {
  const args = ["--vimgrep", "-S", "--no-heading", "--color", "never", "--path-separator", "/", "--max-columns", String(MAX_LINE), "--max-columns-preview"];
  if (!options.regex) args.push("-F");
  if (options.glob) args.push("-g", options.glob);
  args.push("-e", options.query, ".");
  return new Promise((resolve, reject) => {
    const child = spawn(rgPath, args, { cwd: root, windowsHide: true });
    const matches: Match[] = [];
    let total = 0;
    let buffer = "";
    let errors = "";
    let seen = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const match = /^(.*?):(\d+):\d+:(.*)$/.exec(line.replace(/\r$/, ""));
        if (!match || `${match[1]}:${match[2]}` === seen) continue;
        seen = `${match[1]}:${match[2]}`;
        total++;
        if (matches.length < limit) matches.push({ path: match[1].replace(/^\.\//, ""), line: Number(match[2]), text: match[3] });
      }
    });
    child.stderr.on("data", (chunk) => (errors += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 || code === 1 ? resolve({ matches: sortMatches(matches), total }) : reject(new Error(errors.trim() || `rg exited ${code}`))));
  });
}

async function scan(index: WorkspaceIndex, options: SearchOptions, limit: number): Promise<{ matches: Match[]; total: number }> {
  const caseSensitive = /[A-Z]/.test(options.query);
  const source = options.regex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(source, caseSensitive ? "" : "i");
  const glob = options.glob ? globToRegExp(options.glob) : undefined;
  const matches: Match[] = [];
  let total = 0;
  for (const file of index.files()) {
    if (glob && !glob.test(file.path)) continue;
    const lines = (await index.read(file.path).catch(() => "")).split(/\r?\n/);
    lines.forEach((text, i) => {
      if (!pattern.test(text)) return;
      total++;
      if (matches.length < limit) matches.push({ path: file.path, line: i + 1, text: text.slice(0, MAX_LINE) });
    });
  }
  return { matches, total };
}

function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      source += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else if (char === "{") source += "(?:";
    else if (char === "}") source += ")";
    else if (char === "," && source.includes("(?:")) source += "|";
    else source += char.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(glob.includes("/") ? `^${source}$` : `(?:^|/)${source}$`);
}

function sortMatches(matches: Match[]): Match[] {
  return matches.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
}

function format(matches: Match[], total: number, query: string): string {
  if (!matches.length) return `No matches for ${JSON.stringify(query)}.`;
  const groups = new Map<string, Match[]>();
  for (const match of matches) groups.set(match.path, [...(groups.get(match.path) ?? []), match]);
  const lines = [`${total} matches in ${groups.size}${total > matches.length ? "+" : ""} files for ${JSON.stringify(query)}`];
  let truncated = total > matches.length;
  outer: for (const [path, items] of groups) {
    const block = [`${path} (${items.length})`, ...items.map((item) => `  ${item.line}: ${item.text.trim().slice(0, MAX_LINE)}`)];
    for (const line of block) {
      if (estimateTokens([...lines, line].join("\n")) > MAX_TOKENS - 30) {
        truncated = true;
        break outer;
      }
      lines.push(line);
    }
  }
  if (truncated) lines.push(`... truncated (showing ${matches.length} of ${total}); refine the query or add a glob.`);
  return lines.join("\n");
}

export function findRipgrep(appRoot: string): string | undefined {
  const exe = process.platform === "win32" ? "rg.exe" : "rg";
  const arch = `${process.platform}-${process.arch}`;
  const candidates = [
    join(appRoot, "node_modules", "@vscode", "ripgrep", "bin", exe),
    join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep", "bin", exe),
    join(appRoot, "node_modules", "@vscode", "ripgrep-universal", "bin", arch, exe),
    join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep-universal", "bin", arch, exe),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}
