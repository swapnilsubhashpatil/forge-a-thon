import { execSync } from "node:child_process";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import * as vscode from "vscode";
import type { ChatState, Turn } from "../../src/shared/protocol.ts";

interface AnvilApi {
  ready: Promise<void>;
  sendPrompt(text: string, mentions: string[]): Promise<void>;
  runInline(path: string, firstLine: number, lastLine: number, instruction: string): Promise<void>;
  runner: { cancel(): Promise<void>; resolveApproval(id: string, allow: boolean): void };
  store: { state: ChatState };
  ledger: { undo(id: string): Promise<{ restored: string[]; skipped: string[] }> };
}

const TASK_A = "Treat the values 'off' and 'n' as false as well, case-insensitively, and update the docstring to list every value that is treated as false.";
const TASK_B = "Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as \"***\". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.";
const HARNESS = "http://localhost:8790/api/v1";
const PRIMARY = process.env.ANVIL_E2E_MODEL ?? "ollama/qwen3-8b";
const timings: Record<string, number> = {};

const root = () => vscode.workspace.workspaceFolders![0].uri;
const git = (command: string) => execSync(`git ${command}`, { cwd: root().fsPath, encoding: "utf8" }).trim();
const python = (code: string, env: Record<string, string>) =>
  execSync(`"${process.env.ANVIL_E2E_PYTHON ?? "python"}" -c "${code}"`, { cwd: root().fsPath, encoding: "utf8", env: { ...process.env, ...env, PYTHONPATH: `${root().fsPath}/src` } }).trim();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const lastTurn = (api: AnvilApi): Turn => api.store.state.turns[api.store.state.turns.length - 1];

function autoReview(api: AnvilApi): () => void {
  const timer = setInterval(() => {
    for (const document of vscode.workspace.textDocuments) {
      if (document.isDirty && document.uri.scheme === "file") void vscode.commands.executeCommand("anvil.acceptAll", document.uri);
    }
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.scheme === "anvil-proposal") void vscode.commands.executeCommand("anvil.acceptAll", editor.document.uri);
    }
    for (const turn of api.store.state.turns) {
      for (const step of turn.steps) {
        if (step.kind === "approval" && step.status === "pending") api.runner.resolveApproval(step.toolCallId, true);
      }
    }
  }, 1_000);
  return () => clearInterval(timer);
}

function describe(turn: Turn): string {
  return JSON.stringify({
    status: turn.status,
    model: turn.model,
    usage: turn.usage,
    context: turn.context?.files.slice(0, 6).map((file) => `${file.path}:${file.role}`),
    steps: turn.steps.map((step) => {
      if (step.kind === "tool") return `${step.name}:${step.status}${step.diff ? ` +${step.diff.added}-${step.diff.removed}` : ""}`;
      if (step.kind === "notice") return `notice:${step.tone}:${step.text}`;
      return "status" in step ? `${step.kind}:${step.status}` : step.kind;
    }),
  }, null, 2);
}

async function timed<T>(label: string, action: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await action();
  } finally {
    timings[label] = Date.now() - started;
  }
}

async function registerBrokenProvider(): Promise<void> {
  const response = await fetch(`${HARNESS}/settings/model-providers`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      manifest: {
        type: "custom",
        name: "broken",
        baseUrl: "http://127.0.0.1:9/v1",
        auth: { apiKey: "invalid" },
        models: [{ modelId: "unreachable", name: "unreachable", properties: { contextLength: 32768, maxOutputTokens: 4096 } }],
      },
    }),
  });
  assert.ok(response.ok, `register broken provider: ${response.status}`);
}

async function useChain(chain: string[]): Promise<void> {
  await vscode.workspace.getConfiguration("anvil").update("models.chain", chain, vscode.ConfigurationTarget.Workspace);
}

async function taskA(api: AnvilApi, label: string): Promise<Turn> {
  const stop = autoReview(api);
  try {
    await timed(label, () => api.runInline("src/flask/helpers.py", 27, 32, TASK_A));
  } finally {
    stop();
  }
  const turn = lastTurn(api);
  console.log(`${label}:`, describe(turn));
  assert.equal(turn.status, "done");
  assert.equal(python("from flask.helpers import get_debug_flag; print(get_debug_flag())", { FLASK_DEBUG: "off" }), "False");
  assert.equal(python("from flask.helpers import get_debug_flag; print(get_debug_flag())", { FLASK_DEBUG: "N" }), "False");
  assert.equal(python("from flask.helpers import get_debug_flag; print(get_debug_flag())", { FLASK_DEBUG: "1" }), "True");
  return turn;
}

async function undoAll(api: AnvilApi): Promise<void> {
  for (const changeSet of api.store.state.changeSets.filter((set) => !set.undone)) await api.ledger.undo(changeSet.id);
  assert.equal(git("status --porcelain"), "", "undo restores a clean tree");
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<AnvilApi>("anvil-forge.anvil")!;
  const api = await extension.activate();
  await api.ready;
  assert.equal(api.store.state.harness.state, "ready", `harness: ${JSON.stringify(api.store.state.harness)}`);

  await useChain([PRIMARY]);
  await taskA(api, "taskA");
  await undoAll(api);

  await registerBrokenProvider();
  await useChain(["broken/unreachable", PRIMARY]);
  const failover = await taskA(api, "taskC");
  assert.ok(failover.steps.some((step) => step.kind === "notice" && step.tone === "warning" && step.text.includes("Switched to")), "failover notice shown");
  assert.equal(failover.model, PRIMARY);
  await undoAll(api);
  await useChain([PRIMARY]);

  const pending = api.sendPrompt("Explain how the Flask CLI locates the application and suggest one improvement to src/flask/cli.py with a propose_edit call.", []);
  await sleep(6_000);
  await timed("cancel", () => api.runner.cancel());
  await pending;
  console.log("cancel:", describe(lastTurn(api)));
  assert.equal(lastTurn(api).status, "cancelled");
  assert.equal(git("status --porcelain"), "", "cancel leaves the tree clean");

  if (process.env.ANVIL_E2E_TASK_B === "1") {
    const stop = autoReview(api);
    try {
      await timed("taskB", () => api.sendPrompt(TASK_B, []));
    } finally {
      stop();
    }
    console.log("taskB:", describe(lastTurn(api)));
    console.log(git("diff --stat"));
  }

  console.log("timings:", JSON.stringify(timings));
  if (process.env.ANVIL_E2E_REPORT) writeFileSync(process.env.ANVIL_E2E_REPORT, JSON.stringify({ model: PRIMARY, timings, turns: api.store.state.turns }, null, 2));
}
