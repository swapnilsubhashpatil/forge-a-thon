import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyReplacement } from "../src/edits/editMatcher.ts";

const FLASK = process.env.FLASK_SRC ?? "C:/Coding/flask-3.1.3/src/flask";
const OUT = "docs/benchmarks";
const SAMPLE = 30;
const MARKER = "anvil_bench_marker = 1";

interface Block {
  file: string;
  name: string;
  source: string;
  start: number;
  lines: string[];
}

interface Perturbation {
  name: string;
  apply: (block: Block) => { source: string; oldString: string } | undefined;
  rewritesContent?: boolean;
}

function extractBlocks(): Block[] {
  const blocks: Block[] = [];
  for (const file of readdirSync(FLASK).filter((f) => f.endsWith(".py")).sort()) {
    const source = readFileSync(join(FLASK, file), "utf8").replace(/\r\n/g, "\n");
    const lines = source.split("\n");
    lines.forEach((line, start) => {
      const def = /^(\s*)def (\w+)/.exec(line);
      if (!def) return;
      let end = start + 1;
      while (end < lines.length && (lines[end].trim() === "" || indentOf(lines[end]) > def[1].length)) end++;
      while (end > start && lines[end - 1].trim() === "") end--;
      const body = lines.slice(start, end);
      if (body.length >= 6 && body.length <= 30 && !body.some((l) => l.includes("\t"))) {
        blocks.push({ file, name: def[2], source, start, lines: body });
      }
    });
  }
  const step = blocks.length / SAMPLE;
  return Array.from({ length: Math.min(SAMPLE, blocks.length) }, (_, i) => blocks[Math.floor(i * step)]);
}

function indentOf(line: string): number {
  return /^ */.exec(line)![0].length;
}

const plain = (block: Block, lines: string[]) => ({ source: block.source, oldString: lines.join("\n") });

const perturbations: Perturbation[] = [
  { name: "none", apply: (b) => plain(b, b.lines) },
  { name: "trailing whitespace", apply: (b) => plain(b, b.lines.map((l, i) => (i % 2 === 0 ? `${l}  ` : l))) },
  { name: "tabs instead of spaces", apply: (b) => plain(b, b.lines.map((l) => l.replace(/^( {4})+/, (m) => "\t".repeat(m.length / 4)))) },
  {
    name: "wrong indentation level",
    apply: (b) => {
      const base = indentOf(b.lines[0]);
      return plain(b, b.lines.map((l) => (base > 0 ? l.slice(Math.min(base, indentOf(l))) : `    ${l}`)));
    },
  },
  { name: "CRLF file, LF old_string", apply: (b) => ({ source: b.source.replace(/\n/g, "\r\n"), oldString: b.lines.join("\n") }) },
  {
    name: "one-character typo",
    rewritesContent: true,
    apply: (b) => {
      const index = b.lines.findIndex((l, i) => i > 0 && /[a-z]{4}/.test(l));
      if (index < 0) return undefined;
      return plain(b, b.lines.map((l, i) => (i === index ? l.replace(/([a-z])([a-z])/, "$2$1") : l)));
    },
  },
  {
    name: "missing blank line",
    rewritesContent: true,
    apply: (b) => {
      const index = b.lines.findIndex((l) => l.trim() === "");
      return index < 0 ? undefined : plain(b, b.lines.filter((_, i) => i !== index));
    },
  },
];

function newStringFor(oldString: string): string {
  const lines = oldString.split("\n");
  const bodyIndent = /^[ \t]*/.exec(lines.find((l, i) => i > 0 && l.trim() !== "") ?? "")![0];
  return [lines[0], `${bodyIndent}${MARKER}`, ...lines.slice(1)].join("\n");
}

function expectedText(block: Block): string {
  const lines = block.source.split("\n");
  const bodyIndent = " ".repeat(indentOf(block.lines.find((l, i) => i > 0 && l.trim() !== "")!));
  lines.splice(block.start + 1, 0, `${bodyIndent}${MARKER}`);
  return lines.join("\n");
}

function spliced(block: Block, newString: string): string {
  const lines = block.source.split("\n");
  lines.splice(block.start, block.lines.length, ...newString.split("\n"));
  return lines.join("\n");
}

function exactOnly(source: string, oldString: string, newString: string): string | undefined {
  const first = source.indexOf(oldString);
  if (first < 0 || source.indexOf(oldString, first + 1) >= 0) return undefined;
  return source.slice(0, first) + newString + source.slice(first + oldString.length);
}

const normalize = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");

const blocks = extractBlocks();
const rows: Array<Record<string, string | number>> = [];
const totals = { cases: 0, exact: 0, cascadeLocated: 0, cascadeExact: 0 };

for (const perturbation of perturbations) {
  const row = { perturbation: perturbation.name, cases: 0, exactOnly: 0, cascadeLocated: 0, cascadeExact: 0, kinds: {} as Record<string, number> };
  for (const block of blocks) {
    const input = perturbation.apply(block);
    if (!input) continue;
    row.cases++;
    const newString = newStringFor(input.oldString);
    const crlf = input.source.includes("\r\n");
    const intended = perturbation.rewritesContent ? spliced(block, newString) : expectedText(block);
    const wanted = crlf ? intended.replace(/\n/g, "\r\n") : intended;
    if (exactOnly(input.source, input.oldString, newString) === wanted) row.exactOnly++;
    const result = applyReplacement(input.source, input.oldString, newString);
    if (!result.ok) continue;
    row.kinds[result.matchKind] = (row.kinds[result.matchKind] ?? 0) + 1;
    if (normalize(result.text) === normalize(wanted)) row.cascadeLocated++;
    if (result.text === wanted) row.cascadeExact++;
  }
  totals.cases += row.cases;
  totals.exact += row.exactOnly;
  totals.cascadeLocated += row.cascadeLocated;
  totals.cascadeExact += row.cascadeExact;
  rows.push({ ...row, kinds: Object.entries(row.kinds).map(([k, v]) => `${k}:${v}`).join(" ") });
}

let falsePositives = 0;
let negativeCases = 0;
blocks.forEach((block, i) => {
  const other = blocks[(i + 7) % blocks.length];
  if (other === block) return;
  const sourceLines = block.source.split("\n");
  sourceLines.splice(block.start, block.lines.length);
  const withoutBlock = sourceLines.join("\n");
  for (const oldString of [block.lines.join("\n"), block.lines.map((l, j) => (j === 1 ? l.replace(/([a-z])([a-z])/, "$2$1") : l)).join("\n")]) {
    negativeCases++;
    if (applyReplacement(withoutBlock, oldString, newStringFor(oldString)).ok) falsePositives++;
  }
});

const corpus = { cases: 0, matched: [] as string[] };
for (const file of readdirSync(FLASK).filter((f) => f.endsWith(".py")).sort()) {
  const lines = readFileSync(join(FLASK, file), "utf8").replace(/\r\n/g, "\n").split("\n");
  lines.forEach((line, start) => {
    const def = /^(\s*)def (\w+)/.exec(line);
    if (!def) return;
    let end = start + 1;
    while (end < lines.length && (lines[end].trim() === "" || indentOf(lines[end]) > def[1].length)) end++;
    while (end > start && lines[end - 1].trim() === "") end--;
    if (end - start < 3) return;
    const rest = [...lines];
    rest.splice(start, end - start);
    corpus.cases++;
    const result = applyReplacement(rest.join("\n"), lines.slice(start, end).join("\n"), "pass");
    if (result.ok) corpus.matched.push(`${file}:${start + 1} ${def[2]} (${result.matchKind})`);
  });
}

const started = performance.now();
for (const block of blocks) applyReplacement(block.source, block.lines.join("\n").replace(/e/, "E"), "x");
const fuzzyMs = (performance.now() - started) / blocks.length;

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
const report = {
  generatedAt: new Date().toISOString(),
  corpus: "flask 3.1.3 src/flask/*.py",
  blocks: blocks.map((b) => `${b.file}:${b.start + 1} ${b.name}`),
  rows,
  totals,
  negatives: { cases: negativeCases, falsePositives },
  corpusNegatives: corpus,
  avgFuzzyPathMs: Number(fuzzyMs.toFixed(2)),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "edits.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  join(OUT, "edits.md"),
  [
    "# Edit matcher robustness",
    "",
    `Corpus: ${blocks.length} function blocks (6 to 30 lines) sampled evenly from flask 3.1.3 \`src/flask/*.py\`.`,
    "Each block becomes an `old_string`, perturbed the way models typically get it wrong. The `new_string` is the",
    "perturbed block with one marker line added inside the function body, written in the same (possibly wrong) style.",
    "",
    "- **Exact only**: unique `String.indexOf` match, then splice. This is a plain search/replace tool.",
    "- **Cascade located**: `applyReplacement` succeeded and the result equals the intended edit after trimming each line",
    "  and dropping blank lines (right place, right content).",
    "- **Cascade byte-exact**: the result is byte-identical to the intended file, including re-indentation and line endings.",
    "  For the typo and missing-blank-line rows the intended file is the model's `new_string` spliced over the original",
    "  block: the model rewrote those lines, so its version is what should land.",
    "",
    "| Perturbation | Cases | Exact only | Cascade located | Cascade byte-exact | Stage used |",
    "|---|---:|---:|---:|---:|---|",
    ...rows.map((r) => `| ${r.perturbation} | ${r.cases} | ${pct(Number(r.exactOnly), Number(r.cases))} | ${pct(Number(r.cascadeLocated), Number(r.cases))} | ${pct(Number(r.cascadeExact), Number(r.cases))} | ${r.kinds} |`),
    `| **All** | ${totals.cases} | ${pct(totals.exact, totals.cases)} | ${pct(totals.cascadeLocated, totals.cases)} | ${pct(totals.cascadeExact, totals.cases)} | |`,
    "",
    `False-positive check: each block was deleted from its file and its \`old_string\` (verbatim and with a typo) applied`,
    `to the remaining file, where only other, similar functions exist. ${falsePositives} of ${negativeCases} cases matched (must be 0).`,
    "",
    `Whole-corpus check: every \`def\` of 3+ lines (${corpus.cases}) was deleted and its exact text applied to the rest of the file.`,
    `${corpus.matched.length} matched: ${corpus.matched.join(", ") || "none"}. These bodies exist verbatim a second time in the same file,`,
    "so a match is correct; the near-identical siblings (`do_teardown_request`/`do_teardown_appcontext`,",
    "`render_template`/`stream_template`) are rejected because fuzzy matching needs 4+ non-blank lines, at most 15% changed lines, each",
    "line at least 80% similar, an average of 85%+, and a 0.05 lead over any non-overlapping runner-up.",
    "",
    "Limitations: perturbations are synthetic and applied one at a time. The typo misses are short lines where one swapped pair drops",
    "line similarity under the 80% floor; those fail with a hint showing the closest lines so the model can retry. Recall is traded",
    "for zero wrong-location edits on purpose.",
    "",
    `Worst-case path (no exact match, fuzzy scan of the whole file): ${fuzzyMs.toFixed(2)} ms per edit on average.`,
    "",
    "Reproduce: `node scripts/bench-edits.ts` (set `FLASK_SRC` to point at another checkout).",
    "",
  ].join("\n"),
);

console.table(rows);
console.log(`exact-only ${pct(totals.exact, totals.cases)}, cascade located ${pct(totals.cascadeLocated, totals.cases)}, byte-exact ${pct(totals.cascadeExact, totals.cases)}`);
console.log(`false positives ${falsePositives}/${negativeCases}, fuzzy path ${fuzzyMs.toFixed(2)} ms`);
