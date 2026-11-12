import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import * as vscode from "vscode";
import { applyReplacement } from "../edits/editMatcher.ts";
import type { ReviewController, ReviewOutcome } from "../edits/reviewController.ts";
import type { DiffStat } from "../shared/protocol.ts";
import type { ScopeFence } from "../edits/scopeFence.ts";
import { NEW_BASELINE, STALE_HINT } from "../edits/feedback.ts";

export const EDIT_TOOLS = new Set(["propose_edit", "create_file"]);

export type EditResult =
  | { ok: true; path: string; outcome: ReviewOutcome }
  | { ok: false; path: string; reason: string };

export class EditCoordinator {
  private readonly root: vscode.Uri;
  private readonly review: ReviewController;
  private readonly results = new Map<string, Promise<EditResult>>();
  private readonly fileQueue = new Map<string, Promise<unknown>>();
  private readonly onApplied: (path: string, stat: DiffStat) => void;
  private currentSet = "";
  private generation = 0;
  private cancelled = false;
  /** G2: returns the expected area for an edit to an existing file, if any. */
  fenceFor: (path: string) => ScopeFence | undefined = () => undefined;
  /** G3: grounding check for a file, if its language is supported. */
  groundingFor: (path: string) => ((addedText: string, proposal: string) => string[]) | undefined = () => undefined;

  constructor(root: vscode.Uri, review: ReviewController, onApplied: (path: string, stat: DiffStat) => void) {
    this.root = root;
    this.review = review;
    this.onApplied = onApplied;
  }

  get changeSetId(): string {
    return this.currentSet;
  }

  set changeSetId(id: string) {
    this.currentSet = id;
    this.cancelled = false;
  }

  beginTurn(changeSetId: string): void {
    this.changeSetId = changeSetId;
  }

  cancelPending(): void {
    this.generation++;
    this.cancelled = true;
  }

  resolve(tool: string, args: Record<string, unknown>): Promise<EditResult> {
    const key = callKey(tool, args);
    const cached = this.results.get(key);
    if (cached) return cached;
    const pending = this.run(tool, args);
    this.results.set(key, pending);
    const evict = () => {
      if (this.results.get(key) === pending) this.results.delete(key);
    };
    pending.then((result) => {
      if (!result.ok || result.outcome.accepted === 0) evict();
    }, evict);
    return pending;
  }

  async execute(tool: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.resolve(tool, args);
    this.drop(tool, args);
    return describeForModel(result);
  }

  denialReason(result: EditResult): string | undefined {
    if (!result.ok) return result.reason;
    if (result.outcome.accepted > 0 || isNoChange(result.outcome)) return undefined;
    return describeForModel(result);
  }

  drop(tool: string, args: Record<string, unknown>): void {
    this.results.delete(callKey(tool, args));
  }

  forget(): void {
    this.results.clear();
  }

  private run(tool: string, args: Record<string, unknown>): Promise<EditResult> {
    const path = normalizePath(args.path);
    const generation = this.generation;
    const changeSetId = this.changeSetId;
    const run = (this.fileQueue.get(path) ?? Promise.resolve()).then(() => this.apply(tool, args, path, generation, changeSetId));
    const tail = run.catch(() => undefined);
    this.fileQueue.set(path, tail);
    void tail.then(() => {
      if (this.fileQueue.get(path) === tail) this.fileQueue.delete(path);
    });
    return run;
  }

  private async apply(tool: string, args: Record<string, unknown>, path: string, generation: number, changeSetId: string): Promise<EditResult> {
    if (!isRelativeInside(path)) return { ok: false, path, reason: `Path "${path}" is outside the workspace. Use a workspace-relative path.` };
    const uri = vscode.Uri.joinPath(this.root, ...path.split("/"));
    if (!(await resolvesInside(this.root.fsPath, uri.fsPath))) return { ok: false, path, reason: "Path resolves outside the workspace" };
    if (isDirty(uri) && !this.review.isReviewing(uri)) {
      return { ok: false, path, reason: `${path} has unsaved changes in the editor; ask the user to save or revert it first` };
    }

    let baseline: string | undefined;
    try {
      baseline = await readIfExists(uri);
    } catch {
      return { ok: false, path, reason: "file exists but is not a text file" };
    }
    const proposal = propose(tool, args, path, baseline);
    if (typeof proposal !== "string") return proposal;

    if (baseline !== undefined && proposal === baseline) return { ok: true, path, outcome: unchanged(baseline, "accepted") };
    if (this.cancelled || generation !== this.generation) return { ok: true, path, outcome: unchanged(baseline ?? "", "discarded") };

    const outcome = await this.review.review({
      uri,
      baseline: baseline ?? "",
      proposal,
      title: path,
      changeSetId,
      isNewFile: baseline === undefined,
      fence: baseline === undefined ? undefined : this.fenceFor(path),
      grounding: this.groundingFor(path),
    });
    if (outcome.accepted > 0) this.onApplied(path, outcome.stat);
    return { ok: true, path, outcome };
  }
}

function propose(tool: string, args: Record<string, unknown>, path: string, baseline: string | undefined): string | EditResult {
  if (tool === "create_file") return String(args.content ?? "");
  const oldString = String(args.old_string ?? "");
  const newString = String(args.new_string ?? "");
  if (baseline === undefined) {
    return oldString ? { ok: false, path, reason: `File ${path} does not exist. Use create_file to create it.` } : newString;
  }
  const match = applyReplacement(baseline, oldString, newString, args.replace_all === true);
  return match.ok ? match.text : { ok: false, path, reason: `${match.reason}\n${match.hint}\n${STALE_HINT}` };
}

function unchanged(text: string, status: "accepted" | "discarded"): ReviewOutcome {
  return { status, accepted: 0, rejected: 0, total: 0, finalText: text, rejectedPatch: "", stat: { added: 0, removed: 0 } };
}

function isNoChange(outcome: ReviewOutcome): boolean {
  return outcome.total === 0 && outcome.status !== "discarded";
}

function currentText(path: string, region: string | undefined): string[] {
  return region ? [`Current text of ${path} around those changes:`, "```", region, "```"] : [];
}

function describeForModel(result: EditResult): string {
  if (!result.ok) return `Edit not applied: ${result.reason}`;
  const text = describeOutcome(result);
  return result.outcome.scopeNote ? `${text}\n${result.outcome.scopeNote}` : text;
}

function describeOutcome(result: EditResult & { ok: true }): string {
  const { outcome, path } = result;
  const stat = `+${outcome.stat.added} −${outcome.stat.removed}`;
  if (isNoChange(outcome)) return `No changes: the proposed text for ${path} is identical to the current file.`;
  switch (outcome.status) {
    case "accepted":
      return `Applied to ${path} (${stat}). The user accepted all ${outcome.total} change(s).`;
    case "partial":
      return [
        `Partially applied to ${path} (${stat}): the user accepted ${outcome.accepted} of ${outcome.total} change(s) and rejected ${outcome.rejected}.`,
        NEW_BASELINE,
        "Rejected changes (not applied, do not re-propose them unless the user asks):",
        "```diff",
        outcome.rejectedPatch.trim(),
        "```",
        ...currentText(path, outcome.currentRegion),
      ].join("\n");
    case "rejected":
      return [
        `The user rejected every change to ${path}. Nothing was written. This was the user's decision, not a tool failure: ask what they want instead of retrying the same edit.`,
        "```diff",
        outcome.rejectedPatch.trim(),
        "```",
        ...currentText(path, outcome.currentRegion),
      ].join("\n");
    case "discarded":
      return `The edit to ${path} was discarded before review finished. Nothing was written.`;
  }
}

function normalizePath(value: unknown): string {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function callKey(tool: string, args: Record<string, unknown>): string {
  const path = normalizePath(args.path);
  const fields = tool === "create_file" ? [path, args.content] : [path, args.old_string, args.new_string, args.replace_all === true];
  return `${tool}:${JSON.stringify(fields)}`;
}

function isRelativeInside(path: string): boolean {
  return Boolean(path) && !path.startsWith("/") && !/^[a-zA-Z]:/.test(path) && !path.split("/").includes("..");
}

async function resolvesInside(root: string, target: string): Promise<boolean> {
  try {
    const rel = relative(await realpath(root), await nearestRealpath(target));
    return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
  } catch {
    return false;
  }
}

async function nearestRealpath(target: string): Promise<string> {
  try {
    return await realpath(target);
  } catch (error) {
    const parent = dirname(target);
    if (parent === target) throw error;
    return join(await nearestRealpath(parent), basename(target));
  }
}

function isDirty(uri: vscode.Uri): boolean {
  const key = uri.toString();
  return vscode.workspace.textDocuments.some((document) => document.uri.toString() === key && document.isDirty);
}

async function readIfExists(uri: vscode.Uri): Promise<string | undefined> {
  try {
    await vscode.workspace.fs.stat(uri);
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") return undefined;
    throw error;
  }
  return (await vscode.workspace.openTextDocument(uri)).getText();
}
