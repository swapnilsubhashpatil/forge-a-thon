import type { FileRole } from "../shared/protocol.ts";
import { bm25 } from "./bm25.ts";
import { personalizedPageRank } from "./pageRank.ts";
import { identifierTerms, pathTerms, queryTokens, splitIdentifier, textTerms, type QueryToken } from "./terms.ts";
import type { FileEntry, WorkspaceIndex } from "./workspaceIndex.ts";

export interface RankQuery {
  text: string;
  mentions?: string[];
  activeFiles?: string[];
  limit?: number;
}

export interface RankedFile {
  path: string;
  score: number;
  role: FileRole;
  reasons: string[];
  anchors: number[];
  matched: string[];
}

interface Signals {
  file: FileEntry;
  path: number;
  pathHits: string[];
  namingHits: string[];
  bm25: number;
  bm25Hits: string[];
  siblings: string[];
  defines: string[];
  definesWeight: number;
  active: boolean;
  rank: number;
  score: number;
  role: FileRole;
  reasons: string[];
}

const WEIGHTS = { path: 3, bm25: 2, sibling: 2, defines: 3, active: 1.5, rank: 1, companion: 0.6, coChange: 0.6 };

/** Repository housekeeping (dependency pins, CI, changelogs, community files): rarely where a change belongs. */
const META_FILE =
  /(^|\/)(requirements[^/]*\/|\.github\/|\.circleci\/)|(^|\/)(CHANGES|CHANGELOG|HISTORY|CODE_OF_CONDUCT|CONTRIBUTING|LICENSE|SECURITY|AUTHORS)[^/]*$|(^|\/)requirements[^/]*\.(txt|in)$|\.(lock|in)$|(^|\/)(tox\.ini|setup\.cfg|pyproject\.toml|package-lock\.json|\.pre-commit-config\.yaml)$/;
/** Words that mean the request is about that housekeeping, so it is not demoted. */
const META_TERMS = new Set(["requirement", "requirements", "dependency", "dependencies", "depend", "pin", "upgrade", "ci", "workflow", "github", "action", "actions", "tox", "pyproject", "changelog", "changes", "contributing", "license", "release", "version", "packaging", "build"]);
const SYNONYMS: Record<string, string[]> = {
  app: ["application"],
  application: ["app"],
  cmd: ["command"],
  cli: ["command", "click"],
  config: ["configuration"],
  configuration: ["config"],
  env: ["environment"],
  auth: ["authentication"],
  db: ["database"],
  repo: ["repository"],
  arg: ["argument"],
  param: ["parameter"],
};
const CODE_FILE = /\.(?:pyi?|[cm]?[jt]sx?|go|rs|java|kt|rb|php|cs|swift|c|cc|cpp|h|hpp)$/;
const ADDS_MEMBER = /\b(?:add|adding|new|another|create|implement|introduce)\b/i;
const INTENT_TERMS =new Set(["test", "doc", "documentation", "docstring"]);

export function rankFiles(index: WorkspaceIndex, query: RankQuery): RankedFile[] {
  const tokens = queryTokens(query.text);
  const plain = unique(tokens.filter((token) => !token.compound && !INTENT_TERMS.has(token.term)).map((token) => token.term));
  const synonyms = unique(plain.flatMap((term) => SYNONYMS[term] ?? [])).filter((term) => !plain.includes(term));
  const compounds = unique(tokens.filter((token) => token.compound).map((token) => token.term));
  const files = index.files();
  const families = ADDS_MEMBER.test(query.text) ? siblingFamilies(files, plain) : new Map<string, string[]>();
  const naming = namingTerms(tokens, families, files);
  const pathIdf = pathFrequencies(files);
  const active = new Set((query.activeFiles ?? []).map(normalize));
  const wantsAuxiliary = tokens.some((token) => INTENT_TERMS.has(token.term));
  const wantsMeta = tokens.some((token) => META_TERMS.has(token.term));

  const signals = files.map((file): Signals => {
    const { base, dirs } = pathTerms(file.path);
    let path = 0;
    const pathHits: string[] = [];
    const namingHits: string[] = [];
    for (const term of [...plain, ...synonyms]) {
      const weight = (base.includes(term) ? 1 : dirs.includes(term) ? 0.4 : 0) * (pathIdf.get(term) ?? 0) * (synonyms.includes(term) ? 0.5 : 1);
      if (!weight) continue;
      if (naming.has(term)) {
        path += weight * 0.3;
        namingHits.push(term);
      } else {
        path += weight;
        pathHits.push(term);
      }
    }
    const lexical = bm25(index, file, [...plain, ...compounds, ...synonyms]);
    const exact = file.symbols.filter((symbol) => compounds.includes(symbol.name.toLowerCase().replace(/^_+/, "")));
    const covered = file.symbols.filter((symbol) => coversQuery(symbol.name, [...plain, ...synonyms]));
    const defines = [...exact, ...covered].map((symbol) => symbol.name);
    return {
      file,
      path,
      pathHits,
      namingHits,
      bm25: lexical.score,
      bm25Hits: lexical.matched,
      siblings: families.get(file.path) ?? [],
      defines: unique(defines),
      definesWeight: exact.length ? 1 : covered.length ? 0.7 : 0,
      active: active.has(file.path),
      rank: 0,
      score: 0,
      role: "reference",
      reasons: [],
    };
  });

  const maxPath = Math.max(1e-9, ...signals.map((signal) => signal.path));
  const maxBm25 = Math.max(1e-9, ...signals.map((signal) => signal.bm25));
  const maxSiblings = Math.max(1, ...signals.map((signal) => signal.siblings.length));
  for (const signal of signals) {
    signal.score =
      WEIGHTS.path * (signal.path / maxPath) +
      WEIGHTS.bm25 * (signal.bm25 / maxBm25) +
      WEIGHTS.sibling * (signal.siblings.length / maxSiblings) +
      WEIGHTS.defines * signal.definesWeight +
      WEIGHTS.active * (signal.active ? 1 : 0);
    if (signal.file.path.startsWith(".")) signal.score *= 0.5;
    if (!wantsAuxiliary && isAuxiliary(signal.file.path)) signal.score *= 0.6;
    if (!wantsMeta && META_FILE.test(signal.file.path)) signal.score *= 0.3;
  }

  applyPageRank(signals);
  const byPath = new Map(signals.map((signal) => [signal.file.path, signal]));
  const topScore = Math.max(0, ...signals.map((signal) => signal.score));
  for (const signal of signals) {
    const strongPath = signal.pathHits.length > 0 && signal.score >= topScore * 0.6;
    if (strongPath || signal.siblings.length || signal.defines.length) signal.role = "target";
    signal.reasons = describe(signal, byPath);
  }
  addCompanions(signals, byPath, index);
  pinMentions(query.mentions ?? [], byPath);

  const queryTerms = [...plain, ...compounds, ...synonyms];
  const sorted = signals.filter((signal) => signal.score > 0.05).sort((a, b) => b.score - a.score || compare(a.file.path, b.file.path));
  return sorted
    .slice(0, query.limit ?? 15)
    .map((signal) => ({
      path: signal.file.path,
      score: Math.round(signal.score * 1000) / 1000,
      role: signal.role,
      reasons: signal.reasons,
      anchors: anchors(index, signal, queryTerms),
      matched: unique([...signal.pathHits, ...signal.bm25Hits]),
    }));
}

function siblingFamilies(files: FileEntry[], terms: string[]): Map<string, string[]> {
  const families = new Map<string, string[]>();
  for (const noun of terms.filter((term) => term.length >= 4)) {
    for (const file of files) {
      if (isTest(file.path)) continue;
      const names = unique(
        file.symbols
          .map((symbol) => symbol.name)
          .filter((name) => {
            const parts = splitIdentifier(name);
            return parts.length > 1 && parts[parts.length - 1] === noun && parts.some((part, i) => i < parts.length - 1 && part !== noun);
          }),
      );
      if (names.length >= 2) families.set(file.path, unique([...(families.get(file.path) ?? []), ...names]));
    }
  }
  return families;
}

function namingTerms(tokens: QueryToken[], families: Map<string, string[]>, files: FileEntry[]): Set<string> {
  const naming = new Set<string>();
  if (!families.size) return naming;
  const symbolNames = new Set(files.flatMap((file) => file.symbols.map((symbol) => symbol.name.toLowerCase())));
  const familyPaths = [...families.keys()].map((path) => pathTerms(path));
  const located = new Set(familyPaths.flatMap((terms) => [...terms.base, ...terms.dirs]));
  const nouns = new Set([...families.values()].flat().map((name) => splitIdentifier(name).at(-1)!));
  for (const noun of tokens.filter((token) => nouns.has(token.term))) {
    for (const token of tokens) {
      if (token.compound || token.position >= noun.position || token.position < noun.position - 3) continue;
      if (located.has(token.term) || nouns.has(token.term) || INTENT_TERMS.has(token.term)) continue;
      if (symbolNames.has(`${token.term}_${noun.term}`)) continue;
      naming.add(token.term);
    }
  }
  return naming;
}

function coversQuery(name: string, terms: string[]): boolean {
  const parts = identifierTerms(name).filter((term) => term !== name.toLowerCase().replace(/^_+/, ""));
  return parts.length >= 2 && parts.every((part) => terms.includes(part));
}

function pathFrequencies(files: FileEntry[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const file of files) {
    const { base, dirs } = pathTerms(file.path);
    for (const term of new Set([...base, ...dirs])) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) idf.set(term, count > files.length * 0.1 ? 0 : Math.log(1 + files.length / count));
  return idf;
}

function applyPageRank(signals: Signals[]): void {
  const nodes = signals.map((signal) => signal.file.path);
  const edges = new Map(signals.map((signal) => [signal.file.path, signal.file.imports]));
  const seeds = new Map(signals.filter((signal) => signal.score > 0).map((signal) => [signal.file.path, signal.score]));
  if (!seeds.size) return;
  const ranks = personalizedPageRank(nodes, edges, seeds);
  const max = Math.max(1e-12, ...ranks.values());
  for (const signal of signals) {
    signal.rank = (ranks.get(signal.file.path) ?? 0) / max;
    signal.score += WEIGHTS.rank * signal.rank;
  }
}

function describe(signal: Signals, byPath: Map<string, Signals>): string[] {
  const reasons: string[] = [];
  for (const name of signal.defines.slice(0, 2)) reasons.push(`defines ${name}`);
  if (signal.pathHits.length) reasons.push(`path match ${signal.pathHits.slice(0, 3).map(quote).join(", ")}`);
  if (signal.siblings.length) {
    const noun = splitIdentifier(signal.siblings[0]).at(-1);
    reasons.push(`defines sibling ${noun}s ${signal.siblings.slice(-3).join(", ")}`);
  }
  if (signal.active) reasons.push("open in editor");
  if (signal.rank >= 0.2) {
    const importer = strongest(
      [...byPath.values()].filter((other) => other.file.imports.includes(signal.file.path)),
      signal.file.path,
    );
    const imported = strongest(signal.file.imports.map((path) => byPath.get(path)).filter((other) => other !== undefined), signal.file.path);
    if (importer) reasons.push(`imported by ${basename(importer)}`);
    else if (imported) reasons.push(`imports ${basename(imported)}`);
  }
  const terms = unique([...signal.namingHits, ...signal.bm25Hits]).slice(0, 3);
  if (terms.length) reasons.push(`term match ${terms.join(", ")}`);
  return reasons;
}

function strongest(candidates: Signals[], self: string): string | undefined {
  const best = candidates
    .filter((other) => other.file.path !== self && other.score > 0)
    .sort((a, b) => b.score - a.score || compare(a.file.path, b.file.path))[0];
  return best?.file.path;
}

function addCompanions(signals: Signals[], byPath: Map<string, Signals>, index: WorkspaceIndex): void {
  const ordered = [...signals].sort((a, b) => b.score - a.score || compare(a.file.path, b.file.path));
  const top = ordered[0]?.score ?? 0;
  const parents = ordered
    .filter((signal) => signal.role === "target" && CODE_FILE.test(signal.file.path) && !isTest(signal.file.path) && !isDoc(signal.file.path) && signal.score >= top * 0.4)
    .slice(0, 3);
  for (const parent of parents) {
    for (const [path, kind] of companionsOf(parent.file.path, byPath)) {
      const companion = byPath.get(path)!;
      const score = parent.score * WEIGHTS.companion + companion.score * 0.25;
      if (score <= companion.score) continue;
      companion.score = score;
      companion.role = "target";
      companion.reasons.unshift(`${kind} companion of ${basename(parent.file.path)}`);
    }
    // Co-change: files that changed in the same commits as the parent, weighted by how often (share of its commits).
    const changes = index.changeCount.get(parent.file.path) ?? 0;
    const partners = index.coChange.get(parent.file.path);
    if (!partners || changes < 3) continue;
    for (const [path, together] of partners) {
      const candidate = byPath.get(path);
      const share = together / changes;
      if (!candidate || together < 2 || share < 0.12 || META_FILE.test(path)) continue;
      const score = parent.score * WEIGHTS.coChange * Math.min(1, share * 2.5) + candidate.score * 0.25;
      if (score <= candidate.score) continue;
      candidate.score = score;
      candidate.role = "target";
      candidate.reasons.unshift(`changes with ${basename(parent.file.path)} (${together} of ${changes} commits)`);
    }
  }
}

function companionsOf(path: string, byPath: Map<string, Signals>): [string, string][] {
  const parts = path.split("/");
  const stemName = parts[parts.length - 1].replace(/\.[^.]+$/, "");
  const names = stemName === "__init__" || stemName === "index" ? [parts[parts.length - 2]] : [stemName, parts[parts.length - 2]];
  const found: [string, string][] = [];
  for (const name of names.filter(Boolean)) {
    const testNames = new Set([`test_${name}`, `${name}_test`, `${name}.test`, `${name}.spec`, `test-${name}`]);
    for (const candidate of byPath.keys()) {
      if (candidate === path) continue;
      const file = candidate.split("/").pop()!.replace(/\.[^.]+$/, "");
      if (isTest(candidate) && testNames.has(file)) found.push([candidate, "test"]);
      else if (isDoc(candidate) && file === name) found.push([candidate, "docs"]);
    }
    if (found.length) break;
  }
  return found;
}

function pinMentions(mentions: string[], byPath: Map<string, Signals>): void {
  mentions.forEach((raw, i) => {
    const mention = normalize(raw.replace(/^@/, ""));
    const hit = byPath.get(mention) ?? [...byPath.values()].find((signal) => signal.file.symbols.some((symbol) => symbol.name === mention));
    if (!hit) return;
    hit.score = 1000 - i;
    hit.role = "mentioned";
    hit.reasons.unshift(hit.file.path === mention ? "you mentioned it" : `you mentioned ${mention}`);
  });
}

function anchors(index: WorkspaceIndex, signal: Signals, terms: string[]): number[] {
  const wanted = new Set(terms);
  const scored = signal.file.symbols
    .map((symbol) => {
      let score = 0;
      if (signal.defines.includes(symbol.name)) score += 10;
      if (signal.siblings.includes(symbol.name)) score += 3;
      for (const part of splitIdentifier(symbol.name)) if (wanted.has(part)) score += 1;
      return { line: symbol.line, score: score + (signal.siblings.includes(symbol.name) ? symbol.line / 1e6 : 0) };
    })
    .filter((item) => item.score > 0);
  const text = index.text(signal.file.path);
  if (text) {
    const lines = text.split(/\r?\n/);
    const siblings = signal.siblings;
    lines.forEach((line, i) => {
      if (siblings.length >= 2 && siblings.some((name) => line.includes(name)) && !/^\s*(?:async\s+)?def\s/.test(line)) {
        const window = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
        const count = siblings.filter((name) => window.includes(name)).length;
        if (count >= 2) scored.push({ line: i + 1, score: 2 + count });
      }
    });
    if (!scored.length) {
      lines.forEach((line, i) => {
        const hits = new Set(textTerms(line).filter((term) => wanted.has(term))).size;
        if (hits >= 2 || (hits === 1 && /^\s*[#=\-~^]{3,}|^#+\s/.test(lines[i + 1] ?? ""))) scored.push({ line: i + 1, score: hits });
      });
    }
  }
  const picked: number[] = [];
  for (const item of scored.sort((a, b) => b.score - a.score || a.line - b.line)) {
    if (picked.every((line) => Math.abs(line - item.line) > 20)) picked.push(item.line);
    if (picked.length === 3) break;
  }
  return picked;
}

function isTest(path: string): boolean {
  return /(^|\/)(tests?|__tests__|spec)\//.test(path) || /(^|\/)test_[^/]*$|_test\.[^/]+$|\.(test|spec)\.[^/]+$/.test(path);
}

function isAuxiliary(path: string): boolean {
  return isTest(path) || isDoc(path) || /(^|\/)examples?\//.test(path);
}

function isDoc(path: string): boolean {
  return /(^|\/)docs?\//.test(path) && /\.(rst|md|mdx|txt|adoc)$/.test(path);
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function quote(term: string): string {
  return `"${term}"`;
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
