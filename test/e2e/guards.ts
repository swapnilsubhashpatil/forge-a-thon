// End-to-end guard scenarios against the scripted fake model (scripts/fake-model.mjs), through the real extension,
// TrueForge and MCP tool server. Each scenario is scored on its own and the workspace is reset between them.
import { execSync } from "node:child_process";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import * as vscode from "vscode";
import type { Attachment, ChatState, Turn } from "../../src/shared/protocol.ts";

interface AnvilApi {
  ready: Promise<void>;
  sendPrompt(text: string, mentions: string[], attachments?: Attachment[]): Promise<void>;
  runInline(path: string, firstLine: number, lastLine: number, instruction: string): Promise<void>;
  runner: { cancel(): Promise<void>; resolveApproval(id: string, allow: boolean): void; busy: boolean };
  store: { state: ChatState };
  ledger: { undo(id: string): Promise<{ restored: string[]; skipped: string[] }> };
}

const HARNESS = "http://localhost:8790/api/v1";
const FAKE_PORT = process.env.FAKE_MODEL_PORT ?? "8799";
const MODEL = "fake/fake";
const root = () => vscode.workspace.workspaceFolders![0].uri;
const git = (command: string) => execSync(`git ${command}`, { cwd: root().fsPath, encoding: "utf8" }).trim();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const results: Record<string, { ok: boolean; detail?: string }> = {};

function turnsFor(api: AnvilApi, marker: string): Turn[] {
  const turns = api.store.state.turns;
  const start = turns.findIndex((turn) => turn.prompt.includes(marker));
  return start < 0 ? [] : turns.slice(start);
}

function textOf(turns: Turn[]): string {
  return turns.flatMap((turn) => turn.steps.map((step) => (step.kind === "text" ? step.text : step.kind === "notice" ? `[notice] ${step.text}` : ""))).join("\n");
}

function autoApprove(api: AnvilApi, acceptEdits = true): () => void {
  const timer = setInterval(() => {
    if (acceptEdits) {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.isDirty && editor.document.uri.scheme === "file") void vscode.commands.executeCommand("anvil.acceptAll", editor.document.uri);
      }
    }
    for (const turn of api.store.state.turns) {
      for (const step of turn.steps) if (step.kind === "approval" && step.status === "pending") api.runner.resolveApproval(step.toolCallId, true);
    }
  }, 500);
  return () => clearInterval(timer);
}

async function scenario(api: AnvilApi, name: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
    results[name] = { ok: true };
  } catch (error) {
    results[name] = { ok: false, detail: (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 400) };
    await api.runner.cancel().catch(() => undefined);
  }
  console.log(`${name}:`, JSON.stringify(results[name]));
  for (const set of api.store.state.changeSets.filter((entry) => !entry.undone)) await api.ledger.undo(set.id).catch(() => undefined);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  if (git("status --porcelain -- . :!.vscode") !== "") {
    git("checkout -- .");
    git("clean -fdq -e .vscode");
  }
}

async function registerFake(): Promise<void> {
  const response = await fetch(`${HARNESS}/settings/model-providers`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      manifest: {
        type: "custom",
        name: "fake",
        base_url: `http://127.0.0.1:${FAKE_PORT}/v1`,
        auth: { api_key: "fake" },
        models: [{ model_id: "fake", name: "fake", properties: { context_length: 65536, max_output_tokens: 4096 } }],
      },
    }),
  });
  assert.ok(response.ok, `register fake provider: ${response.status}`);
}

export async function run(): Promise<void> {
  const api = await vscode.extensions.getExtension<AnvilApi>("anvil-forge.anvil")!.activate();
  await api.ready;
  assert.equal(api.store.state.harness.state, "ready");
  await registerFake();
  const settings = vscode.workspace.getConfiguration("anvil");
  await settings.update("models.chain", [MODEL], vscode.ConfigurationTarget.Workspace);
  await settings.update("models.reasoningEffort", "none", vscode.ConfigurationTarget.Workspace);
  await settings.update("agent.promptProfile", "full", vscode.ConfigurationTarget.Workspace);

  // G3 + G2 (agent): an edit calling a function that exists nowhere, on lines never read.
  await scenario(api, "G3 grounding + G2 unread lines", async () => {
    const stop = autoApprove(api);
    try {
      await api.sendPrompt("SCENARIO=grounding add a secrets check", []);
    } finally {
      stop();
    }
    const out = textOf(turnsFor(api, "SCENARIO=grounding"));
    assert.match(out, /GROUNDING_SEEN SCOPE_SEEN/, `model did not receive both warnings: ${out.slice(0, 300)}`);
  });

  // G2 (inline): selection is get_debug_flag, the edit lands in get_load_dotenv.
  await scenario(api, "G2 outside selection (inline)", async () => {
    const stop = autoApprove(api);
    try {
      await api.runInline("src/flask/helpers.py", 27, 32, "SCENARIO=scope tidy this function");
    } finally {
      stop();
    }
    const out = textOf(turnsFor(api, "SCENARIO=scope"));
    assert.match(out, /SCOPE_SEEN/, `no outside-selection warning: ${out.slice(0, 300)}`);
  });

  // M7: identical read forever -> nudge at 3, stop at 5, tree clean.
  await scenario(api, "M7 loop guard", async () => {
    await api.sendPrompt("SCENARIO=loop look around", []);
    const turns = turnsFor(api, "SCENARIO=loop");
    const out = textOf(turns);
    assert.match(out, /Loop detected/, "no loop nudge");
    assert.match(out, /Stopped: the agent repeated/, "loop not stopped");
    assert.equal(turns[0].status, "cancelled");
    assert.equal(git("status --porcelain -- . :!.vscode"), "");
  });

  // M8: edit then "done" without verifying -> exactly one follow-up -> test -> verified finish.
  await scenario(api, "M8 early stop follow-up", async () => {
    const stop = autoApprove(api);
    try {
      await api.sendPrompt("SCENARIO=earlystop reword the debug flag docstring", []);
    } finally {
      stop();
    }
    const turns = turnsFor(api, "SCENARIO=earlystop");
    const followUps = turns.filter((turn) => turn.followUp);
    assert.equal(followUps.length, 1, `follow-ups: ${followUps.length}`);
    assert.equal(followUps[0].finish?.verified, true, `finish: ${JSON.stringify(followUps[0].finish)}`);
  });

  // M3: two hunks, reject the first, accept the second -> model gets the new baseline and current text.
  await scenario(api, "M3 partial rejection feedback", async () => {
    const approve = autoApprove(api, false);
    const pending = api.sendPrompt("SCENARIO=partial adjust get_debug_flag", []);
    const uri = vscode.Uri.joinPath(root(), "src", "flask", "helpers.py");
    let reviewed = false;
    for (let i = 0; i < 120 && !reviewed; i++) {
      await sleep(500);
      const editor = vscode.window.visibleTextEditors.find((candidate) => candidate.document.uri.toString() === uri.toString());
      if (editor?.document.isDirty) {
        await vscode.commands.executeCommand("anvil.rejectHunk", uri.toString(), 0);
        await vscode.commands.executeCommand("anvil.acceptHunk", uri.toString(), 1);
        reviewed = true;
      }
    }
    await pending;
    approve();
    assert.ok(reviewed, "review never opened");
    const out = textOf(turnsFor(api, "SCENARIO=partial"));
    assert.match(out, /BASELINE_SEEN/, `no baseline feedback: ${out.slice(0, 300)}`);
  });

  // M11: a message sent mid-turn is delivered with the next tool result.
  await scenario(api, "M11 mid-turn note delivered", async () => {
    const pending = api.sendPrompt("SCENARIO=note read a few things", []);
    await sleep(3500);
    assert.ok(api.runner.busy, "turn ended before the note could be queued");
    await api.sendPrompt("NOTE_PAYLOAD please also mention the docs", []);
    await pending;
    const turns = turnsFor(api, "SCENARIO=note");
    const out = textOf(turns);
    assert.match(out, /NOTE_SEEN/, `note not delivered in a tool result: ${out.slice(0, 300)}`);
    assert.ok(!turns.some((turn) => turn.prompt.startsWith("NOTE_PAYLOAD")), "note was sent as a separate turn instead of steering");
  });

  // M10: distinct calls until the iteration limit -> no failover, one wrap-up turn with a finish_task.
  await scenario(api, "M10 step-limit wrap-up", async () => {
    await settings.update("agent.iterationLimit", 5, vscode.ConfigurationTarget.Workspace);
    try {
      await api.sendPrompt("SCENARIO=limit search widely", []);
    } finally {
      await settings.update("agent.iterationLimit", undefined, vscode.ConfigurationTarget.Workspace);
    }
    const turns = turnsFor(api, "SCENARIO=limit");
    const out = textOf(turns);
    assert.match(out, /used all 5 steps/, `no step-limit notice: ${out.slice(0, 300)}`);
    assert.ok(!/Switched to/.test(out), "step limit caused a failover");
    const wrap = turns.find((turn) => turn.followUp);
    assert.ok(wrap, "no wrap-up turn");
    assert.equal(wrap.finish?.verified, false, `wrap-up finish: ${JSON.stringify(wrap.finish)}`);
  });

  // Attachments: the selection reaches the model ahead of the pack; the command itself runs.
  await scenario(api, "Selection attachment", async () => {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(root(), "src", "flask", "helpers.py"));
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(27, 0, 32, 0);
    await vscode.commands.executeCommand("anvil.addSelectionToChat");
    const attachment: Attachment = { id: "a1", kind: "selection", label: "helpers.py:28-32", path: "src/flask/helpers.py", startLine: 28, endLine: 32, text: document.getText(new vscode.Range(27, 0, 32, 0)) };
    await api.sendPrompt("SCENARIO=attach what does this do", [], [attachment]);
    const turns = turnsFor(api, "SCENARIO=attach");
    assert.match(textOf(turns), /ATTACH_SEEN/, "selection not in the request");
    assert.ok(turns[0].context?.attachments?.some((entry) => entry.label === "helpers.py:28-32"), "context card does not list the attachment");
  });

  // Ask about a selection: the lightbulb action and the hover link appear on selected code, and not without a selection.
  await scenario(api, "Ask-about-selection icon and hover", async () => {
    const uri = vscode.Uri.joinPath(root(), "src", "flask", "helpers.py");
    const editor = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
    const range = new vscode.Range(27, 0, 32, 10);
    editor.selection = new vscode.Selection(range.start, range.end);
    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>("vscode.executeCodeActionProvider", uri, range);
    assert.ok(actions.some((action) => action.title === "Ask Anvil about this"), `actions: ${actions.map((action) => action.title).join(", ")}`);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", uri, new vscode.Position(29, 6));
    const hoverText = hovers.flatMap((hover) => hover.contents.map((part) => (typeof part === "string" ? part : part.value))).join("\n");
    assert.match(hoverText, /Ask Anvil about this/, "no hover link on the selection");
    const empty = await vscode.commands.executeCommand<vscode.CodeAction[]>("vscode.executeCodeActionProvider", uri, new vscode.Range(29, 2, 29, 2));
    assert.ok(!empty.some((action) => action.title === "Ask Anvil about this"), "action shown without a selection");
  });

  // M2: the subagent's edit and test run are refused; a read-only git command is allowed.
  await scenario(api, "M2 read-only subagent", async () => {
    const stop = autoApprove(api);
    try {
      await api.sendPrompt("SCENARIO=subagent delegate an inspection", []);
    } finally {
      stop();
    }
    const out = textOf(turnsFor(api, "SCENARIO=subagent"));
    assert.match(out, /SUBAGENT_SEEN/, `subagent not restricted as expected: ${out.slice(0, 300)}`);
  });

  console.log("guards:", JSON.stringify(results));
  if (process.env.ANVIL_E2E_REPORT) writeFileSync(process.env.ANVIL_E2E_REPORT, JSON.stringify({ results, turns: api.store.state.turns }, null, 2));
}
