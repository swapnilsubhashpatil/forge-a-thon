import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import type { ConversationStore } from "../agent/conversationStore.ts";
import { conversationTitle, type SessionHistory } from "../agent/sessionHistory.ts";
import type { TurnRunner } from "../agent/turnRunner.ts";
import { imageBytes, MAX_IMAGE_BYTES } from "../context/attachments.ts";
import { mentionCandidates } from "../context/codeSearch.ts";
import type { WorkspaceIndex } from "../context/workspaceIndex.ts";
import type { ChangeLedger, UndoResult } from "../edits/changeLedger.ts";
import type { ReviewController } from "../edits/reviewController.ts";
import type { AgentMode, AnvilSettings, Attachment, HostMessage, MentionItem, WebviewMessage } from "../shared/protocol.ts";
import type { ReadCache } from "../tools/editorTools.ts";
import { inWorkspace } from "./attachCommands.ts";
import type { SelectionContext } from "./selectionContext.ts";
import type { SkillManager } from "./skillManager.ts";

export const SNAPSHOT_SCHEME = "anvil-snapshot";
const MENTION_LIMIT = 12;
const CONTINUE_PROMPT = "Continue from where you stopped.";

const SETTING_KEYS: Record<keyof AnvilSettings, string> = {
  chain: "models.chain",
  reasoningEffort: "models.reasoningEffort",
  reviewMode: "review.mode",
  autoApprove: "commands.autoApprove",
  budgetTokens: "context.budgetTokens",
};

export function readSettings(): AnvilSettings {
  const config = vscode.workspace.getConfiguration("anvil");
  return {
    chain: config.get<string[]>(SETTING_KEYS.chain, []).filter(Boolean),
    reasoningEffort: config.get<AnvilSettings["reasoningEffort"]>(SETTING_KEYS.reasoningEffort, "default"),
    reviewMode: config.get<AnvilSettings["reviewMode"]>(SETTING_KEYS.reviewMode, "review"),
    autoApprove: config.get<string[]>(SETTING_KEYS.autoApprove, []),
    budgetTokens: config.get<number>(SETTING_KEYS.budgetTokens, 6000),
  };
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const config = vscode.workspace.getConfiguration("anvil");
  const target = config.inspect(key)?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  await config.update(key, value, target);
}

export interface RouterDeps {
  folder: vscode.Uri;
  store: ConversationStore;
  runner: TurnRunner;
  ledger: ChangeLedger;
  review: ReviewController;
  history: SessionHistory;
  index: WorkspaceIndex;
  indexReady: Promise<void>;
  readCache: ReadCache;
  skills: SkillManager;
  selection: SelectionContext;
  modelChain: () => string[];
  send: (text: string, mentions: string[], attachments: Attachment[], mode: AgentMode) => Promise<void>;
  connect: () => Promise<void>;
  configureModels: () => Promise<void>;
  log: (line: string) => void;
}

export class MessageRouter {
  private readonly deps: RouterDeps;

  constructor(deps: RouterDeps) {
    this.deps = deps;
    deps.store.update((state) => {
      state.conversationId = randomUUID();
      state.history = deps.history.summaries();
    });
  }

  async handle(message: WebviewMessage, reply: (message: HostMessage) => void): Promise<void> {
    const { store, runner, ledger } = this.deps;
    switch (message.type) {
      case "ready":
        runner.refreshModelHealth();
        this.deps.skills.refresh();
        break;
      case "createSkill":
      case "toggleSkill":
      case "openSkill":
      case "deleteSkill":
        await this.deps.skills.handle(message);
        break;
      case "send":
        await this.send(message.text, message.mentions, await this.withLiveSelection(withinImageLimit(message.attachments ?? []), message.includeSelection), message.mode);
        break;
      case "pinSelection":
        await this.deps.selection.pin();
        break;
      case "dismissSelection":
        this.deps.selection.hide();
        break;
      case "continue":
        await this.send(CONTINUE_PROMPT, [], [], store.state.mode);
        break;
      case "retry":
        await this.retry(message.turnId);
        break;
      case "cancel":
        await runner.cancel();
        break;
      case "restore":
        await this.restore(message.turnId, message.scope, reply);
        break;
      case "undoTurn":
        warnSkipped(await runner.undoTurn(message.turnId));
        break;
      case "undo":
        warnSkipped(await ledger.undo(message.changeSetId));
        break;
      case "setMode":
        store.update((state) => {
          state.mode = message.mode;
        });
        break;
      case "setPrimaryModel":
        await writeSetting(SETTING_KEYS.chain, [message.model, ...this.deps.modelChain().filter((model) => model !== message.model)]);
        runner.refreshModelHealth();
        break;
      case "updateSettings":
        for (const [key, value] of Object.entries(message.patch)) await writeSetting(SETTING_KEYS[key as keyof AnvilSettings], value);
        break;
      case "removeNote":
        runner.removeNote(message.id);
        break;
      case "stopAndSend":
        await this.stopAndSend(message.id);
        break;
      case "newSession":
        await this.startNew();
        break;
      case "openHistory":
        await this.open(message.id);
        break;
      case "deleteHistory":
        await this.remove(message.id);
        break;
      case "approve":
        runner.resolveApproval(message.toolCallId, message.allow, message.forSession);
        break;
      case "keepAll":
        this.keepAll();
        break;
      case "discardAll":
        await this.discardAll();
        break;
      case "openDiff":
        await this.openDiff(message.path);
        break;
      case "openFile":
        await this.openFile(message.path, message.line);
        break;
      case "searchMentions":
        reply({ type: "mentionResults", requestId: message.requestId, items: await this.mentions(message.query) });
        break;
      case "openSessionInHarness":
        await vscode.commands.executeCommand("anvil.openSessionInHarness");
        break;
      case "configureModels":
        await this.deps.configureModels();
        break;
      case "reconnect":
        await this.deps.connect();
        break;
    }
  }

  async persist(): Promise<void> {
    const { store, runner, history } = this.deps;
    const { conversationId, turns, changeSets } = store.state;
    if (!conversationId || !turns.length) return;
    const session = runner.currentSession();
    const setIds = new Set(turns.map((turn) => turn.changeSetId));
    await history.save({
      id: conversationId,
      title: conversationTitle(turns[0].prompt),
      updatedAt: Date.now(),
      turns: structuredClone(turns),
      sessionId: session?.id,
      lastTurnId: session?.lastTurnId,
      model: turns[turns.length - 1].model || undefined,
      edits: changeSets.filter((set) => setIds.has(set.id)).reduce((count, set) => count + set.files.length, 0),
    });
    this.showHistory();
  }

  keepAll(): void {
    this.deps.review.acceptEverywhere();
    this.deps.ledger.keep(this.conversationSets());
  }

  async discardAll(): Promise<void> {
    const { review, ledger, store } = this.deps;
    await review.discardAll();
    const open = new Set(store.state.changeSets.filter((set) => !set.kept && !set.undone).map((set) => set.id));
    const skipped: string[] = [];
    for (const id of this.conversationSets().reverse()) {
      if (open.has(id)) skipped.push(...(await ledger.undo(id)).skipped);
    }
    warnSkipped({ restored: [], skipped });
  }

  private async withLiveSelection(attachments: Attachment[], include = false): Promise<Attachment[]> {
    const live = include ? await this.deps.selection.liveAttachment().catch(() => undefined) : undefined;
    return live && !attachments.some((entry) => entry.path === live.path && entry.label === live.label) ? [live, ...attachments] : attachments;
  }

  private async send(text: string, mentions: string[], attachments: Attachment[], mode: AgentMode): Promise<void> {
    await this.deps.send(text, mentions, attachments, mode).catch((error: unknown) => this.deps.log(`Turn failed: ${String(error)}`));
  }

  private async retry(turnId: string): Promise<void> {
    const { store, runner } = this.deps;
    const turn = store.turn(turnId);
    if (!turn || runner.busy) return;
    await runner.restore(turnId, "conversation");
    await this.send(turn.prompt, turn.mentions, runner.attachmentsOf(turnId), store.state.mode);
  }

  private async restore(turnId: string, scope: Parameters<TurnRunner["restore"]>[1], reply: (message: HostMessage) => void): Promise<void> {
    try {
      const draft = await this.deps.runner.restore(turnId, scope);
      if (draft) reply({ type: "setDraft", text: draft.prompt, mentions: draft.mentions });
      await this.persist();
    } catch (error) {
      void vscode.window.showWarningMessage(`Anvil: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async stopAndSend(id: string): Promise<void> {
    const { store, runner } = this.deps;
    const note = runner.takeNote(id);
    if (!note) return;
    if (!runner.busy) return this.send(note.text, note.mentions, [], store.state.mode);
    runner.queueNote(note.text, note.mentions);
    const queued = store.state.queue.at(-1);
    await runner.cancel({ superseded: true });
    if (queued) store.update((state) => {
      state.queue = [queued, ...state.queue.filter((entry) => entry !== queued)];
    });
  }

  private async startNew(): Promise<void> {
    await this.switchTo(undefined);
    this.deps.store.update((state) => {
      state.conversationId = randomUUID();
    });
  }

  private async open(id: string): Promise<void> {
    const conversation = this.deps.history.get(id);
    if (!conversation || id === this.deps.store.state.conversationId) return;
    await this.switchTo(conversation.sessionId ? { id: conversation.sessionId, lastTurnId: conversation.lastTurnId } : undefined);
    this.deps.store.update((state) => {
      state.conversationId = id;
      state.turns = structuredClone(conversation.turns);
    });
  }

  private async remove(id: string): Promise<void> {
    if (id === this.deps.store.state.conversationId) await this.startNew();
    await this.deps.history.delete(id);
    this.showHistory();
  }

  private async switchTo(session: { id: string; lastTurnId?: string } | undefined): Promise<void> {
    await this.deps.runner.stop();
    this.deps.readCache.clear();
    this.deps.runner.resetSession(session);
  }

  private showHistory(): void {
    this.deps.store.update((state) => {
      state.history = this.deps.history.summaries();
    });
  }

  private conversationSets(): string[] {
    return this.deps.store.state.turns.flatMap((turn) => (turn.changeSetId ? [turn.changeSetId] : []));
  }

  private async openDiff(path: string): Promise<void> {
    const uri = this.fileUri(path);
    if (await this.deps.review.show(uri)) return;
    const setId = this.conversationSets().find((id) => this.deps.ledger.touches(id, path));
    if (!setId) return this.openFile(path);
    const before = vscode.Uri.from({ scheme: SNAPSHOT_SCHEME, path: `/${path}`, query: setId });
    await vscode.commands.executeCommand("vscode.diff", before, uri, `${path} (before Anvil ↔ now)`, { preview: true });
  }

  private async openFile(path: string, line = 1): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(this.fileUri(path));
      const at = Math.max(0, line - 1);
      await vscode.window.showTextDocument(document, { selection: new vscode.Range(at, 0, at, 0), preview: true });
    } catch {
      void vscode.window.showWarningMessage(`Cannot open ${path}`);
    }
  }

  private fileUri(path: string): vscode.Uri {
    return vscode.Uri.joinPath(this.deps.folder, ...path.replaceAll("\\", "/").replace(/^\.\//, "").split("/"));
  }

  private async mentions(query: string): Promise<MentionItem[]> {
    await this.deps.indexReady;
    const items = mentionCandidates(this.deps.index, query, MENTION_LIMIT);
    if (query.trim().length >= 2) items.push(...(await this.workspaceSymbols(query.trim())));
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.kind}:${item.path}:${item.line ?? ""}:${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MENTION_LIMIT);
  }

  private async workspaceSymbols(query: string): Promise<MentionItem[]> {
    const symbols = await Promise.resolve(vscode.commands.executeCommand<vscode.SymbolInformation[] | undefined>("vscode.executeWorkspaceSymbolProvider", query)).catch(() => undefined);
    return (symbols ?? [])
      .filter((symbol) => inWorkspace(symbol.location.uri, this.deps.folder))
      .slice(0, MENTION_LIMIT)
      .map((symbol) => {
        const path = vscode.workspace.asRelativePath(symbol.location.uri, false).replaceAll("\\", "/");
        const line = symbol.location.range.start.line + 1;
        return { kind: "symbol", label: symbol.name, path, line, detail: `${vscode.SymbolKind[symbol.kind].toLowerCase()} · ${path}:${line}` };
      });
  }
}

function withinImageLimit(attachments: Attachment[]): Attachment[] {
  const kept = attachments.filter((attachment) => !attachment.dataUrl || imageBytes(attachment.dataUrl) <= MAX_IMAGE_BYTES);
  if (kept.length < attachments.length) void vscode.window.showWarningMessage("Anvil: images larger than 4 MB were not sent.");
  return kept;
}

function warnSkipped(result: UndoResult): void {
  if (result.skipped.length) void vscode.window.showWarningMessage(`Anvil: not undone because they changed after the agent edit: ${[...new Set(result.skipped)].join(", ")}`);
}
