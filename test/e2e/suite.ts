import { execSync } from "node:child_process";
import assert from "node:assert/strict";
import * as vscode from "vscode";
import type { ChatState } from "../../src/shared/protocol.ts";

interface AnvilApi {
  ready: Promise<void>;
  sendPrompt(text: string, mentions: string[]): Promise<void>;
  runner: { cancel(): Promise<void>; resolveApproval(id: string, allow: boolean): void };
  store: { state: ChatState };
  ledger: { undo(id: string): Promise<{ restored: string[]; skipped: string[] }> };
}

const root = () => vscode.workspace.workspaceFolders![0].uri;
const git = (command: string) => execSync(`git ${command}`, { cwd: root().fsPath, encoding: "utf8" }).trim();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function autoReview(api: AnvilApi): () => void {
  const timer = setInterval(() => {
    for (const document of vscode.workspace.textDocuments) {
      if (document.isDirty && document.uri.scheme === "file") void vscode.commands.executeCommand("anvil.acceptAll", document.uri);
    }
    for (const turn of api.store.state.turns) {
      for (const step of turn.steps) {
        if (step.kind === "approval" && step.status === "pending") api.runner.resolveApproval(step.toolCallId, true);
      }
    }
  }, 1_000);
  return () => clearInterval(timer);
}

function report(state: ChatState): string {
  const turn = state.turns[state.turns.length - 1];
  return JSON.stringify({
    status: turn?.status,
    model: turn?.model,
    context: turn?.context?.files.map((file) => `${file.path}:${file.role}`),
    steps: turn?.steps.map((step) => step.kind === "tool" ? `${step.name}:${step.status}` : `${step.kind}${"status" in step ? `:${step.status}` : ""}${step.kind === "notice" ? `:${step.text}` : ""}`),
  }, null, 2);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<AnvilApi>("anvil-forge.anvil")!;
  const api = await extension.activate();
  await api.ready;
  assert.equal(api.store.state.harness.state, "ready", `harness: ${JSON.stringify(api.store.state.harness)}`);
  console.log("models:", api.store.state.models.map((model) => model.model).join(", "));

  const stop = autoReview(api);
  try {
    await api.sendPrompt("In src/flask/helpers.py, change get_debug_flag so that the value \"off\" is also treated as false, like \"0\", \"false\" and \"no\". Make one propose_edit call.", []);
  } finally {
    stop();
  }
  console.log("edit turn:", report(api.store.state));
  const editTurn = api.store.state.turns.at(-1)!;
  assert.equal(editTurn.status, "done");
  const diff = git("diff -- src/flask/helpers.py");
  console.log(diff);
  assert.match(diff, /off/);
  const changeSet = api.store.state.changeSets[0];
  assert.ok(changeSet, "change set recorded");
  const undo = await api.ledger.undo(changeSet.id);
  console.log("undo:", JSON.stringify(undo));
  assert.equal(git("status --porcelain"), "", "undo restores a clean tree");

  const pending = api.sendPrompt("Explain how the Flask CLI finds the application, then propose any small improvement to src/flask/cli.py.", []);
  await sleep(4_000);
  await api.runner.cancel();
  await pending;
  console.log("cancel turn:", report(api.store.state));
  assert.equal(api.store.state.turns.at(-1)!.status, "cancelled");
  assert.equal(git("status --porcelain"), "", "cancel leaves the tree clean");
}
