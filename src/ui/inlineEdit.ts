import * as vscode from "vscode";
import { EDIT_TOOLS } from "../agent/editCoordinator.ts";
import type { TurnRequest, TurnRunner } from "../agent/turnRunner.ts";
import { selectionAttachment, selectionLabel } from "../context/attachments.ts";
import { estimateTokens } from "../context/tokens.ts";
import { formatPatch } from "../edits/hunks.ts";
import type { ReviewController } from "../edits/reviewController.ts";
import type { Attachment, NoticeStep, Turn } from "../shared/protocol.ts";
import { inWorkspace, selectedLines } from "./attachCommands.ts";

const SURROUNDING_LINES = 30;
const MAX_PATCH_CHARS = 3_000;
const MAX_HISTORY_CHARS = 80;
const KEYS = process.platform === "darwin" ? "Cmd+Enter" : "Ctrl+Enter";

type Phase = "new" | "running" | "review" | "done" | "answered";

export interface InlineOutcome {
  icon: string;
  status: string;
  tag: string;
  note: string;
  answered: boolean;
}

interface InlineSession {
  thread: vscode.CommentThread;
  uri: vscode.Uri;
  path: string;
  firstLine: number;
  lastLine: number;
  linesBefore: number;
  status?: vscode.Comment;
  rounds: string[];
  history: string[];
  instruction: string;
  work: Promise<void>;
}

export class InlineEditor implements vscode.Disposable {
  private readonly controller = vscode.comments.createCommentController("anvil.inline", "Anvil");
  private readonly runner: TurnRunner;
  private readonly review: ReviewController;
  private readonly folder: vscode.Uri;
  private readonly afterRun: () => Promise<void>;
  private readonly ask: (text: string, attachment: Attachment) => Promise<void>;
  private readonly anvil: vscode.CommentAuthorInformation;
  private readonly you: vscode.CommentAuthorInformation;
  private readonly disposables: vscode.Disposable[];
  private session: InlineSession | undefined;

  constructor(
    runner: TurnRunner,
    review: ReviewController,
    folder: vscode.Uri,
    media: vscode.Uri,
    afterRun: () => Promise<void>,
    ask: (text: string, attachment: Attachment) => Promise<void>,
  ) {
    this.runner = runner;
    this.review = review;
    this.folder = folder;
    this.afterRun = afterRun;
    this.ask = ask;
    this.anvil = { name: "Anvil", iconPath: vscode.Uri.joinPath(media, "anvil-avatar.svg") };
    this.you = { name: "You", iconPath: vscode.Uri.joinPath(media, "user-avatar.svg") };
    this.disposables = [
      this.controller,
      vscode.commands.registerCommand("anvil.inlineEdit", () => this.open()),
      vscode.commands.registerCommand("anvil.inline.submit", (reply: vscode.CommentReply) => this.submit(reply)),
      vscode.commands.registerCommand("anvil.inline.refine", (reply: vscode.CommentReply) => this.submit(reply)),
      vscode.commands.registerCommand("anvil.inline.stop", () => this.runner.cancel()),
      vscode.commands.registerCommand("anvil.inline.diff", () => this.session && this.review.openDiff(this.session.uri)),
      vscode.commands.registerCommand("anvil.inline.accept", () => this.session && vscode.commands.executeCommand("anvil.acceptAll", this.session.uri)),
      vscode.commands.registerCommand("anvil.inline.reject", () => this.session && vscode.commands.executeCommand("anvil.rejectAll", this.session.uri)),
      vscode.commands.registerCommand("anvil.inline.ask", () => this.askInChat()),
      vscode.commands.registerCommand("anvil.inline.close", () => this.close()),
      review.onDidChangeState(() => this.onReviewChanged()),
    ];
  }

  dispose(): void {
    this.close();
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private open(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage("Open a file and select the code to edit.");
      return;
    }
    if (!inWorkspace(editor.document.uri, this.folder)) {
      void vscode.window.showWarningMessage("Inline edits work on files inside the open workspace.");
      return;
    }
    if (this.session && this.busy(this.session)) {
      void vscode.window.showWarningMessage("Anvil is still working on the open inline edit. Stop it or finish the review first.");
      return;
    }
    this.close();
    const { startLine, endLine } = selectedLines(editor.selection);
    const path = vscode.workspace.asRelativePath(editor.document.uri, false).replaceAll("\\", "/");
    const range = new vscode.Range(startLine, 0, endLine, 0);
    const thread = this.controller.createCommentThread(editor.document.uri, range, []);
    thread.canReply = true;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    this.session = { thread, uri: editor.document.uri, path, firstLine: startLine, lastLine: endLine, linesBefore: editor.document.lineCount, rounds: [], history: [], instruction: "", work: Promise.resolve() };
    this.setPhase(this.session, "new");
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  private async submit(reply: vscode.CommentReply): Promise<void> {
    const session = this.session;
    const instruction = reply.text.trim();
    if (!session || !instruction || this.phase(session) === "running") return;
    if (this.review.isReviewing(session.uri)) {
      this.review.acceptAll(session.uri);
      await session.work;
    }
    if (this.session !== session) return;
    this.startExchange(session, instruction);
    if (this.runner.busy) {
      this.show(session, { icon: "warning", status: "Anvil is busy", tag: "busy", note: "Finish or stop the chat turn, then send again.", answered: false });
      this.setPhase(session, session.rounds.length ? "done" : "new", "busy");
      return;
    }
    session.work = this.round(session, instruction);
    await session.work;
    await this.afterRun();
  }

  private async round(session: InlineSession, instruction: string): Promise<void> {
    session.instruction = instruction;
    this.show(session, { icon: "clock", status: "Working…", tag: "working", note: "", answered: false });
    this.setPhase(session, "running", "working");
    const document = await vscode.workspace.openTextDocument(session.uri);
    const before = document.getText();
    session.linesBefore = document.lineCount;
    let turn: Turn | undefined;
    let failure = "";
    try {
      turn = await this.runner.run(inlineRequest(document, session.path, session.firstLine, session.lastLine, instruction, session.rounds));
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (this.session !== session) return;
    this.reanchor(session, document);
    const result = turn ? inlineOutcome(turn) : { icon: "error", status: "Could not start the edit", tag: "failed", note: failure, answered: false };
    const after = document.getText();
    const patch = after === before ? "" : formatPatch(session.path, before, after);
    session.rounds.push([
      `Round ${session.rounds.length + 1} instruction: ${instruction}`,
      `Result: ${result.status}. ${result.note}`.trim(),
      ...(patch ? ["Applied diff:", "```diff", clip(patch.trim()), "```"] : []),
    ].join("\n"));
    session.history.push(`${oneLine(instruction)} · ${result.tag}`);
    this.show(session, result);
    this.setPhase(session, result.answered ? "answered" : "done", result.tag);
  }

  private onReviewChanged(): void {
    const session = this.session;
    if (!session) return;
    const phase = this.phase(session);
    const reviewing = this.review.isReviewing(session.uri);
    if (reviewing && (phase === "running" || phase === "review")) {
      const hunks = this.review.pending().find((entry) => entry.path === session.path)?.hunks ?? 0;
      const count = `${hunks} ${hunks === 1 ? "change" : "changes"}`;
      this.show(session, { icon: "diff", status: `${count} waiting for review`, tag: `${count} to review`, note: "", answered: false });
      this.setPhase(session, "review", `${count} to review`);
    } else if (phase === "review") {
      this.show(session, { icon: "clock", status: "Working…", tag: "working", note: "", answered: false });
      this.setPhase(session, "running", "working");
    }
    const document = vscode.workspace.textDocuments.find((entry) => entry.uri.toString() === session.uri.toString());
    if (document && (phase === "running" || phase === "review")) {
      const last = Math.max(session.firstLine, Math.min(document.lineCount - 1, session.lastLine + document.lineCount - session.linesBefore));
      session.thread.range = new vscode.Range(session.firstLine, 0, last, 0);
    }
  }

  private async askInChat(): Promise<void> {
    const session = this.session;
    if (!session) return;
    const document = await vscode.workspace.openTextDocument(session.uri);
    const last = Math.min(session.lastLine, document.lineCount - 1);
    const text = document.getText(new vscode.Range(session.firstLine, 0, last, document.lineAt(last).text.length));
    const instruction = session.instruction;
    this.close();
    await this.ask(instruction, selectionAttachment(session.path, session.firstLine + 1, last + 1, text));
  }

  private reanchor(session: InlineSession, document: vscode.TextDocument): void {
    session.lastLine = Math.max(session.firstLine, Math.min(document.lineCount - 1, session.lastLine + document.lineCount - session.linesBefore));
    session.linesBefore = document.lineCount;
    session.thread.range = new vscode.Range(session.firstLine, 0, session.lastLine, 0);
  }

  private close(): void {
    const session = this.session;
    if (!session) return;
    this.session = undefined;
    if (this.busy(session)) void this.runner.cancel();
    session.thread.dispose();
    void vscode.commands.executeCommand("setContext", "anvil.inlineRunning", false);
  }

  private phase(session: InlineSession): Phase {
    return session.thread.contextValue as Phase;
  }

  private busy(session: InlineSession): boolean {
    return this.phase(session) === "running" || this.phase(session) === "review";
  }

  private setPhase(session: InlineSession, phase: Phase, tag?: string): void {
    session.thread.contextValue = phase;
    const where = selectionLabel(session.path, session.firstLine + 1, session.lastLine + 1);
    session.thread.label = ["Anvil", where, tag].filter(Boolean).join(" · ");
    this.controller.options = session.rounds.length
      ? { prompt: "Refine", placeHolder: `Refine · ${KEYS}` }
      : { prompt: "Describe the change", placeHolder: `Describe the change · ${KEYS}` };
    void vscode.commands.executeCommand("setContext", "anvil.inlineRunning", phase === "running");
  }

  private startExchange(session: InlineSession, instruction: string): void {
    const comments: vscode.Comment[] = [];
    if (session.history.length) {
      const body = new vscode.MarkdownString();
      session.history.forEach((line, index) => {
        body.appendMarkdown(index ? "  \n_" : "_").appendText(line).appendMarkdown("_");
      });
      comments.push({ body, mode: vscode.CommentMode.Preview, author: this.you, label: "Earlier" });
    }
    comments.push({ body: new vscode.MarkdownString().appendText(instruction), mode: vscode.CommentMode.Preview, author: this.you });
    session.status = { body: "", mode: vscode.CommentMode.Preview, author: this.anvil };
    session.thread.comments = [...comments, session.status];
  }

  private show(session: InlineSession, outcome: InlineOutcome): void {
    if (!session.status) return;
    const body = new vscode.MarkdownString(`$(${outcome.icon}) **${outcome.status}**`, true);
    if (outcome.note) body.appendMarkdown(`\n\n${outcome.note.replaceAll("$(", "\\$(")}`);
    session.status.body = body;
    session.thread.comments = [...session.thread.comments];
  }
}

export function inlineOutcome(turn: Turn): InlineOutcome {
  if (turn.status === "cancelled" || turn.status === "superseded") {
    return { icon: "debug-stop", status: "Stopped", tag: "stopped", note: "Changes you had not accepted were discarded.", answered: false };
  }
  const problem = turn.steps.findLast((step): step is NoticeStep => step.kind === "notice" && step.tone === "error")?.text;
  if (turn.status === "error") return { icon: "error", status: "The edit failed", tag: "failed", note: dashes(problem ?? ""), answered: false };
  const edit = turn.steps.findLast((step) => step.kind === "tool" && EDIT_TOOLS.has(step.name));
  const note = dashes(turn.steps.findLast((step) => step.kind === "text")?.text.trim() ?? "");
  if (edit?.kind !== "tool") return { icon: "info", status: "No change", tag: "no change", note, answered: true };
  if (edit.diff) {
    const stat = `+${edit.diff.added} −${edit.diff.removed}`;
    return { icon: "check", status: `Applied ${stat}`, tag: `applied ${stat}`, note, answered: false };
  }
  if (edit.status === "denied") return { icon: "close", status: "Nothing applied", tag: "rejected", note, answered: false };
  if (edit.status === "error") {
    return { icon: "error", status: "Could not apply the edit", tag: "failed", note: dashes(edit.output?.split("\n")[0] ?? ""), answered: false };
  }
  return { icon: "info", status: "No change", tag: "no change", note, answered: true };
}

function dashes(text: string): string {
  return text.replace(/\u2014/g, "\u2013");
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, " ");
  return flat.length > MAX_HISTORY_CHARS ? `${flat.slice(0, MAX_HISTORY_CHARS)}…` : flat;
}

function clip(text: string): string {
  return text.length > MAX_PATCH_CHARS ? `${text.slice(0, MAX_PATCH_CHARS)}\n…` : text;
}

export function inlineRequest(document: vscode.TextDocument, path: string, firstLine: number, lastLine: number, instruction: string, rounds: string[] = []): TurnRequest {
  const numbered = (from: number, to: number) => {
    const lines: string[] = [];
    for (let line = from; line <= to; line += 1) lines.push(`${String(line + 1).padStart(5)}  ${document.lineAt(line).text}`);
    return lines.join("\n");
  };
  const contextFrom = Math.max(0, firstLine - SURROUNDING_LINES);
  const contextTo = Math.min(document.lineCount - 1, lastLine + SURROUNDING_LINES);
  const message = [
    rounds.length ? "Inline edit request, follow-up on the same selection." : "Inline edit request.",
    `File: ${path} (${document.languageId})`,
    `Selected lines ${firstLine + 1}-${lastLine + 1} (current text):`,
    "```",
    numbered(firstLine, lastLine),
    "```",
    `Surrounding context, lines ${contextFrom + 1}-${contextTo + 1}:`,
    "```",
    numbered(contextFrom, contextTo),
    "```",
    ...(rounds.length ? ["Earlier rounds on this selection. Their accepted results are already in the text above:", ...rounds] : []),
    `Instruction: ${instruction.trim()}`,
  ].join("\n");

  return {
    mode: "inline",
    title: `Inline edit · ${path}`,
    prompt: instruction,
    mentions: [path],
    message,
    selection: { path, start: firstLine + 1, end: lastLine + 1 },
    context: {
      strategy: "Inline edit: the selection plus 30 surrounding lines, no repository search.",
      budgetTokens: estimateTokens(message),
      usedTokens: estimateTokens(message),
      files: [{ path, role: "target", score: 1, tokens: estimateTokens(message), reasons: [`selection lines ${firstLine + 1}-${lastLine + 1}`] }],
      fetched: [],
      read: [],
      edited: [],
    },
  };
}
