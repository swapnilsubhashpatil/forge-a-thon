import * as vscode from "vscode";
import { applyReplacement } from "../edits/editMatcher.ts";
import type { ReviewController, ReviewOutcome } from "../edits/reviewController.ts";
import type { DiffStat } from "../shared/protocol.ts";

export const EDIT_TOOLS = new Set(["propose_edit", "create_file"]);

export type EditResult =
  | { ok: true; path: string; outcome: ReviewOutcome }
  | { ok: false; path: string; reason: string };

export class EditCoordinator {
  private readonly root: vscode.Uri;
  private readonly review: ReviewController;
  private readonly results = new Map<string, Promise<EditResult>>();
  private readonly onApplied: (path: string, stat: DiffStat) => void;
  changeSetId = "";

  constructor(root: vscode.Uri, review: ReviewController, onApplied: (path: string, stat: DiffStat) => void) {
    this.root = root;
    this.review = review;
    this.onApplied = onApplied;
  }

  resolve(tool: string, args: Record<string, unknown>): Promise<EditResult> {
    const key = callKey(tool, args);
    let pending = this.results.get(key);
    if (!pending) {
      pending = this.run(tool, args);
      this.results.set(key, pending);
    }
    return pending;
  }

  async execute(tool: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.resolve(tool, args);
    this.results.delete(callKey(tool, args));
    return describeForModel(result);
  }

  denialReason(result: EditResult): string | undefined {
    if (!result.ok) return result.reason;
    if (result.outcome.accepted > 0 || result.outcome.total === 0) return undefined;
    return describeForModel(result);
  }

  forget(): void {
    this.results.clear();
  }

  private async run(tool: string, args: Record<string, unknown>): Promise<EditResult> {
    const path = String(args.path ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
    const uri = this.toUri(path);
    if (!uri) return { ok: false, path, reason: `Path "${path}" is outside the workspace. Use a workspace-relative path.` };

    const baseline = await readIfExists(uri);
    let proposal: string;
    if (tool === "create_file") {
      proposal = String(args.content ?? "");
    } else {
      const oldString = String(args.old_string ?? "");
      const newString = String(args.new_string ?? "");
      if (baseline === undefined) {
        if (oldString) return { ok: false, path, reason: `File ${path} does not exist. Use create_file to create it.` };
        proposal = newString;
      } else {
        const match = applyReplacement(baseline, oldString, newString, args.replace_all === true);
        if (!match.ok) return { ok: false, path, reason: `${match.reason}\n${match.hint}` };
        proposal = match.text;
      }
    }

    if (baseline !== undefined && proposal === baseline) {
      return { ok: true, path, outcome: { status: "accepted", accepted: 0, rejected: 0, total: 0, finalText: baseline, rejectedPatch: "", stat: { added: 0, removed: 0 } } };
    }

    const outcome = await this.review.review({
      uri,
      baseline: baseline ?? "",
      proposal,
      title: path,
      changeSetId: this.changeSetId,
      isNewFile: baseline === undefined,
    });
    if (outcome.accepted > 0) this.onApplied(path, outcome.stat);
    return { ok: true, path, outcome };
  }

  private toUri(path: string): vscode.Uri | undefined {
    if (!path || path.startsWith("/") || /^[a-zA-Z]:/.test(path) || path.split("/").includes("..")) return undefined;
    return vscode.Uri.joinPath(this.root, ...path.split("/"));
  }
}

function describeForModel(result: EditResult): string {
  if (!result.ok) return `Edit not applied: ${result.reason}`;
  const { outcome, path } = result;
  const stat = `+${outcome.stat.added} −${outcome.stat.removed}`;
  if (outcome.total === 0) return `No changes: the proposed text for ${path} is identical to the current file.`;
  switch (outcome.status) {
    case "accepted":
      return `Applied to ${path} (${stat}). The user accepted all ${outcome.total} change(s).`;
    case "partial":
      return [
        `Partially applied to ${path} (${stat}): the user accepted ${outcome.accepted} of ${outcome.total} change(s) and rejected ${outcome.rejected}.`,
        "Rejected changes (not applied, do not re-propose them unless the user asks):",
        "```diff",
        outcome.rejectedPatch.trim(),
        "```",
      ].join("\n");
    case "rejected":
      return `The user rejected every change to ${path}. Nothing was written. Ask what they want instead of retrying the same edit.\n\`\`\`diff\n${outcome.rejectedPatch.trim()}\n\`\`\``;
    case "discarded":
      return `The edit to ${path} was discarded before review finished. Nothing was written.`;
  }
}

function callKey(tool: string, args: Record<string, unknown>): string {
  return `${tool}:${JSON.stringify(Object.keys(args).sort().map((key) => [key, args[key]]))}`;
}

async function readIfExists(uri: vscode.Uri): Promise<string | undefined> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    return document.getText();
  } catch {
    return undefined;
  }
}
