import * as vscode from "vscode";
import type { ConversationStore } from "../agent/conversationStore.ts";
import { selectionAttachment, selectionLabel } from "../context/attachments.ts";
import type { ReviewController } from "../edits/reviewController.ts";
import type { Attachment, EditorSelection } from "../shared/protocol.ts";
import { inWorkspace, selectedLines, selectionFromEditor } from "./attachCommands.ts";

const DEBOUNCE_MS = 120;
const KEYS = process.platform === "darwin" ? "Cmd+Alt+" : "Ctrl+Alt+";

interface Tracked extends EditorSelection {
  uri: vscode.Uri;
}

export class SelectionContext implements vscode.Disposable {
  private readonly folder: vscode.Uri;
  private readonly store: ConversationStore;
  private readonly review: ReviewController;
  private readonly send: (attachment: Attachment) => Promise<void>;
  private readonly lensEmitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[];
  private current: Tracked | undefined;
  private dismissed: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(folder: vscode.Uri, store: ConversationStore, review: ReviewController, send: (attachment: Attachment) => Promise<void>) {
    this.folder = folder;
    this.store = store;
    this.review = review;
    this.send = send;
    this.disposables = [
      this.lensEmitter,
      vscode.window.onDidChangeTextEditorSelection(() => this.schedule()),
      vscode.window.onDidChangeActiveTextEditor(() => this.schedule()),
      vscode.workspace.onDidChangeConfiguration((event) => event.affectsConfiguration("anvil.selection") && this.schedule()),
      review.onDidChangeState(() => this.lensEmitter.fire()),
      vscode.languages.registerCodeLensProvider({ scheme: "file" }, {
        onDidChangeCodeLenses: this.lensEmitter.event,
        provideCodeLenses: (document) => this.lenses(document),
      }),
      vscode.commands.registerCommand("anvil.askAboutSelection", async () => {
        const attachment = selectionFromEditor(vscode.window.activeTextEditor, folder);
        if (!attachment) return;
        store.update((state) => {
          state.mode = "ask";
        });
        await this.attach(attachment);
      }),
    ];
    this.refresh();
  }

  readonly attach = async (attachment: Attachment): Promise<void> => {
    if (this.current && attachment.label === this.current.label && attachment.path === this.current.path) this.hide();
    await this.send(attachment);
  };

  async liveAttachment(): Promise<Attachment | undefined> {
    const tracked = this.current;
    if (!tracked || !this.store.state.editorSelection) return undefined;
    const document = await vscode.workspace.openTextDocument(tracked.uri);
    const last = Math.min(tracked.endLine, document.lineCount) - 1;
    const range = new vscode.Range(tracked.startLine - 1, 0, last, document.lineAt(last).text.length);
    return selectionAttachment(tracked.path, tracked.startLine, tracked.endLine, document.getText(range));
  }

  async pin(): Promise<void> {
    const attachment = await this.liveAttachment();
    if (attachment) await this.attach(attachment);
  }

  hide(): void {
    this.dismissed = this.current && keyOf(this.current);
    this.publish();
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), DEBOUNCE_MS);
  }

  private refresh(): void {
    const editor = vscode.window.activeTextEditor;
    const next = editor && !editor.selection.isEmpty && editor.document.uri.scheme === "file" && inWorkspace(editor.document.uri, this.folder) ? track(editor) : undefined;
    if (!next || !this.current || keyOf(next) !== keyOf(this.current)) this.dismissed = undefined;
    this.current = next;
    this.publish();
    this.lensEmitter.fire();
  }

  private publish(): void {
    const autoAttach = vscode.workspace.getConfiguration("anvil").get<boolean>("selection.autoAttach", true);
    const tracked = this.current;
    const shown: EditorSelection | undefined = tracked && autoAttach && this.dismissed !== keyOf(tracked)
      ? { path: tracked.path, startLine: tracked.startLine, endLine: tracked.endLine, label: tracked.label }
      : undefined;
    const before = this.store.state.editorSelection;
    if (before?.label === shown?.label && before?.path === shown?.path) return;
    this.store.update((state) => {
      state.editorSelection = shown;
    });
  }

  private lenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const editor = vscode.window.activeTextEditor;
    const enabled = vscode.workspace.getConfiguration("anvil").get<boolean>("selection.askActions", true);
    if (!enabled || !editor || editor.document !== document || editor.selection.isEmpty) return [];
    if (!inWorkspace(document.uri, this.folder) || this.review.isReviewing(document.uri)) return [];
    const at = new vscode.Range(editor.selection.start.line, 0, editor.selection.start.line, 0);
    return [
      new vscode.CodeLens(at, { title: `$(sparkle) Edit (${KEYS}K)`, tooltip: "Describe a change to the selected lines, right here in the editor", command: "anvil.inlineEdit" }),
      new vscode.CodeLens(at, { title: `$(comment-discussion) Ask (${KEYS}Q)`, tooltip: "Ask about the selection in the chat", command: "anvil.askAboutSelection" }),
      new vscode.CodeLens(at, { title: `$(add) Add to chat (${KEYS}L)`, tooltip: "Attach the selection to the next chat message", command: "anvil.addSelectionToChat" }),
    ];
  }
}

function track(editor: vscode.TextEditor): Tracked {
  const path = vscode.workspace.asRelativePath(editor.document.uri, false).replaceAll("\\", "/");
  const { startLine, endLine } = selectedLines(editor.selection);
  return { uri: editor.document.uri, path, startLine: startLine + 1, endLine: endLine + 1, label: selectionLabel(path, startLine + 1, endLine + 1) };
}

function keyOf(selection: EditorSelection): string {
  return `${selection.path}:${selection.startLine}-${selection.endLine}`;
}
