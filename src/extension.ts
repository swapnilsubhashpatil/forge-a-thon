import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { userInfo } from "node:os";
import { join } from "node:path";
import * as vscode from "vscode";
import { AgentProfiles, type PromptProfile } from "./agent/agentProfile.ts";
import { ConversationStore } from "./agent/conversationStore.ts";
import { EditCoordinator } from "./agent/editCoordinator.ts";
import { FINISH_FOLLOW_UP, RETRY_EDITS_FOLLOW_UP, WRAP_UP } from "./agent/finishGate.ts";
import { CircuitBreaker } from "./agent/resilience.ts";
import { SessionHistory } from "./agent/sessionHistory.ts";
import { TurnRunner, type RunnerSettings } from "./agent/turnRunner.ts";
import { formatAttachments } from "./context/attachments.ts";
import { findRipgrep } from "./context/codeSearch.ts";
import { buildContextPack } from "./context/contextPack.ts";
import { loadProjectRules } from "./context/projectRules.ts";
import { rankFiles } from "./context/ranker.ts";
import { detectTestCommand, pythonSrcLayout } from "./context/testCommand.ts";
import { WorkspaceIndex } from "./context/workspaceIndex.ts";
import { ChangeLedger } from "./edits/changeLedger.ts";
import { definedNames, ungroundedNames } from "./edits/grounding.ts";
import { ReviewController } from "./edits/reviewController.ts";
import { HarnessClient } from "./harness/harnessClient.ts";
import { HarnessProcess } from "./harness/harnessProcess.ts";
import type { AgentMode, Attachment, ReviewMode } from "./shared/protocol.ts";
import { createEditorTools, ReadCache } from "./tools/editorTools.ts";
import { startToolServer, type RunningToolServer } from "./tools/toolServer.ts";
import { registerAskSelection } from "./ui/askSelection.ts";
import { registerAttachCommands } from "./ui/attachCommands.ts";
import { ChatViewProvider } from "./ui/chatViewProvider.ts";
import { inlineRequest, runInlineEdit } from "./ui/inlineEdit.ts";
import { MessageRouter, readSettings, SNAPSHOT_SCHEME } from "./ui/messageRouter.ts";

const FOLDER_COMMANDS = [
  "anvil.inlineEdit",
  "anvil.newSession",
  "anvil.cancel",
  "anvil.undoLastChange",
  "anvil.openSessionInHarness",
  "anvil.selectModels",
  "anvil.restartHarness",
  "anvil.keepAll",
  "anvil.discardAll",
  "anvil.showHistory",
  "anvil.showSettings",
];

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Anvil", { log: true });
  const log = (line: string) => output.info(line);
  const folder = vscode.workspace.workspaceFolders?.[0];
  const config = () => vscode.workspace.getConfiguration("anvil");

  let client = new HarnessClient(config().get<string>("harness.url", "http://localhost:8790"));
  const store = new ConversationStore(client.baseUrl, readSettings());
  const harnessProcess = new HarnessProcess(join(context.globalStorageUri.fsPath, "trueforge"), (line) => output.trace(line));
  const ledgerFile = context.storageUri && join(context.storageUri.fsPath, "change-ledger.json");
  const ledger = new ChangeLedger((sets) => store.update((state) => {
    state.changeSets = sets;
  }), ledgerFile);
  const review = new ReviewController(ledger);
  const breaker = new CircuitBreaker();
  const readCache = new ReadCache();
  let availableModels: string[] = [];

  const toolServerName = `anvil-editor-${createHash("sha1").update(folder?.uri.toString() ?? "none").digest("hex").slice(0, 8)}`;
  const modelChain = () => {
    const configured = config().get<string[]>("models.chain", []).filter(Boolean);
    return configured.length ? configured : availableModels.slice(0, 3);
  };
  const settings = (): RunnerSettings => {
    const reasoningEffort = config().get<string>("models.reasoningEffort", "default");
    return {
      modelChain: modelChain(),
      firstEventTimeoutMs: config().get<number>("resilience.firstEventTimeoutSeconds", 45) * 1000,
      iterationLimit: config().get<number>("agent.iterationLimit", 60),
      reasoningEffort: reasoningEffort === "default" ? undefined : reasoningEffort,
      promptProfile: config().get<PromptProfile>("agent.promptProfile", "auto"),
      toolServerName,
      autoApprove: config().get<string[]>("commands.autoApprove", []),
    };
  };

  let router: MessageRouter | undefined;
  const chatView = new ChatViewProvider(context.extensionUri, (message, reply) => {
    if (router) void router.handle(message, reply);
    else if (message.type !== "ready") void vscode.window.showInformationMessage("Open a folder to use Anvil.");
  });
  context.subscriptions.push(
    output,
    review,
    chatView,
    { dispose: () => harnessProcess.dispose() },
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, chatView, { webviewOptions: { retainContextWhenHidden: true } }),
    review.onDidChangeState(() => store.update((state) => {
      state.pendingReviews = review.pending();
    })),
  );
  store.subscribe((state) => chatView.pushState(state));

  if (!folder) {
    store.update((state) => {
      state.harness = { state: "offline", url: client.baseUrl, message: "Open a folder to use Anvil." };
    });
    const needsFolder = () => void vscode.window.showInformationMessage("Open a folder to use Anvil.");
    for (const command of FOLDER_COMMANDS) context.subscriptions.push(vscode.commands.registerCommand(command, needsFolder));
    return;
  }

  void ledger.load();
  const index = new WorkspaceIndex(folder.uri.fsPath);
  const edits = new EditCoordinator(folder.uri, review, (path) => runner.noteFileEdited(path));
  edits.reviewMode = () => config().get<ReviewMode>("review.mode", "review");
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
    onBusyChange: (busy) => {
      void vscode.commands.executeCommand("setContext", "anvil.turnRunning", busy);
      if (!busy) void router?.persist();
    },
  });
  edits.fenceFor = (path) => runner.fenceFor(path);
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

  execFile("git", ["config", "user.name"], { cwd: folder.uri.fsPath }, (_error, stdout) => {
    const user = (stdout.trim() || userInfo().username).split(/\s+/)[0];
    store.update((state) => {
      state.workspace = { name: folder.name, files: state.workspace?.files ?? 0, user };
    });
  });

  let toolServer: RunningToolServer | undefined;
  const indexReady = index.build().then(
    () => {
      log(`Indexed ${index.files().length} files`);
      store.update((state) => {
        state.workspace = { ...state.workspace, name: folder.name, files: index.files().length };
      });
    },
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
      const mcpServers = await client.listMcpServers().catch(() => []);
      store.update((state) => {
        state.availableModels = availableModels;
        state.mcpServers = mcpServers.filter((name) => !name.startsWith("anvil-editor-"));
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

  const sendPrompt = async (text: string, mentions: string[], attachments: Attachment[] = [], mode: AgentMode = "agent"): Promise<void> => {
    if (runner.busy) {
      runner.queueNote(`${formatAttachments(attachments).text}${text}`, mentions);
      return;
    }
    runner.markStarting(true);
    try {
      await runTurn(text, mentions, attachments, mode);
    } finally {
      runner.markStarting(false);
    }
    await followUp(mode);
    await flushQueue();
  };

  const followUp = async (mode: AgentMode) => {
    const request = { mode, mentions: [], followUp: true };
    if (runner.takeWrapUp()) {
      await runner.run({ ...request, title: "Wrap up", prompt: "Anvil: wrap up at the step limit", message: WRAP_UP });
      return;
    }
    const kind = runner.needsFinishFollowUp();
    if (kind === "verify") {
      await runner.run({ ...request, title: "Verify and finish", prompt: "Anvil: verify and finish", message: FINISH_FOLLOW_UP });
    } else if (kind === "retry-edits") {
      await runner.run({ ...request, title: "Retry edits", prompt: "Anvil: edits did not apply, retry or explain", message: RETRY_EDITS_FOLLOW_UP });
    }
  };

  const flushQueue = async (): Promise<void> => {
    if (runner.busy || store.state.turns.at(-1)?.status === "cancelled") return;
    const leftovers = runner.takeLeftovers();
    if (leftovers) await sendPrompt(leftovers.text, leftovers.mentions, [], store.state.mode);
  };

  const runTurn = async (text: string, mentions: string[], attachments: Attachment[], mode: AgentMode) => {
    await indexReady;
    const mentionPaths = [...new Set(mentions.map((mention) => mention.split("#")[0]).filter((path) => index.get(path)))];
    const activeFiles = vscode.window.visibleTextEditors
      .map((editor) => vscode.workspace.asRelativePath(editor.document.uri, false).replaceAll("\\", "/"))
      .filter((path) => index.get(path));
    const ranked = rankFiles(index, { text, mentions: mentionPaths, activeFiles });
    const targets = ranked.filter((file) => file.role !== "reference").map((file) => file.path);
    const verify = detectTestCommand(folder.uri.fsPath, index.files().map((file) => file.path), targets);
    const pack = await buildContextPack(index, ranked, config().get<number>("context.budgetTokens", 6000), verify, loadProjectRules(folder.uri.fsPath));
    const attached = formatAttachments(attachments);
    if (attachments.length) {
      pack.report.attachments = attachments.map((attachment) => ({ label: attachment.label, kind: attachment.kind, tokens: Math.round(attached.tokens / attachments.length) }));
    }
    await runner.run({
      mode,
      title: text.slice(0, 80),
      prompt: text,
      mentions,
      message: `${attached.text}${pack.text}\n\n${text}`,
      attachments,
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

  const messages = new MessageRouter({
    folder: folder.uri,
    store,
    runner,
    ledger,
    review,
    history: new SessionHistory(context.workspaceState),
    index,
    indexReady,
    readCache,
    modelChain,
    send: sendPrompt,
    connect,
    configureModels,
    log,
  });
  router = messages;
  const route = (message: Parameters<MessageRouter["handle"]>[0]) => messages.handle(message, () => undefined);

  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "**/*"));
  const relative = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false).replaceAll("\\", "/");
  const ignored = (uri: vscode.Uri) => /(^|\/)(\.git|node_modules|\.venv|venv|__pycache__|dist)(\/|$)/.test(relative(uri));
  const attach = (attachment: Attachment) => chatView.attach(attachment);
  context.subscriptions.push(
    watcher,
    watcher.onDidChange((uri) => !ignored(uri) && void index.refresh(relative(uri))),
    watcher.onDidCreate((uri) => !ignored(uri) && void index.refresh(relative(uri))),
    watcher.onDidDelete((uri) => !ignored(uri) && index.remove(relative(uri))),
    ...registerAttachCommands(folder.uri, attach),
    ...registerAskSelection(folder.uri, attach),
    vscode.workspace.registerTextDocumentContentProvider(SNAPSHOT_SCHEME, {
      provideTextDocumentContent: (uri) => ledger.before(uri.query, uri.path.slice(1)) ?? "",
    }),
    vscode.commands.registerCommand("anvil.inlineEdit", async () => {
      await runInlineEdit(runner, folder.uri);
      await flushQueue();
    }),
    vscode.commands.registerCommand("anvil.newSession", () => route({ type: "newSession" })),
    vscode.commands.registerCommand("anvil.cancel", () => runner.cancel()),
    vscode.commands.registerCommand("anvil.keepAll", () => route({ type: "keepAll" })),
    vscode.commands.registerCommand("anvil.discardAll", () => route({ type: "discardAll" })),
    vscode.commands.registerCommand("anvil.showHistory", () => chatView.show("history")),
    vscode.commands.registerCommand("anvil.showSettings", () => chatView.show("settings")),
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
      if (event.affectsConfiguration("anvil")) store.update((state) => {
        state.settings = readSettings();
      });
    }),
    { dispose: () => void toolServer?.close() },
    { dispose: () => void client.unregisterToolServer(toolServerName).catch(() => undefined) },
  );

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
