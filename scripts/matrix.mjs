// Before/after benchmark: runs the e2e suite (Tasks A, C, cancel, B) for each model against `main` and this branch,
// then aggregates the JSON reports into docs/benchmarks/agent-mode.{json,md}.
//
//   node scripts/matrix.mjs --models anthropic/claude-sonnet-5-5,ollama/qwen3-8b --variants main,branch --runs 2
//   node scripts/matrix.mjs --report-only
//
// The same test suite drives both variants; only the extension build differs (main is built in a sibling worktree).
// Requires TrueForge running with providers registered (`npm run harness`) and the Flask venv (ANVIL_E2E_PYTHON).
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

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

function run() {
  const models = (args.models ?? "").split(",").filter(Boolean);
  const variants = (args.variants ?? "main,branch").split(",");
  const runs = Number(args.runs ?? 1);
  if (!models.length) throw new Error("--models is required");
  mkdirSync(runsDir, { recursive: true });
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  const extension = { branch: root, main: variants.includes("main") ? mainWorktree() : undefined };
  const python = process.env.ANVIL_E2E_PYTHON ?? resolve(root, "..", "flask-3.1.3", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

  for (let n = 1; n <= runs; n++) {
    for (const model of models) {
      // Alternate the order per run so neither variant always gets the warm cache.
      for (const variant of n % 2 ? variants : [...variants].reverse()) {
        const report = join(runsDir, `${variant}__${model.replaceAll("/", "_")}__${n}.json`);
        console.log(`\n=== ${variant} · ${model} · run ${n} ===`);
        const started = Date.now();
        const result = spawnSync(process.execPath, [join(root, "scripts/e2e.mjs")], {
          cwd: root,
          stdio: "inherit",
          env: {
            ...process.env,
            ANVIL_E2E_MODEL: model,
            ANVIL_E2E_TASK_B: "1",
            ANVIL_E2E_REPORT: report,
            ANVIL_E2E_EXTENSION: extension[variant],
            ANVIL_E2E_PYTHON: python,
            ANVIL_E2E_REASONING: model.startsWith("ollama/") ? "none" : process.env.ANVIL_E2E_REASONING ?? "low",
          },
        });
        if (!existsSync(report)) writeFileSync(report, JSON.stringify({ model, harnessError: true, exitCode: result.status, wallMs: Date.now() - started }));
      }
    }
  }
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
    taskA: report.timings?.taskA !== undefined,
  };
}

function aggregate() {
  if (!existsSync(runsDir)) throw new Error("no runs yet");
  const rows = readdirSync(runsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const [variant, model, n] = file.replace(/\.json$/, "").split("__");
      return { variant, model: model.replace("_", "/"), run: Number(n), ...metrics(JSON.parse(readFileSync(join(runsDir, file), "utf8"))) };
    });
  writeFileSync(join(root, "docs/benchmarks/agent-mode.json"), JSON.stringify(rows, null, 2));

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.model}|${row.variant}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const avg = (list, pick) => (list.length ? list.reduce((sum, row) => sum + pick(row), 0) / list.length : 0);
  const lines = [
    "# Agent-mode benchmark: main vs feat/agent-mode-behaviour",
    "",
    "Task B on Flask 3.1.3 through the e2e suite (same suite for both builds). Generated by `node scripts/matrix.mjs --report-only`.",
    "",
    "| Model | Build | Runs | Task B passed | Files | Tool calls | Failed test runs | Untested edits at end | Verified finish | Input tokens | Cache hit | Seconds | Harness errors |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [key, list] of [...groups].sort()) {
    const [model, variant] = key.split("|");
    const ok = list.filter((row) => !row.harnessError);
    lines.push(
      `| ${model} | ${variant} | ${list.length} | ${ok.filter((r) => r.passed).length}/${ok.length} | ${avg(ok, (r) => r.filesChanged).toFixed(1)} | ${avg(ok, (r) => r.toolCalls).toFixed(1)} | ${avg(ok, (r) => r.failedTestRuns).toFixed(1)} | ${ok.filter((r) => r.untestedEdits).length}/${ok.length} | ${ok.filter((r) => r.verifiedFinish).length}/${ok.length} | ${Math.round(avg(ok, (r) => r.usage.input)).toLocaleString("en-US")} | ${Math.round(avg(ok, (r) => r.cacheHit) * 100)}% | ${avg(ok, (r) => r.seconds).toFixed(0)} | ${list.length - ok.length} |`,
    );
  }
  writeFileSync(join(root, "docs/benchmarks/agent-mode.md"), `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
}

if (args["report-only"] !== "true") run();
aggregate();
