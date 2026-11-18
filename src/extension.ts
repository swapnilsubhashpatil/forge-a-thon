import { createHash } from "node:crypto";
import { join } from "node:path";
import * as vscode from "vscode";
import { AgentProfiles, type PromptProfile } from "./agent/agentProfile.ts";
import { ConversationStore } from "./agent/conversationStore.ts";
import { EditCoordinator } from "./agent/editCoordinator.ts";
import { CircuitBreaker } from "./agent/resilience.ts";
import { TurnRunner, type RunnerSettings } from "./agent/turnRunner.ts";
import { findRipgrep, mentionCandidates } from "./context/codeSearch.ts";
import { buildContextPack } from "./context/contextPack.ts";
import { formatAttachments } from "./context/attachments.ts";
import { registerAttachCommands } from "./ui/attachCommands.ts";
import { detectTestCommand, pythonSrcLayout } from "./context/testCommand.ts";
import { FINISH_FOLLOW_UP, RETRY_EDITS_FOLLOW_UP, WRAP_UP } from "./agent/finishGate.ts";
import { definedNames, ungroundedNames } from "./edits/grounding.ts";
import { rankFiles } from "./context/ranker.ts";
import { WorkspaceIndex } from "./context/workspaceIndex.ts";
import { ChangeLedger } from "./edits/changeLedger.ts";
import { ReviewController } from "./edits/reviewController.ts";
import { HarnessClient } from "./harness/harnessClient.ts";
import { HarnessProcess } from "./harness/harnessProcess.ts";
import type { Attachment, HostMessage, WebviewMessage } from "./shared/protocol.ts";
import { createEditorTools, ReadCache } from "./tools/editorTools.ts";
import { startToolServer, type RunningToolServer } from "./tools/toolServer.ts";
import { ChatViewProvider } from "./ui/chatViewProvider.ts";
import { inlineRequest, runInlineEdit } from "./ui/inlineEdit.ts";

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Anvil", { log: true });
  const log = (line: string) => output.info(line);
  const folder = vscode.workspace.workspaceFolders?.[0];
  const config = () => vscode.workspace.getConfiguration("anvil");

  let client = new HarnessClient(config().get<string>("harness.url", "http://localhost:8790"));
  const store = new ConversationStore(client.baseUrl);
  const harnessProcess = new HarnessProcess(join(context.globalStorageUri.fsPath, "trueforge"), (line) => output.trace(line));
  const ledger = new ChangeLedger((sets) => store.update((state) => {
    state.changeSets = sets;
  }));
  const review = new ReviewController(ledger);
  const breaker = new CircuitBreaker();
  const readCache = new ReadCache();
  let availableModels: string[] = [];

  const toolServerName = `anvil-editor-${createHash("sha1").update(folder?.uri.toString() ?? "none").digest("hex").slice(0, 8)}`;
  const settings = (): RunnerSettings => {
    const configured = config().get<string[]>("models.chain", []).filter(Boolean);
    const reasoningEffort = config().get<string>("models.reasoningEffort", "default");
    return {
      modelChain: configured.length ? configured : availableModels.slice(0, 3),
      firstEventTimeoutMs: config().get<number>("resilience.firstEventTimeoutSeconds", 45) * 1000,
      iterationLimit: config().get<number>("agent.iterationLimit", 60),
      reasoningEffort: reasoningEffort === "default" ? undefined : reasoningEffort,
      promptProfile: config().get<PromptProfile>("agent.promptProfile", "auto"),
      toolServerName,
    };
  };

  let started = false;
  const chatView = new ChatViewProvider(context.extensionUri, (message, reply) => {
    if (started) void handleMessage(message, reply);
    else if (message.type !== "ready") void vscode.window.showInformationMessage("Open a folder to use Anvil.");
  });
  context.subscriptions.push(
    output,
    review,
    chatView,
    { dispose: () => harnessProcess.dispose() },
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, chatView, { webviewOptions: { retainContextWhenHidden: true } }),
  );
  store.subscribe((state) => chatView.pushState(state));

  if (!folder) {
    store.update((state) => {
      state.harness = { state: "offline", url: client.baseUrl, message: "Open a folder to use Anvil." };
    });
    const needsFolder = () => void vscode.window.showInformationMessage("Open a folder to use Anvil.");
    for (const command of ["anvil.inlineEdit", "anvil.newSession", "anvil.cancel", "anvil.undoLastChange", "anvil.openSessionInHarness", "anvil.selectModels", "anvil.restartHarness"]) {
      context.subscriptions.push(vscode.commands.registerCommand(command, needsFolder));
    }
    return;
  }

  const index = new WorkspaceIndex(folder.uri.fsPath);
  // The callback runs only after a review is accepted, long after `runner` below is initialised.
  const edits = new EditCoordinator(folder.uri, review, (path) => runner.noteFileEdited(path));
  const runner = new TurnRunner({
    client: () => client,
    store,
    profiles: new AgentProfiles(context.extensionPath),
    breaker,
    edits,
    ledger,
    review,
    settings,
    log,
    onBusyChange: (busy) => void vscode.commands.executeCommand("setContext", "anvil.turnRunning", busy),
  });
  edits.fenceFor = (path) => runner.fenceFor(path);
  // G3: names proposed earlier this session count as known (a test may import a function another hunk just added).
  const proposedNames = new Set<string>();
  edits.groundingFor = (path) => {
    if (!path.endsWith(".py")) return undefined;
    return (added, proposal) => {
      const missing = ungroundedNames(added, proposal, {
        knownIdentifier: (name) => proposedNames.has(name) || index.identifiers().has(name),
        moduleText: (module) => index.moduleText(module),
      });
      for (const name of definedNames(proposal)) proposedNames.add(name);
      return missing;
    };
  };

  let toolServer: RunningToolServer | undefined;
  const indexReady = index.build().then(
    () => log(`Indexed ${index.files().length} files`),
    (error: unknown) => log(`Indexing failed: ${String(error)}`),
  );

  const connect = async () => {
    client = new HarnessClient(config().get<string>("harness.url", "http://localhost:8790"));
    store.update((state) => {
      state.harness = { state: "connecting", url: client.baseUrl };
    });
    try {
      const startingTimer = setTimeout(() => store.update((state) => {
        state.harness = { state: "starting", url: client.baseUrl, message: "Starting a local TrueForge server…" };
      }), 2_000);
      await harnessProcess.ensure(client, config().get<boolean>("harness.autoStart", true)).finally(() => clearTimeout(startingTimer));
      toolServer ??= await startToolServer(createEditorTools({
        index,
        rgPath: findRipgrep(vscode.env.appRoot),
        edits,
        commandTimeoutMs: () => config().get<number>("commands.timeoutSeconds", 120) * 1000,
        commandEnv: (): Record<string, string> => (!process.env.PYTHONPATH && pythonSrcLayout(folder.uri.fsPath) ? { PYTHONPATH: "src" } : {}),
        currentContext: () => runner.currentContext(),
        onFileRead: (path, start, end) => runner.noteFileRead(path, start, end),
        onCommandOutput: (command, text) => output.info(`$ ${command}\n${text}`),
        onCommandResult: (command, exitCode) => runner.noteCommand(command, exitCode),
        finishTask: (args) => runner.finishTask(args),
        updatePlan: (plan) => runner.updatePlan(plan),
      }, readCache), log, (name, args, result) => runner.decorateToolResult(name, args, result));
      await client.registerToolServer(toolServerName, toolServer.url, toolServer.token);
      availableModels = await client.listModels().catch(() => []);
      store.update((state) => {
        state.harness = { state: "ready", url: client.baseUrl };
      });
      runner.refreshModelHealth();
      if (!settings().modelChain.length) {
        void vscode.window.showWarningMessage("Anvil: no models found in TrueForge. Add a model provider in TrueForge, then configure the fallback chain.", "Open TrueForge").then((choice) => {
          if (choice) void vscode.env.openExternal(vscode.Uri.parse(`${client.baseUrl}/settings`));
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Harness connection failed: ${message}`);
      store.update((state) => {
        state.harness = { state: "offline", url: client.baseUrl, message };
      });
    }
  };

  const sendPrompt = async (text: string, mentions: string[], attachments: Attachment[] = []): Promise<void> => {
    // While a turn runs, a new message is queued and delivered at the next tool step (M11), never cancelling work.
    if (runner.busy) {
      runner.queueNote(`${formatAttachments(attachments).text}${text}`, mentions);
      return;
    }
    runner.markStarting(true);
    try {
      await runTurn(text, mentions, attachments);
    } finally {
      runner.markStarting(false);
    }
    // M8: edits accepted but the agent stopped without finish_task -> exactly one follow-up on the same session.
    if (runner.takeWrapUp()) {
      await runner.run({ mode: "agent", title: "Wrap up", prompt: "Anvil: wrap up at the step limit", mentions: [], message: WRAP_UP, followUp: true });
    } else {
      const followUp = runner.needsFinishFollowUp();
      if (followUp === "verify") {
        await runner.run({ mode: "agent", title: "Verify and finish", prompt: "Anvil: verify and finish", mentions: [], message: FINISH_FOLLOW_UP, followUp: true });
      } else if (followUp === "retry-edits") {
        await runner.run({ mode: "agent", title: "Retry edits", prompt: "Anvil: edits did not apply, retry or explain", mentions: [], message: RETRY_EDITS_FOLLOW_UP, followUp: true });
      }
    }
    await flushQueue();
  };

  // Messages the agent never saw become the next turn, so nothing typed during a run is lost. After a plain Stop
  // they stay queued as chips: the user stopped on purpose and decides what to send.
  const flushQueue = async (): Promise<void> => {
    if (runner.busy || store.state.turns.at(-1)?.status === "cancelled") return;
    const leftovers = runner.takeLeftovers();
    if (leftovers) await sendPrompt(leftovers.text, leftovers.mentions);
  };

  const stopAndSend = async (id: string) => {
    const note = runner.takeNote(id);
    if (!note) return;
    if (runner.busy) {
      runner.queueNote(note.text, note.mentions);
      const queued = store.state.queue.at(-1);
      await runner.cancel({ superseded: true });
      // The running sendPrompt sends leftovers once the cancelled turn unwinds; make this note go first.
      if (queued) store.update((state) => {
        state.queue = [queued, ...state.queue.filter((entry) => entry !== queued)];
      });
      return;
    }
    await sendPrompt(note.text, note.mentions);
  };

  const runTurn = async (text: string, mentions: string[], attachments: Attachment[] = []) => {
    await indexReady;
    const mentionPaths = [...new Set(mentions.map((mention) => mention.split("#")[0]).filter((path) => index.get(path)))];
    const activeFiles = vscode.window.visibleTextEditors
      .map((editor) => vscode.workspace.asRelativePath(editor.document.uri, false).replaceAll("\\", "/"))
      .filter((path) => index.get(path));
    const ranked = rankFiles(index, { text, mentions: mentionPaths, activeFiles });
    const targets = ranked.filter((file) => file.role !== "reference").map((file) => file.path);
    const verify = detectTestCommand(folder.uri.fsPath, index.files().map((file) => file.path), targets);
    const pack = await buildContextPack(index, ranked, config().get<number>("context.budgetTokens", 6000), verify);
    // What the user explicitly sent goes first, with its own budget (see attachments.ts).
    const attached = formatAttachments(attachments);
    if (attachments.length) {
      pack.report.attachments = attachments.map((attachment) => ({ label: attachment.label, kind: attachment.kind, tokens: Math.round(attached.tokens / attachments.length) }));
    }
    await runner.run({
      mode: "agent",
      title: text.slice(0, 80),
      prompt: text,
      mentions,
      message: `${attached.text}${pack.text}\n\n${text}`,
      context: pack.report,
    });
  };

  const configureModels = async () => {
    const models = await client.listModels().catch(() => availableModels);
    if (!models.length) {
      void vscode.window.showWarningMessage("No models are configured in TrueForge yet. Add a provider under Settings → Models.");
      return;
    }
    const current = settings().modelChain;
    const picks = await vscode.window.showQuickPick(
      [...current.filter((model) => models.includes(model)), ...models.filter((model) => !current.includes(model))].map((model) => ({
        label: model,
        picked: current.includes(model),
      })),
      { canPickMany: true, title: "Anvil · Model fallback chain", placeHolder: "Select models in priority order: primary first" },
    );
    if (!picks?.length) return;
    const chain = await orderModels(picks.map((pick) => pick.label));
    if (!chain) return;
    await config().update("models.chain", chain, vscode.ConfigurationTarget.Global);
    runner.refreshModelHealth();
  };

  async function handleMessage(message: WebviewMessage, reply: (message: HostMessage) => void): Promise<void> {
    switch (message.type) {
      case "ready":
        runner.refreshModelHealth();
        break;
      case "send":
        await sendPrompt(message.text, message.mentions, message.attachments ?? []).catch((error: unknown) => log(`Turn failed: ${String(error)}`));
        break;
      case "cancel":
        await runner.cancel();
        break;
      case "restore": {
        try {
          const result = await runner.restoreTo(message.turnId, message.withCode);
          if (result) reply({ type: "setDraft", text: result.prompt, mentions: result.mentions });
        } catch (error) {
          void vscode.window.showWarningMessage(`Anvil: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;
      }
      case "undoTurn": {
        const result = await runner.undoTurn(message.turnId);
        if (result.skipped.length) void vscode.window.showWarningMessage(`Anvil: not undone because they were edited since: ${result.skipped.join(", ")}`);
        break;
      }
      case "removeNote":
        runner.removeNote(message.id);
        break;
      case "stopAndSend":
        await stopAndSend(message.id).catch((error: unknown) => log(`Stop and send failed: ${String(error)}`));
        break;
      case "newSession":
        await runner.cancel();
        readCache.clear();
        runner.resetSession();
        break;
      case "approve":
        runner.resolveApproval(message.toolCallId, message.allow);
        break;
      case "openFile": {
        const relativePath = message.path.replaceAll("\\", "/").replace(/^\.\//, "");
        try {
          const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder!.uri, ...relativePath.split("/")));
          const line = Math.max(0, (message.line ?? 1) - 1);
          await vscode.window.showTextDocument(document, { selection: new vscode.Range(line, 0, line, 0), preview: true });
        } catch {
          void vscode.window.showWarningMessage(`Cannot open ${relativePath}`);
        }
        break;
      }
      case "undo": {
        const result = await ledger.undo(message.changeSetId);
        if (result.skipped.length) {
          void vscode.window.showWarningMessage(`Undo skipped ${result.skipped.join(", ")} because they changed after the agent edit.`);
        }
        break;
      }
      case "searchMentions":
        await indexReady;
        reply({ type: "mentionResults", requestId: message.requestId, items: mentionCandidates(index, message.query, 12) });
        break;
      case "openSessionInHarness":
        await vscode.commands.executeCommand("anvil.openSessionInHarness");
        break;
      case "configureModels":
        await configureModels();
        break;
      case "reconnect":
        await connect();
        break;
    }
  }

  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "**/*"));
  const relative = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false).replaceAll("\\", "/");
  const ignored = (uri: vscode.Uri) => /(^|\/)(\.git|node_modules|\.venv|venv|__pycache__|dist)(\/|$)/.test(relative(uri));
  context.subscriptions.push(
    watcher,
    watcher.onDidChange((uri) => !ignored(uri) && void index.refresh(relative(uri))),
    watcher.onDidCreate((uri) => !ignored(uri) && void index.refresh(relative(uri))),
    watcher.onDidDelete((uri) => !ignored(uri) && index.remove(relative(uri))),
    ...registerAttachCommands(folder.uri, (attachment) => chatView.attach(attachment)),
    vscode.commands.registerCommand("anvil.inlineEdit", async () => {
      await runInlineEdit(runner, folder.uri);
      await flushQueue();
    }),
    vscode.commands.registerCommand("anvil.newSession", () => handleMessage({ type: "newSession" }, () => undefined)),
    vscode.commands.registerCommand("anvil.cancel", () => runner.cancel()),
    vscode.commands.registerCommand("anvil.undoLastChange", async () => {
      const result = await ledger.undoLast();
      if (!result) void vscode.window.showInformationMessage("No agent changes to undo.");
    }),
    vscode.commands.registerCommand("anvil.openSessionInHarness", () => {
      const url = store.state.sessionUrl ?? `${client.baseUrl}/sessions`;
      void vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    vscode.commands.registerCommand("anvil.selectModels", configureModels),
    vscode.commands.registerCommand("anvil.restartHarness", connect),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("anvil.harness.url")) void connect();
      if (event.affectsConfiguration("anvil.models.chain")) runner.refreshModelHealth();
    }),
    { dispose: () => void toolServer?.close() },
  );

  started = true;
  const ready = connect();
  const runInline = async (path: string, firstLine: number, lastLine: number, instruction: string) => {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, ...path.split("/")));
    await runner.run(inlineRequest(document, path, firstLine, lastLine, instruction));
  };
  return { ready, runner, store, sendPrompt, runInline, ledger };
}

async function orderModels(models: string[]): Promise<string[] | undefined> {
  if (models.length < 2) return models;
  const primary = await vscode.window.showQuickPick(models, { title: "Anvil · Primary model", placeHolder: "Which model should run first?" });
  if (!primary) return undefined;
  return [primary, ...models.filter((model) => model !== primary)];
}

export function deactivate(): void {}
