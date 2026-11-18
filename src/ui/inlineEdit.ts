import * as vscode from "vscode";
import { EDIT_TOOLS } from "../agent/editCoordinator.ts";
import type { TurnRequest, TurnRunner } from "../agent/turnRunner.ts";
import { selectionLabel } from "../context/attachments.ts";
import { estimateTokens } from "../context/tokens.ts";
import { formatPatch } from "../edits/hunks.ts";
import type { ReviewController } from "../edits/reviewController.ts";
import type { NoticeStep, Turn } from "../shared/protocol.ts";
import { inWorkspace, selectedLines } from "./attachCommands.ts";

const SURROUNDING_LINES = 30;
const MAX_PATCH_CHARS = 3_000;
const ANVIL: vscode.CommentAuthorInformation = { name: "Anvil" };
const YOU: vscode.CommentAuthorInformation = { name: "You" };
const KEYS = process.platform === "darwin" ? "Cmd+Enter" : "Ctrl+Enter";

type Phase = "new" | "running" | "review" | "done";

interface InlineSession {
  thread: vscode.CommentThread;
  uri: vscode.Uri;
  path: string;
  firstLine: number;
  lastLine: number;
  linesBefore: number;
  status?: vscode.Comment;
  rounds: string[];
  work: Promise<void>;
}

export class InlineEditor implements vscode.Disposable {
  private readonly controller = vscode.comments.createCommentController("anvil.inline", "Anvil");
  private readonly runner: TurnRunner;
  private readonly review: ReviewController;
  private readonly folder: vscode.Uri;
  private readonly afterRun: () => Promise<void>;
  private readonly disposables: vscode.Disposable[];
  private session: InlineSession | undefined;

  constructor(runner: TurnRunner, review: ReviewController, folder: vscode.Uri, afterRun: () => Promise<void>) {
    this.runner = runner;
    this.review = review;
    this.folder = folder;
    this.afterRun = afterRun;
    this.disposables = [
      this.controller,
      vscode.commands.registerCommand("anvil.inlineEdit", () => this.open()),
      vscode.commands.registerCommand("anvil.inline.submit", (reply: vscode.CommentReply) => this.submit(reply)),
      vscode.commands.registerCommand("anvil.inline.refine", (reply: vscode.CommentReply) => this.submit(reply)),
      vscode.commands.registerCommand("anvil.inline.stop", () => this.runner.cancel()),
      vscode.commands.registerCommand("anvil.inline.diff", () => this.session && this.review.openDiff(this.session.uri)),
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
    if (this.session && this.phase(this.session) !== "new" && this.phase(this.session) !== "done") {
      void vscode.window.showWarningMessage("Anvil is still working on the open inline edit. Stop it or finish the review first.");
      return;
    }
    this.close();
    const { startLine, endLine } = selectedLines(editor.selection);
    const path = vscode.workspace.asRelativePath(editor.document.uri, false).replaceAll("\\", "/");
    const thread = this.controller.createCommentThread(editor.document.uri, new vscode.Range(startLine, 0, endLine, 0), []);
    thread.label = `Edit ${selectionLabel(path, startLine + 1, endLine + 1)}`;
    thread.canReply = true;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    this.session = { thread, uri: editor.document.uri, path, firstLine: startLine, lastLine: endLine, linesBefore: editor.document.lineCount, rounds: [], work: Promise.resolve() };
    this.setPhase(this.session, "new");
  }

  private async submit(reply: vscode.CommentReply): Promise<void> {
    const session = this.session;
    const instruction = reply.text.trim();
    if (!session || !instruction || this.phase(session) === "running") return;
    this.say(session, YOU, instruction);
    if (this.review.isReviewing(session.uri)) {
      this.say(session, ANVIL, "Accepted the pending changes so the refinement starts from them.");
      this.review.acceptAll(session.uri);
      await session.work;
    }
    if (this.session !== session) return;
    if (this.runner.busy) {
      this.say(session, ANVIL, "Anvil is busy with a chat turn. Stop it or wait for it to finish, then send again.");
      return;
    }
    session.work = this.round(session, instruction);
    await session.work;
    await this.afterRun();
  }

  private async round(session: InlineSession, instruction: string): Promise<void> {
    session.status = this.say(session, ANVIL, "Working…");
    this.setPhase(session, "running");
    const document = await vscode.workspace.openTextDocument(session.uri);
    const before = document.getText();
    session.linesBefore = document.lineCount;
    let turn: Turn | undefined;
    try {
      turn = await this.runner.run(inlineRequest(document, session.path, session.firstLine, session.lastLine, instruction, session.rounds));
    } catch (error) {
      this.update(session, `Could not start the edit: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (this.session !== session) return;
    this.reanchor(session, document);
    const summary = summarizeInline(turn);
    const after = document.getText();
    const patch = after === before ? "" : formatPatch(session.path, before, after);
    session.rounds.push([
      `Round ${session.rounds.length + 1} instruction: ${instruction}`,
      `Result: ${summary}`,
      ...(patch ? ["Applied diff:", "```diff", clip(patch.trim()), "```"] : []),
    ].join("\n"));
    if (turn) this.update(session, `${summary}\n\nRefine it below, or press Done.`);
    this.setPhase(session, "done");
  }

  private onReviewChanged(): void {
    const session = this.session;
    if (!session) return;
    const phase = this.phase(session);
    const reviewing = this.review.isReviewing(session.uri);
    if (phase === "running" && reviewing) {
      this.setPhase(session, "review");
      this.update(session, "Review the change in the editor: **Accept**, **Reject** or **Keep both** on each change, or **Open diff**. Refining from here accepts what is pending first.");
    } else if (phase === "review" && !reviewing) {
      this.setPhase(session, "running");
      this.update(session, "Working…");
    }
    const document = vscode.workspace.textDocuments.find((entry) => entry.uri.toString() === session.uri.toString());
    if (document && (phase === "running" || phase === "review")) {
      const last = Math.max(session.firstLine, Math.min(document.lineCount - 1, session.lastLine + document.lineCount - session.linesBefore));
      session.thread.range = new vscode.Range(session.firstLine, 0, last, 0);
    }
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
    if (this.phase(session) === "running" || this.phase(session) === "review") void this.runner.cancel();
    session.thread.dispose();
    void vscode.commands.executeCommand("setContext", "anvil.inlineRunning", false);
  }

  private phase(session: InlineSession): Phase {
    return session.thread.contextValue as Phase;
  }

  private setPhase(session: InlineSession, phase: Phase): void {
    session.thread.contextValue = phase;
    this.controller.options = phase === "new"
      ? { prompt: "Describe the change", placeHolder: `Describe the change, then ${KEYS}` }
      : { prompt: "Refine…", placeHolder: `Refine the result, then ${KEYS}` };
    void vscode.commands.executeCommand("setContext", "anvil.inlineRunning", phase === "running");
  }

  private say(session: InlineSession, author: vscode.CommentAuthorInformation, text: string): vscode.Comment {
    const comment: vscode.Comment = { body: new vscode.MarkdownString(text), mode: vscode.CommentMode.Preview, author };
    session.thread.comments = [...session.thread.comments, comment];
    return comment;
  }

  private update(session: InlineSession, text: string): void {
    if (!session.status) return;
    session.status.body = new vscode.MarkdownString(text);
    session.thread.comments = [...session.thread.comments];
  }
}

export function summarizeInline(turn: Turn | undefined): string {
  if (!turn) return "The edit did not run.";
  if (turn.status === "cancelled" || turn.status === "superseded") return "Stopped. Changes you had not accepted were discarded.";
  const problem = turn.steps.findLast((step): step is NoticeStep => step.kind === "notice" && step.tone === "error")?.text;
  if (turn.status === "error") return problem ?? "The edit failed.";
  const edit = turn.steps.findLast((step) => step.kind === "tool" && EDIT_TOOLS.has(step.name));
  const reply = turn.steps.findLast((step) => step.kind === "text")?.text.trim();
  const result = edit?.kind !== "tool"
    ? "No change was proposed."
    : edit.diff
      ? `Applied +${edit.diff.added} −${edit.diff.removed}.`
      : edit.status === "denied"
        ? "Nothing was applied."
        : edit.status === "error"
          ? `The edit could not be applied: ${edit.output?.split("\n")[0] ?? "unknown error"}`
          : "No change was needed.";
  return reply ? `${result} ${reply}` : result;
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
