import * as vscode from "vscode";
import type { DiffStat } from "../shared/protocol.ts";
import { ChangeLedger, fullRange } from "./changeLedger.ts";
import { computeHunks, diffStat, formatPatch, renderReview, resolveText, sameText } from "./hunks.ts";
import type { Hunk, HunkDecision, ReviewRender } from "./hunks.ts";
import { describeFlags, flagHunks, type ScopeFence } from "./scopeFence.ts";

export interface ReviewRequest {
  uri: vscode.Uri;
  baseline: string;
  proposal: string;
  title: string;
  changeSetId: string;
  isNewFile?: boolean;
  /** G2: expected area; hunks outside it get a warning badge. */
  fence?: ScopeFence;
}

export interface ReviewOutcome {
  status: "accepted" | "partial" | "rejected" | "discarded";
  accepted: number;
  rejected: number;
  total: number;
  finalText: string;
  rejectedPatch: string;
  stat: DiffStat;
  /** Sentence about hunks flagged outside the fence, for the model. */
  scopeNote?: string;
}

interface Session {
  request: ReviewRequest;
  key: string;
  hunks: Hunk[];
  decisions: HunkDecision[];
  render: ReviewRender;
  wasDirty: boolean;
  settling: boolean;
  proposalUri: vscode.Uri;
  done: (outcome: ReviewOutcome) => void;
}

const PROPOSAL_SCHEME = "anvil-proposal";

export class ReviewController implements vscode.Disposable {
  private readonly ledger: ChangeLedger;
  private readonly sessions = new Map<string, Session>();
  private readonly queue = new Map<string, Promise<unknown>>();
  private readonly stateEmitter = new vscode.EventEmitter<void>();
  private readonly lensEmitter = new vscode.EventEmitter<void>();
  private readonly removedStyle = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("diffEditor.removedLineBackground"),
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.deletedForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });
  private readonly addedStyle = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("diffEditor.insertedLineBackground"),
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.addedForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });
  private readonly disposables: vscode.Disposable[];
  private inflight = 0;
  private epoch = 0;
  private proposalSeq = 0;

  readonly onDidChangeState = this.stateEmitter.event;

  constructor(ledger: ChangeLedger) {
    this.ledger = ledger;
    this.disposables = [
      this.stateEmitter,
      this.lensEmitter,
      this.removedStyle,
      this.addedStyle,
      vscode.commands.registerCommand("anvil.acceptHunk", (target?: unknown, index?: number) => this.decideHunk(target, index, "accepted")),
      vscode.commands.registerCommand("anvil.rejectHunk", (target?: unknown, index?: number) => this.decideHunk(target, index, "rejected")),
      vscode.commands.registerCommand("anvil.acceptAll", (target?: unknown) => this.decideAll(target, "accepted")),
      vscode.commands.registerCommand("anvil.rejectAll", (target?: unknown) => this.decideAll(target, "rejected")),
      vscode.languages.registerCodeLensProvider({ scheme: "file" }, {
        onDidChangeCodeLenses: this.lensEmitter.event,
        provideCodeLenses: (document) => this.lenses(document),
      }),
      vscode.workspace.registerTextDocumentContentProvider(PROPOSAL_SCHEME, {
        provideTextDocumentContent: (uri) => (uri.query === "empty" ? "" : this.findSession(uri.toString())?.request.proposal ?? ""),
      }),
      vscode.workspace.onDidChangeTextDocument((event) => this.onEdited(event)),
      vscode.workspace.onDidCloseTextDocument((document) => this.onClosed(document)),
      vscode.workspace.onDidSaveTextDocument((document) => this.onSaved(document)),
      vscode.window.tabGroups.onDidChangeTabs((event) => this.onTabsChanged(event)),
      vscode.window.onDidChangeVisibleTextEditors(() => this.paint()),
    ];
  }

  async review(request: ReviewRequest): Promise<ReviewOutcome> {
    const key = request.uri.toString();
    const epoch = this.epoch;
    this.inflight++;
    const run = (this.queue.get(key) ?? Promise.resolve()).then(() =>
      epoch === this.epoch ? this.start(request) : outcomeOf(request, [], [], request.baseline, true),
    );
    const tail = run.catch(() => undefined);
    this.queue.set(key, tail);
    this.publish();
    try {
      return await run;
    } finally {
      this.inflight--;
      if (this.queue.get(key) === tail) this.queue.delete(key);
      this.publish();
    }
  }

  async discardAll(): Promise<void> {
    this.epoch++;
    await Promise.all([...this.sessions.values()].map((session) => this.settle(session, true)));
  }

  hasPendingReviews(): boolean {
    return this.inflight > 0;
  }

  isReviewing(uri: vscode.Uri): boolean {
    return this.sessions.has(uri.toString());
  }

  dispose(): void {
    void this.discardAll().finally(() => this.disposables.forEach((d) => d.dispose()));
  }

  private start(request: ReviewRequest): Promise<ReviewOutcome> {
    const hunks = computeHunks(request.baseline, request.proposal);
    if (hunks.length === 0) return Promise.resolve(outcomeOf(request, hunks, [], request.baseline, false));
    const decisions: HunkDecision[] = hunks.map(() => "pending");
    return new Promise((done) => {
      const session: Session = {
        request,
        key: request.uri.toString(),
        hunks,
        decisions,
        render: renderReview(request.baseline, hunks, decisions),
        wasDirty: false,
        settling: false,
        proposalUri: request.uri.with({ scheme: PROPOSAL_SCHEME, query: `proposal-${++this.proposalSeq}` }),
        done,
      };
      this.sessions.set(session.key, session);
      this.publish();
      const show = request.isNewFile ? this.showProposal(session) : this.showInline(session);
      show.catch((error: unknown) => {
        void vscode.window.showErrorMessage(`Anvil could not open the review for ${request.title}: ${String(error)}`);
        return this.settle(session, true);
      });
    });
  }

  private async showInline(session: Session): Promise<void> {
    const document = await vscode.workspace.openTextDocument(session.request.uri);
    session.wasDirty = document.isDirty;
    if (vscode.workspace.getConfiguration("files", document.uri).get<string>("autoSave", "off") !== "off") {
      void vscode.window.showWarningMessage("Auto Save is on. Saving while a review is open discards it and restores the original file. Turn off Auto Save to review Anvil's changes.");
    }
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    await this.writeBuffer(session, document);
    if (session.settling) return;
    const first = session.render.hunkAnchors[0]?.line ?? 0;
    editor.selection = new vscode.Selection(first, 0, first, 0);
    editor.revealRange(new vscode.Range(first, 0, first, 0), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  private async showProposal(session: Session): Promise<void> {
    const empty = session.proposalUri.with({ query: "empty" });
    const path = vscode.workspace.asRelativePath(session.request.uri, false);
    await vscode.commands.executeCommand("vscode.diff", empty, session.proposalUri, `${path} (new file)`, { preview: false });
    void vscode.window
      .showInformationMessage(`Anvil wants to create ${path}.`, "Create file", "Discard")
      .then((choice) => this.decide(session, session.hunks.map((hunk) => hunk.index), choice === "Create file" ? "accepted" : "rejected"));
  }

  private async writeBuffer(session: Session, document: vscode.TextDocument): Promise<void> {
    if (session.settling || this.sessions.get(session.key) !== session) return;
    session.render = renderReview(session.request.baseline, session.hunks, session.decisions);
    await setText(document, session.render.text);
    this.paint();
    this.lensEmitter.fire();
  }

  private decideHunk(target: unknown, index: number | undefined, decision: HunkDecision): void {
    const session = this.target(target);
    if (session) this.decide(session, [index ?? this.hunkAtCursor(session)], decision);
  }

  private decideAll(target: unknown, decision: HunkDecision): void {
    const session = this.target(target);
    if (session) this.decide(session, session.hunks.map((hunk) => hunk.index), decision);
  }

  private decide(session: Session, indexes: number[], decision: HunkDecision): void {
    if (session.settling || this.sessions.get(session.key) !== session) return;
    for (const index of indexes) if (session.decisions[index] === "pending") session.decisions[index] = decision;
    this.stateEmitter.fire();
    const finished = session.decisions.every((d) => d !== "pending");
    const next = finished
      ? this.settle(session, false)
      : vscode.workspace.openTextDocument(session.request.uri).then((document) => this.writeBuffer(session, document));
    void Promise.resolve(next).catch((error: unknown) => vscode.window.showErrorMessage(`Anvil review failed: ${String(error)}`));
  }

  private async settle(session: Session, discard: boolean): Promise<void> {
    if (session.settling) return;
    session.settling = true;
    const { request } = session;
    const decisions = discard ? session.decisions.map((): HunkDecision => "rejected") : session.decisions;
    const finalText = resolveText(request.baseline, session.hunks, decisions);
    let outcome = outcomeOf(request, session.hunks, decisions, finalText, discard);
    try {
      if (request.isNewFile) await this.settleNewFile(session, outcome.accepted > 0, finalText);
      else await this.settleInline(session, outcome.accepted > 0, finalText);
    } catch (error) {
      outcome = outcomeOf(request, session.hunks, [], request.baseline, true);
      void vscode.window.showErrorMessage(`Anvil could not finish the review of ${request.title}: ${String(error)}`);
    } finally {
      this.sessions.delete(session.key);
      this.paint();
      this.lensEmitter.fire();
      this.publish();
      session.done(outcome);
    }
  }

  private async settleInline(session: Session, apply: boolean, finalText: string): Promise<void> {
    const { request } = session;
    const document = await vscode.workspace.openTextDocument(request.uri);
    if (!apply) return restoreBaseline(document, request.baseline, session.wasDirty);
    await setText(document, finalText);
    if (!(await document.save())) {
      await setText(document, request.baseline);
      throw new Error("the file could not be saved");
    }
    this.ledger.record(request.changeSetId, request.uri, request.baseline, document.getText());
  }

  private async settleNewFile(session: Session, apply: boolean, finalText: string): Promise<void> {
    await closeTabsFor(session.proposalUri);
    if (!apply) return;
    await vscode.workspace.fs.writeFile(session.request.uri, new TextEncoder().encode(finalText));
    const document = await vscode.workspace.openTextDocument(session.request.uri);
    this.ledger.record(session.request.changeSetId, session.request.uri, undefined, document.getText());
    await vscode.window.showTextDocument(document, { preview: false });
  }

  private onSaved(document: vscode.TextDocument): void {
    const session = this.sessions.get(document.uri.toString());
    if (!session || session.request.isNewFile || session.settling) return;
    session.wasDirty = false;
    void vscode.window.showWarningMessage("Anvil review discarded because the file was saved mid-review; the original content was restored.");
    void this.settle(session, true);
  }

  private onTabsChanged(event: vscode.TabChangeEvent): void {
    for (const tab of event.closed) {
      if (!(tab.input instanceof vscode.TabInputTextDiff)) continue;
      const session = this.findSession(tab.input.modified.toString());
      if (session?.request.isNewFile) this.decide(session, session.hunks.map((hunk) => hunk.index), "rejected");
    }
  }

  private onEdited(event: vscode.TextDocumentChangeEvent): void {
    const session = this.sessions.get(event.document.uri.toString());
    if (!session || session.request.isNewFile || session.settling || event.contentChanges.length === 0) return;
    if (sameText(event.document.getText(), session.render.text)) return;
    void vscode.window.showWarningMessage(`${session.request.title}: the file was edited during review, so Anvil discarded its proposed changes.`);
    void this.settle(session, true);
  }

  private onClosed(document: vscode.TextDocument): void {
    const session = this.sessions.get(document.uri.toString());
    if (session && !session.request.isNewFile) void this.settle(session, true);
  }

  private target(arg: unknown): Session | undefined {
    if (arg instanceof vscode.Uri || typeof arg === "string") return this.findSession(arg.toString());
    const active = vscode.window.activeTextEditor?.document.uri.toString();
    return active ? this.findSession(active) : undefined;
  }

  private findSession(key: string): Session | undefined {
    return this.sessions.get(key) ?? [...this.sessions.values()].find((s) => s.proposalUri.toString() === key);
  }

  private hunkAtCursor(session: Session): number {
    const pending = session.render.hunkAnchors.filter((anchor) => session.decisions[anchor.index] === "pending");
    const editor = vscode.window.activeTextEditor;
    const line = editor?.document.uri.toString() === session.key ? editor.selection.active.line : 0;
    const span = (index: number) => Math.max(1, session.hunks[index].baselineLines.length + session.hunks[index].proposalLines.length);
    const hit =
      pending.find((a) => line >= a.line && line < a.line + span(a.index)) ??
      pending.find((a) => a.line >= line) ??
      pending[pending.length - 1];
    return hit.index;
  }

  private lenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const session = this.sessions.get(document.uri.toString());
    if (!session || session.settling || session.request.isNewFile || !sameText(document.getText(), session.render.text)) return [];
    const args = [session.key];
    const pending = session.decisions.filter((d) => d === "pending").length;
    const top = new vscode.Range(0, 0, 0, 0);
    const lenses = [
      new vscode.CodeLens(top, { title: "$(check-all) Accept all", command: "anvil.acceptAll", arguments: args }),
      new vscode.CodeLens(top, { title: "$(close-all) Reject all", command: "anvil.rejectAll", arguments: args }),
      new vscode.CodeLens(top, { title: `${pending} of ${session.hunks.length} changes pending`, command: "" }),
    ];
    const flags = flagHunks(session.hunks, session.request.fence);
    for (const anchor of session.render.hunkAnchors) {
      if (session.decisions[anchor.index] !== "pending") continue;
      const hunk = session.hunks[anchor.index];
      const at = new vscode.Range(anchor.line, 0, anchor.line, 0);
      lenses.push(
        new vscode.CodeLens(at, { title: "$(check) Accept", command: "anvil.acceptHunk", arguments: [session.key, hunk.index] }),
        new vscode.CodeLens(at, { title: "$(close) Reject", command: "anvil.rejectHunk", arguments: [session.key, hunk.index] }),
        new vscode.CodeLens(at, { title: `+${hunk.added} −${hunk.removed}`, command: "" }),
      );
      const flag = flags[hunk.index];
      if (flag) lenses.push(new vscode.CodeLens(at, { title: `$(warning) ${flag}`, tooltip: "Anvil: this change is outside the area you asked about. Review it carefully.", command: "" }));
    }
    return lenses;
  }

  private paint(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const session = this.sessions.get(editor.document.uri.toString());
      const live = session && !session.settling && !session.request.isNewFile;
      editor.setDecorations(this.removedStyle, live ? session.render.removedLines.map(lineRange) : []);
      editor.setDecorations(this.addedStyle, live ? session.render.addedLines.map(lineRange) : []);
    }
  }

  private publish(): void {
    void vscode.commands.executeCommand("setContext", "anvil.reviewActive", this.sessions.size > 0);
    this.stateEmitter.fire();
  }
}

function outcomeOf(request: ReviewRequest, hunks: Hunk[], decisions: HunkDecision[], finalText: string, discarded: boolean): ReviewOutcome {
  const accepted = decisions.filter((d) => d === "accepted").length;
  const total = hunks.length;
  const status = discarded ? "discarded" : accepted === total ? "accepted" : accepted === 0 ? "rejected" : "partial";
  const path = vscode.workspace.asRelativePath(request.uri, false);
  return {
    status,
    accepted,
    rejected: total - accepted,
    total,
    finalText,
    rejectedPatch: finalText === request.proposal ? "" : formatPatch(path, finalText, request.proposal),
    stat: diffStat(request.baseline, finalText),
    scopeNote: discarded ? undefined : describeFlags(hunks, flagHunks(hunks, request.fence)),
  };
}

function lineRange(line: number): vscode.Range {
  return new vscode.Range(line, 0, line, 0);
}

async function setText(document: vscode.TextDocument, text: string): Promise<void> {
  if (sameText(document.getText(), text)) return;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange(document), text);
  if (!(await vscode.workspace.applyEdit(edit))) throw new Error(`could not update ${document.uri.fsPath}`);
}

async function restoreBaseline(document: vscode.TextDocument, baseline: string, wasDirty: boolean): Promise<void> {
  if (document.isClosed) return;
  await setText(document, baseline);
  if (wasDirty || !document.isDirty) return;
  if (!(await document.save())) throw new Error("the restored file could not be saved");
}

async function closeTabsFor(uri: vscode.Uri): Promise<void> {
  const key = uri.toString();
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputTextDiff && tab.input.modified.toString() === key);
  if (tabs.length > 0) await vscode.window.tabGroups.close(tabs);
}
