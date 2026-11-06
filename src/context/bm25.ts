import type { FileEntry, WorkspaceIndex } from "./workspaceIndex.ts";

interface Stats {
  version: number;
  df: Map<string, number>;
  avgLength: number;
  count: number;
}

const cache = new WeakMap<WorkspaceIndex, Stats>();
const K1 = 1.2;
const B = 0.75;

function stats(index: WorkspaceIndex): Stats {
  const cached = cache.get(index);
  if (cached && cached.version === index.version) return cached;
  const df = new Map<string, number>();
  let total = 0;
  const files = index.files();
  for (const file of files) {
    total += file.length;
    for (const term of file.termFreq.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const fresh = { version: index.version, df, avgLength: total / Math.max(1, files.length), count: files.length };
  cache.set(index, fresh);
  return fresh;
}

export function idf(index: WorkspaceIndex, term: string): number {
  const { df, count } = stats(index);
  const n = df.get(term) ?? 0;
  return Math.log(1 + (count - n + 0.5) / (n + 0.5));
}

export function bm25(index: WorkspaceIndex, file: FileEntry, terms: string[]): { score: number; matched: string[] } {
  const { avgLength } = stats(index);
  let score = 0;
  const matched: { term: string; weight: number }[] = [];
  for (const term of new Set(terms)) {
    const tf = file.termFreq.get(term);
    if (!tf) continue;
    const weight = (idf(index, term) * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * file.length) / avgLength));
    score += weight;
    matched.push({ term, weight });
  }
  return { score, matched: matched.sort((a, b) => b.weight - a.weight).map((item) => item.term) };
}
