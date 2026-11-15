// Before/after benchmark: runs the e2e suite (Tasks A, C, cancel, B) for each model against `main` and this branch,
// then aggregates the JSON reports into docs/benchmarks/agent-mode.{json,md}.
//
//   node scripts/matrix.mjs --models anthropic/claude-sonnet-5-5,ollama/qwen3-8b --variants main,branch --runs 2
//   node scripts/matrix.mjs --report-only
//
// The same test suite drives both variants; only the extension build differs (main is built in a sibling worktree).
// Requires TrueForge running with providers registered (`npm run harness`) and the Flask venv (ANVIL_E2E_PYTHON).
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const runsDir = join(root, "docs/benchmarks/runs");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1] ?? "true"]] : pairs), []),
);
const TASK_B_PREFIX = "Add a new built-in CLI command flask config";

function mainWorktree() {
  const dir = resolve(root, "..", "anvil-main");
  if (!existsSync(dir)) execSync(`git worktree add "${dir}" main`, { cwd: root, stdio: "inherit" });
  if (!existsSync(join(dir, "node_modules"))) execSync("npm ci --no-audit --no-fund", { cwd: dir, stdio: "inherit" });
  if (!existsSync(join(dir, "dist", "extension.js"))) execSync("npm run build", { cwd: dir, stdio: "inherit" });
  return dir;
}

async function run() {
  const models = (args.models ?? "").split(",").filter(Boolean);
  const variants = (args.variants ?? "main,branch").split(",");
  const runs = Number(args.runs ?? 1);
  const concurrency = Number(args.concurrency ?? 4);
  if (!models.length) throw new Error("--models is required");
  mkdirSync(runsDir, { recursive: true });
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  const extension = { branch: root, main: variants.includes("main") ? mainWorktree() : undefined };
  execSync("npx esbuild test/e2e/suite.ts --bundle --platform=node --format=cjs --external:vscode --outfile=dist/test/suite.js", { cwd: root, stdio: "inherit" });
  const python = process.env.ANVIL_E2E_PYTHON ?? resolve(root, "..", "flask-3.1.3", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const logs = join(runsDir, "logs");
  mkdirSync(logs, { recursive: true });

  const jobs = [];
  for (let n = 1; n <= runs; n++) for (const model of models) for (const variant of n % 2 ? variants : [...variants].reverse()) jobs.push({ n, model, variant });

  const runJob = ({ n, model, variant }) =>
    new Promise((done) => {
      const name = `${variant}__${model.replaceAll("/", "_")}__${n}`;
      const report = join(runsDir, `${name}.json`);
      if (existsSync(report) && args.resume === "true") return done();
      const started = Date.now();
      const log = openSync(join(logs, `${name}.log`), "w");
      console.log(`start ${name}`);
      const child = spawn(process.execPath, [join(root, "scripts/e2e.mjs")], {
        cwd: root,
        stdio: ["ignore", log, log],
        env: {
          ...process.env,
          ANVIL_E2E_MODEL: model,
          ANVIL_E2E_TASK_B: "1",
          ANVIL_E2E_SKIP_BUILD: "1",
          ANVIL_E2E_REPORT: report,
          ANVIL_E2E_EXTENSION: extension[variant],
          ANVIL_E2E_PYTHON: python,
          ANVIL_E2E_USER_DATA: mkdtempSync(join(tmpdir(), "anvil-vscode-")),
          ANVIL_E2E_REASONING: model.startsWith("ollama/") ? "none" : process.env.ANVIL_E2E_REASONING ?? "low",
          // The agent's run_command must find a Python with Flask's test deps, as a developer's activated venv would.
          PATH: `${dirname(python)}${delimiter}${process.env.PATH ?? process.env.Path ?? ""}`,
          Path: `${dirname(python)}${delimiter}${process.env.PATH ?? process.env.Path ?? ""}`,
          VIRTUAL_ENV: dirname(dirname(python)),
        },
      });
      child.on("close", (code) => {
        if (!existsSync(report)) writeFileSync(report, JSON.stringify({ model, harnessError: true, exitCode: code, wallMs: Date.now() - started }));
        console.log(`done  ${name} (${Math.round((Date.now() - started) / 1000)}s)`);
        done();
      });
    });

  // Local models share one GPU, so they run one at a time; hosted models run in parallel.
  const lane = async (queue, width) => {
    const workers = Array.from({ length: width }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await runJob(job);
    });
    await Promise.all(workers);
  };
  await Promise.all([lane(jobs.filter((job) => job.model.startsWith("ollama/")), 1), lane(jobs.filter((job) => !job.model.startsWith("ollama/")), concurrency)]);
}

const exitOf = (output = "") => /^exit (\S+)/m.exec(output)?.[1] ?? /^exit code: (\S+)/m.exec(output)?.[1];

function metrics(report) {
  if (report.harnessError || !report.turns) return { harnessError: true };
  const start = report.turns.findIndex((turn) => turn.prompt?.startsWith(TASK_B_PREFIX));
  const turns = start < 0 ? [] : report.turns.slice(start);
  const steps = turns.flatMap((turn) => turn.steps.filter((step) => step.kind === "tool" && !step.threadTitle));
  const tools = {};
  for (const step of steps) tools[step.name] = (tools[step.name] ?? 0) + 1;
  const commands = steps.filter((step) => step.name === "run_command" && step.output);
  const failedRuns = commands.filter((step) => exitOf(step.output) !== "0").length;
  let lastPass = -1;
  let lastEdit = -1;
  steps.forEach((step, i) => {
    if (step.name === "run_command" && exitOf(step.output) === "0") lastPass = i;
    if ((step.name === "propose_edit" || step.name === "create_file") && step.diff) lastEdit = i;
  });
  const usage = turns.reduce((sum, turn) => ({ input: sum.input + turn.usage.input, output: sum.output + turn.usage.output, cached: sum.cached + turn.usage.cached }), { input: 0, output: 0, cached: 0 });
  const context = turns[0]?.context;
  const top5 = (context?.files ?? []).filter((file) => file.role !== "mentioned").slice(0, 5).map((file) => file.path);
  return {
    passed: Boolean(report.taskB?.passed),
    filesChanged: report.taskB?.filesChanged ?? 0,
    pytest: Boolean(report.taskB?.pytest),
    toolCalls: steps.length,
    tools,
    failedTestRuns: failedRuns,
    untestedEdits: lastEdit > lastPass,
    verifiedFinish: turns.some((turn) => turn.finish?.verified),
    followUps: turns.filter((turn) => turn.followUp).length,
    hitTop5: report.taskB?.files ? report.taskB.files.filter((file) => top5.includes(file)).length : undefined,
    usage,
    cacheHit: usage.input ? usage.cached / usage.input : 0,
    seconds: (report.timings?.taskB ?? 0) / 1000,
    // Context and state: did Anvil's prediction contain what the agent ended up editing, and how much did it look outside it.
    predictedShare: report.taskB?.filesChanged ? (report.taskB.files.filter((file) => top5.includes(file)).length / report.taskB.filesChanged) : undefined,
    readsOutsidePack: context?.fetched?.length ?? 0,
    readCalls: tools.read_file ?? 0,
    // Feed-forward guardrails that fired (visible in tool results the model saw).
    loopNudges: steps.filter((step) => /Loop warning/.test(step.output ?? "")).length,
    scopeFlags: steps.filter((step) => /The user was warned about/.test(step.output ?? "")).length,
    groundingFlags: steps.filter((step) => /Grounding check/.test(step.output ?? "")).length,
    gateRejections: steps.filter((step) => step.name === "finish_task" && /Not accepted/.test(step.output ?? "")).length,
    restore: report.checks?.restore ? report.checks.restore.ok === true : undefined,
    taskA: report.checks ? report.checks.taskA?.ok === true : undefined,
    taskC: report.checks ? report.checks.taskC?.ok === true : undefined,
    cancel: report.checks ? report.checks.cancel?.ok === true : undefined,
  };
}

function aggregate() {
  if (!existsSync(runsDir)) throw new Error("no runs yet");
  let rows = readdirSync(runsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const [variant, model, n] = file.replace(/\.json$/, "").split("__");
      return { variant, model: model.replace("_", "/"), run: Number(n), ...metrics(JSON.parse(readFileSync(join(runsDir, file), "utf8"))) };
    });
  // --only <regex> limits the report to providers that actually answered (see agent-mode-findings.md).
  if (args.only) rows.splice(0, rows.length, ...rows.filter((row) => new RegExp(args.only).test(row.model)));
  writeFileSync(join(root, "docs/benchmarks/agent-mode.json"), JSON.stringify(rows, null, 2));

  const pct = (list, pick) => (list.length ? `${list.filter(pick).length}/${list.length}` : "–");
  const avg = (list, pick) => (list.length ? list.reduce((sum, row) => sum + pick(row), 0) / list.length : 0);
  const byKey = new Map();
  for (const row of rows) byKey.set(`${row.model}|${row.variant}`, [...(byKey.get(`${row.model}|${row.variant}`) ?? []), row]);
  const models = [...new Set(rows.map((row) => row.model))].sort();

  const lines = [
    "# Agent-mode benchmark: main (before) vs feat/agent-mode-behaviour (after)",
    "",
    "Same e2e suite drives both builds on Flask 3.1.3: Task A (inline edit), Task C (dead endpoint → failover), cancel mid-run,",
    "and Task B (agent adds `flask config`, verified by pytest, `flask --help`, masked JSON, ≥3 files). Each task is scored",
    "independently. Generated by `node scripts/matrix.mjs --report-only`; raw rows in agent-mode.json.",
    "",
    "## Behaviour totals across all models",
    "",
    "| Behaviour | Before (main) | After (branch) |",
    "|---|---|---|",
  ];
  const side = (variant) => rows.filter((row) => row.variant === variant && !row.harnessError);
  const before = side("main");
  const after = side("branch");
  const total = [
    ["Task A inline edit passed", (r) => r.taskA === true],
    ["Task C failover passed", (r) => r.taskC === true],
    ["Cancel left the tree clean", (r) => r.cancel === true],
    ["Task B fully passed (pytest + help + masked + ≥3 files)", (r) => r.passed],
    ["Task B: agent ended with untested edits", (r) => r.untestedEdits],
    ["Task B: agent finished with a verified claim", (r) => r.verifiedFinish],
  ];
  for (const [label, pick] of total) lines.push(`| ${label} | ${pct(before, pick)} | ${pct(after, pick)} |`);
  lines.push(`| Task B: failed test runs per run (avg) | ${avg(before, (r) => r.failedTestRuns).toFixed(1)} | ${avg(after, (r) => r.failedTestRuns).toFixed(1)} |`);
  lines.push(`| Task B: tool calls per run (avg) | ${avg(before, (r) => r.toolCalls).toFixed(1)} | ${avg(after, (r) => r.toolCalls).toFixed(1)} |`);
  lines.push(`| Task B: files changed (avg) | ${avg(before, (r) => r.filesChanged).toFixed(1)} | ${avg(after, (r) => r.filesChanged).toFixed(1)} |`);
  lines.push(`| Runs with harness errors (no report) | ${rows.filter((r) => r.variant === "main" && r.harnessError).length} | ${rows.filter((r) => r.variant === "branch" && r.harnessError).length} |`);

  const traitRow = (label, pick, format = (v) => v) => lines.push(`| ${label} | ${format(pick(before))} | ${format(pick(after))} |`);
  const share = (list, pick) => pct(list, pick);
  const mean = (list, pick) => (list.length ? (list.reduce((sum, row) => sum + (pick(row) ?? 0), 0) / list.length).toFixed(2) : "–");
  const withB = (list) => list.filter((row) => row.filesChanged > 0);
  lines.push("", "## By harness trait", "", "| Trait / metric | Before | After |", "|---|---|---|");
  lines.push("| **Objective verification loops** | | |");
  traitRow("Ended Task B with untested edits", (l) => share(l, (r) => r.untestedEdits));
  traitRow("Finished with a verified claim backed by a passing check", (l) => share(l, (r) => r.verifiedFinish));
  traitRow("Failed test runs per Task B", (l) => mean(l, (r) => r.failedTestRuns));
  traitRow("finish_task claims rejected by the gate", (l) => mean(l, (r) => r.gateRejections));
  lines.push("| **Feed-forward guardrails** | | |");
  traitRow("Scope warnings shown to the model per run", (l) => mean(l, (r) => r.scopeFlags));
  traitRow("Grounding (undefined name) warnings per run", (l) => mean(l, (r) => r.groundingFlags));
  traitRow("Loop nudges per run", (l) => mean(l, (r) => r.loopNudges));
  lines.push("| **Context and state management** | | |");
  traitRow("Edited files that were in Anvil's top-5 prediction", (l) => mean(withB(l), (r) => r.predictedShare));
  traitRow("read_file calls per Task B", (l) => mean(l, (r) => r.readCalls));
  traitRow("Files read outside the context pack", (l) => mean(l, (r) => r.readsOutsidePack));
  traitRow("Input tokens per Task B", (l) => Math.round(avg(l, (r) => r.usage?.input ?? 0)).toLocaleString("en-US"));
  traitRow("Prompt-cache hit", (l) => `${Math.round(avg(l, (r) => r.cacheHit ?? 0) * 100)}%`);
  lines.push("| **Safe execution and harness reliability** | | |");
  traitRow("Cancel left the tree clean", (l) => share(l, (r) => r.cancel === true));
  traitRow("Dead endpoint → automatic failover", (l) => share(l, (r) => r.taskC === true));
  traitRow("Restore (message + code) left the tree clean", (l) => share(l.filter((r) => r.restore !== undefined), (r) => r.restore === true));

  lines.push(
    "",
    "## Per model",
    "",
    "| Model | Build | Runs | A | C failover | Cancel | B passed | B files | Tool calls | Failed test runs | Untested edits | Verified finish | Input tokens | Cache | Seconds |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const model of models) {
    for (const variant of ["main", "branch"]) {
      const list = byKey.get(`${model}|${variant}`) ?? [];
      if (!list.length) continue;
      const ok = list.filter((row) => !row.harnessError);
      const errors = list.length - ok.length;
      lines.push(
        `| ${model} | ${variant === "main" ? "before" : "after"} | ${list.length}${errors ? ` (${errors} err)` : ""} | ${pct(ok, (r) => r.taskA === true)} | ${pct(ok, (r) => r.taskC === true)} | ${pct(ok, (r) => r.cancel === true)} | ${pct(ok, (r) => r.passed)} | ${avg(ok, (r) => r.filesChanged).toFixed(1)} | ${avg(ok, (r) => r.toolCalls).toFixed(1)} | ${avg(ok, (r) => r.failedTestRuns).toFixed(1)} | ${pct(ok, (r) => r.untestedEdits)} | ${pct(ok, (r) => r.verifiedFinish)} | ${Math.round(avg(ok, (r) => r.usage?.input ?? 0)).toLocaleString("en-US")} | ${Math.round(avg(ok, (r) => r.cacheHit ?? 0) * 100)}% | ${avg(ok, (r) => r.seconds ?? 0).toFixed(0)} |`,
      );
    }
  }
  writeFileSync(join(root, "docs/benchmarks/agent-mode.md"), `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
}

if (args["report-only"] !== "true") await run();
aggregate();
