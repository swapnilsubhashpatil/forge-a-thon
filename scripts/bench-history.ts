import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bm25 } from "../src/context/bm25.ts";
import { rankFiles } from "../src/context/ranker.ts";
import { queryTokens } from "../src/context/terms.ts";
import { WorkspaceIndex } from "../src/context/workspaceIndex.ts";

const REPO = process.env.FLASK_REPO ?? resolve(import.meta.dirname, "..", "..", "flask-3.1.3");
const OUT = join(import.meta.dirname, "..", "docs", "benchmarks");
const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) => (arg.startsWith("--") ? [[arg.slice(2), all[i + 1]]] : [])));
const LIMIT = Number(args.limit ?? 200);
const SPLIT = (args.split ?? "all") as "dev" | "test" | "all";

const NOISE = /^(CHANGES\.rst|docs\/changes|requirements|\.github\/|\.pre-commit|tox\.ini|pyproject\.toml|setup\.cfg|uv\.lock|\.gitignore|MANIFEST)/;
const BORING_SUBJECT = /^(release|bump|merge|start version|update (requirements|dependencies|pre-commit|dev dep)|pre-commit|\[pre-commit|fix typos?$|typo|formatting|format |black|isort|run pre-commit|update copyright|deprecate .* removed)/i;

const git = (...argv: string[]) => execFileSync("git", argv, { cwd: REPO, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

interface Task {
  sha: string;
  subject: string;
  truth: string[];
  split: "dev" | "test";
}

function collectTasks(): Task[] {
  const log = git("log", "--no-merges", "--since=2021-05-01", "--format=%x1e%H%x1f%s", "--name-status", "HEAD");
  const tasks: Task[] = [];
  for (const record of log.split("\x1e").slice(1)) {
    const [header, ...lines] = record.trim().split("\n");
    const [sha, subject] = header.split("\x1f");
    if (!subject || subject.length < 15 || BORING_SUBJECT.test(subject)) continue;
    const changed = lines
      .map((line) => line.split("\t"))
      .filter(([status]) => /^[MD]/.test(status ?? ""))
      .map(([, path]) => path)
      .filter((path) => path && !NOISE.test(path));
    if (!changed.some((path) => path.startsWith("src/") && path.endsWith(".py"))) continue;
    if (changed.length > 6) continue;
    tasks.push({ sha, subject: subject.replace(/\s*\(#\d+\)$/, ""), truth: changed, split: parseInt(sha.slice(0, 2), 16) % 2 ? "test" : "dev" });
    if (tasks.length >= LIMIT) break;
  }
  return SPLIT === "all" ? tasks : tasks.filter((task) => task.split === SPLIT);
}

type Ranker = (index: WorkspaceIndex, query: string) => string[];
const rankers: Record<string, Ranker> = {
  anvil: (index, query) => rankFiles(index, { text: query, limit: 20 }).map((file) => file.path),
  bm25: (index, query) => {
    const terms = queryTokens(query).map((token) => token.term);
    return index
      .files()
      .map((file) => [file.path, bm25(index, file, terms).score] as const)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([path]) => path);
  },
};

interface Scores {
  hit1: number;
  hit5: number;
  all5: number;
  recall5: number;
  recall10: number;
  mrr: number;
}

function score(ranked: string[], truth: string[]): Scores {
  const rank = truth.map((path) => ranked.indexOf(path)).filter((i) => i >= 0);
  const first = rank.length ? Math.min(...rank) : -1;
  const within = (k: number) => truth.filter((path) => { const i = ranked.indexOf(path); return i >= 0 && i < k; }).length;
  return {
    hit1: first === 0 ? 1 : 0,
    hit5: first >= 0 && first < 5 ? 1 : 0,
    all5: within(5) === truth.length ? 1 : 0,
    recall5: within(5) / truth.length,
    recall10: within(10) / truth.length,
    mrr: first >= 0 ? 1 / (first + 1) : 0,
  };
}

async function main(): Promise<void> {
  if (!existsSync(REPO)) throw new Error(`Flask clone not found at ${REPO}`);
  const tasks = collectTasks();
  const worktree = join(mkdtempSync(join(tmpdir(), "anvil-history-")), "flask");
  git("worktree", "add", "--detach", "-q", worktree, `${tasks[0].sha}^`);
  const rows: Array<Task & Record<string, Scores | string[]>> = [];
  try {
    for (const [n, task] of tasks.entries()) {
      execFileSync("git", ["checkout", "--detach", "-q", "--force", `${task.sha}^`], { cwd: worktree });
      const index = new WorkspaceIndex(worktree);
      await index.build();
      const row = { ...task } as Task & Record<string, Scores | string[]>;
      for (const [name, ranker] of Object.entries(rankers)) {
        const ranked = ranker(index, task.subject);
        row[name] = score(ranked, task.truth);
        if (name === "anvil") row.anvilTop5 = ranked.slice(0, 5);
      }
      rows.push(row);
      if ((n + 1) % 25 === 0) console.log(`${n + 1}/${tasks.length}`);
    }
  } finally {
    git("worktree", "remove", "--force", worktree);
  }
  report(rows);
}

function report(rows: Array<Task & Record<string, Scores | string[]>>): void {
  const keys: Array<keyof Scores> = ["hit1", "hit5", "all5", "recall5", "recall10", "mrr"];
  const mean = (list: typeof rows, ranker: string, key: keyof Scores) => list.reduce((sum, row) => sum + (row[ranker] as Scores)[key], 0) / (list.length || 1);
  const lines = [
    "# Held-out context benchmark: real Flask history",
    "",
    `${rows.length} non-merge commits since May 2021 that modified source files (≤6 files, changelog/CI/deps excluded). Request = commit subject;`,
    "truth = files the commit modified that existed before it; index built at the parent commit. Split by hash: tune on dev, report test.",
    "",
    "Metrics: hit@1 / hit@5 = a truth file ranked first / in the top 5; all@5 = every truth file in the top 5 (LocAgent-style file Acc@5);",
    "recall@k = share of truth files in the top k; MRR = 1 / rank of the first truth file.",
    "",
  ];
  for (const split of ["dev", "test", "all"] as const) {
    const list = split === "all" ? rows : rows.filter((row) => row.split === split);
    if (!list.length) continue;
    lines.push(`## ${split} (${list.length} tasks)`, "", `| ranker | ${keys.join(" | ")} |`, `|---|${keys.map(() => "---").join("|")}|`);
    for (const ranker of Object.keys(rankers)) lines.push(`| ${ranker} | ${keys.map((key) => mean(list, ranker, key).toFixed(3)).join(" | ")} |`);
    lines.push("");
  }
  const misses = rows.filter((row) => (row.anvil as Scores).hit5 === 0).slice(0, 15);
  lines.push("## Sample misses (anvil, no truth file in top 5)", "", "| commit | request | truth | anvil top 5 |", "|---|---|---|---|");
  for (const row of misses) lines.push(`| ${row.sha.slice(0, 8)} | ${row.subject.replace(/\|/g, "/")} | ${row.truth.join(", ")} | ${(row.anvilTop5 as string[]).join(", ")} |`);
  const suffix = SPLIT === "all" ? "" : `-${SPLIT}`;
  writeFileSync(join(OUT, `context-history${suffix}.md`), `${lines.join("\n")}\n`);
  writeFileSync(join(OUT, `context-history${suffix}.json`), JSON.stringify(rows, null, 2));
  console.log(lines.slice(0, 32).join("\n"));
}

await main();
