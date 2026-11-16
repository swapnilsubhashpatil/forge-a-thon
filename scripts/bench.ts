import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bm25 } from "../src/context/bm25.ts";
import { findRipgrep, searchCode } from "../src/context/codeSearch.ts";
import { buildContextPack } from "../src/context/contextPack.ts";
import { rankFiles } from "../src/context/ranker.ts";
import { pathTerms, queryTokens } from "../src/context/terms.ts";
import { WorkspaceIndex } from "../src/context/workspaceIndex.ts";

const ROOT = process.env.FLASK_REPO ?? "C:/Coding/flask-3.1.3";
const BUDGET = 6000;
const OUT = join(import.meta.dirname, "..", "docs", "benchmarks");

const QUERIES: { query: string; truth: string[] }[] = [
  {
    query: "Add a new `flask config` CLI command that prints the current app's configuration as JSON, with an option to mask secret values, and add tests for it.",
    truth: ["src/flask/cli.py", "tests/test_cli.py", "docs/cli.rst"],
  },
  { query: "change get_debug_flag so FLASK_DEBUG=off is false", truth: ["src/flask/helpers.py"] },
  { query: "where are blueprints registered", truth: ["src/flask/sansio/app.py", "src/flask/sansio/blueprints.py"] },
  { query: "add a test for json provider sort keys", truth: ["src/flask/json/provider.py", "tests/test_json.py"] },
  { query: "make the session cookie SameSite attribute configurable per request", truth: ["src/flask/sessions.py"] },
  { query: "support loading configuration from a TOML file", truth: ["src/flask/config.py"] },
  { query: "improve the error message when no create_app factory is found in the module", truth: ["src/flask/cli.py"] },
  { query: "send a signal when the application context is pushed", truth: ["src/flask/ctx.py", "src/flask/signals.py"] },
  { query: "MethodView should dispatch HEAD requests to the get method", truth: ["src/flask/views.py"] },
  { query: "url_for should quote special characters in the _anchor fragment", truth: ["src/flask/app.py"] },
  { query: "teardown_appcontext callbacks should run even after an unhandled exception", truth: ["src/flask/app.py", "src/flask/ctx.py"] },
  { query: "allow registering template filters on a blueprint for the whole app", truth: ["src/flask/sansio/blueprints.py"] },
];

type Ranker = (index: WorkspaceIndex, query: string) => string[];

const rankers: Record<string, Ranker> = {
  anvil: (index, query) => rankFiles(index, { text: query, limit: 20 }).map((file) => file.path),
  bm25: (index, query) => {
    const terms = queryTokens(query).map((token) => token.term);
    return order(index.files().map((file) => [file.path, bm25(index, file, terms).score]));
  },
  pathOnly: (index, query) => {
    const terms = new Set(queryTokens(query).map((token) => token.term));
    return order(
      index.files().map((file) => {
        const { base, dirs } = pathTerms(file.path);
        return [file.path, [...base, ...dirs].filter((term) => terms.has(term)).length];
      }),
    );
  },
};

function order(scores: [string, number][]): string[] {
  return scores
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([path]) => path);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function time(run: () => unknown | Promise<unknown>, repeat = 5): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < repeat; i++) {
    const start = performance.now();
    await run();
    samples.push(performance.now() - start);
  }
  return round(median(samples));
}

function round(value: number, digits = 1): number {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

function ripgrepPath(): string | undefined {
  const base = join(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code");
  const roots = [process.env.VSCODE_APP_ROOT ?? ""];
  if (existsSync(base)) for (const dir of readdirSync(base)) roots.push(join(base, dir, "resources", "app"));
  for (const root of roots.filter(Boolean)) {
    const found = findRipgrep(root);
    if (found) return found;
  }
  return undefined;
}

if (!existsSync(ROOT)) {
  console.error(`Flask repo not found at ${ROOT}; set FLASK_REPO.`);
  process.exit(1);
}

const index = new WorkspaceIndex(ROOT);
const buildMs = await time(() => index.build());
const fileCount = index.files().length;
const totalTokens = index.files().reduce((sum, file) => sum + file.tokens, 0);

const quality: Record<string, { recall3: number; recall5: number; mrr: number }> = {};
const perQuery: { query: string; truth: string[]; anvilTop5: string[]; hit3: Record<string, number> }[] = QUERIES.map((item) => ({
  query: item.query,
  truth: item.truth,
  anvilTop5: [],
  hit3: {},
}));
for (const [name, ranker] of Object.entries(rankers)) {
  let recall3 = 0;
  let recall5 = 0;
  let mrr = 0;
  QUERIES.forEach((item, i) => {
    const ranked = ranker(index, item.query);
    const within = (k: number) => item.truth.filter((path) => ranked.slice(0, k).includes(path)).length / item.truth.length;
    recall3 += within(3);
    recall5 += within(5);
    const first = ranked.findIndex((path) => item.truth.includes(path));
    mrr += first < 0 ? 0 : 1 / (first + 1);
    perQuery[i].hit3[name] = round(within(3), 2);
    if (name === "anvil") perQuery[i].anvilTop5 = ranked.slice(0, 5);
  });
  quality[name] = { recall3: round(recall3 / QUERIES.length, 3), recall5: round(recall5 / QUERIES.length, 3), mrr: round(mrr / QUERIES.length, 3) };
}

const rankMs = await time(() => QUERIES.forEach((item) => rankFiles(index, { text: item.query })));
const packs = [];
for (const item of QUERIES) {
  const ranked = rankFiles(index, { text: item.query });
  const pack = await buildContextPack(index, ranked, BUDGET);
  const naive = ranked.slice(0, 8).reduce((sum, file) => sum + (index.get(file.path)?.tokens ?? 0), 0);
  packs.push({ packTokens: pack.report.usedTokens, naiveTokens: naive });
}
const packMs = await time(async () => {
  for (const item of QUERIES) await buildContextPack(index, rankFiles(index, { text: item.query }), BUDGET);
});
const packTotal = packs.reduce((sum, pack) => sum + pack.packTokens, 0);
const naiveTotal = packs.reduce((sum, pack) => sum + pack.naiveTokens, 0);

const rg = ripgrepPath();
const searches = ["add_command", "def .*_command", "SESSION_COOKIE"];
const search: { query: string; fallbackMs: number; ripgrepMs?: number }[] = [];
for (const query of searches) {
  const options = { query, regex: query.includes("*") };
  search.push({
    query,
    fallbackMs: await time(() => searchCode(index, options)),
    ripgrepMs: rg ? await time(() => searchCode(index, options, rg)) : undefined,
  });
}

const result = {
  repo: "pallets/flask 3.1.3",
  date: new Date().toISOString().slice(0, 10),
  node: process.version,
  files: fileCount,
  repoTokens: totalTokens,
  buildMsMedianOf5: buildMs,
  rankMsPerQuery: round(rankMs / QUERIES.length, 2),
  packMsPerQuery: round(packMs / QUERIES.length, 2),
  quality,
  perQuery,
  pack: {
    budgetTokens: BUDGET,
    avgPackTokens: Math.round(packTotal / packs.length),
    avgNaiveTop8Tokens: Math.round(naiveTotal / packs.length),
    savingsPercent: round(100 * (1 - packTotal / naiveTotal), 1),
    maxPackTokens: Math.max(...packs.map((pack) => pack.packTokens)),
  },
  search: { ripgrep: rg ? "VS Code bundled rg" : "not found", results: search },
};

const md = `# Context retrieval benchmark

Repo: ${result.repo} (${fileCount} indexed text files, ~${Math.round(totalTokens / 1000)}k tokens). Node ${result.node}, ${result.date}.
Run with \`node scripts/bench.ts\` (set \`FLASK_REPO\` to point elsewhere). Tokens are estimated as chars/4.

## Method
- **Index build**: \`git ls-files\`, read, regex skeletons, import edges and term bags; median of 5 cold builds.
- **Quality**: ${QUERIES.length} realistic tasks with ground-truth files checked against the Flask source (the files a correct change or answer touches).
  recall@k = share of ground-truth files in the top k; MRR = mean of 1/rank of the first ground-truth file.
- **Baselines**: \`bm25\` ranks files by BM25 over the same term bags with all query words; \`pathOnly\` counts query words found in path segments.
  \`anvil\` is the full ranker (path match, BM25, symbol definitions, sibling symbols, test/docs companions, import-graph PageRank).
- **Pack**: context pack at a ${BUDGET}-token budget vs the naive approach of sending the full text of the same top-8 files.

## Speed
| step | time |
|---|---|
| index build (median of 5) | ${buildMs} ms |
| rank one query | ${result.rankMsPerQuery} ms |
| rank + build pack, one query | ${result.packMsPerQuery} ms |

## Retrieval quality
| ranker | recall@3 | recall@5 | MRR |
|---|---|---|---|
${Object.entries(quality).map(([name, q]) => `| ${name} | ${q.recall3} | ${q.recall5} | ${q.mrr} |`).join("\n")}

| task | ground truth | anvil top 5 | recall@3 anvil / bm25 / path |
|---|---|---|---|
${perQuery.map((q) => `| ${q.query.replace(/\|/g, "\\|")} | ${q.truth.join(", ")} | ${q.anvilTop5.join(", ")} | ${q.hit3.anvil} / ${q.hit3.bm25} / ${q.hit3.pathOnly} |`).join("\n")}

## Token savings
| measure | tokens |
|---|---|
| average context pack | ${result.pack.avgPackTokens} (max ${result.pack.maxPackTokens}, budget ${BUDGET}) |
| average naive top-8 full files | ${result.pack.avgNaiveTop8Tokens} |
| savings | ${result.pack.savingsPercent}% |

## Code search (median of 5)
| query | JS fallback | ripgrep |
|---|---|---|
${search.map((s) => `| \`${s.query}\` | ${s.fallbackMs} ms | ${s.ripgrepMs === undefined ? "n/a" : `${s.ripgrepMs} ms`} |`).join("\n")}

ripgrep: ${result.search.ripgrep}. The fallback scans the in-memory index cache; rg includes process spawn cost.

## Limitations
- Ground truth is hand-labelled by us on one Python repo; the queries were written while tuning the ranker, so treat the numbers as a sanity check, not a held-out score.
- Skeletons are regex-based (Python, JS/TS); other languages rank on paths and terms only.
`;

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "context.json"), JSON.stringify(result, null, 2) + "\n");
await writeFile(join(OUT, "context.md"), md);
console.log(md);
