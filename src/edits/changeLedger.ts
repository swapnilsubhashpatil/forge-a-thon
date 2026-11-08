import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import type { ChangeSetSummary } from "../shared/protocol.ts";
import { diffStat } from "./hunks.ts";

interface FileChange {
  uri: vscode.Uri;
  before: string | undefined;
  after: string;
  conflicted?: boolean;
}

interface ChangeSet {
  id: string;
  label: string;
  createdAt: number;
  undone: boolean;
  files: Map<string, FileChange>;
}

export interface UndoResult {
  restored: string[];
  skipped: string[];
}

export class ChangeLedger {
  private readonly sets: ChangeSet[] = [];
  private readonly onChange: (sets: ChangeSetSummary[]) => void;

  constructor(onChange: (sets: ChangeSetSummary[]) => void) {
    this.onChange = onChange;
  }

  begin(label: string): string {
    const id = randomUUID();
    this.sets.push({ id, label, createdAt: Date.now(), undone: false, files: new Map() });
    return id;
  }

  record(setId: string, uri: vscode.Uri, before: string | undefined, after: string): void {
    const set = this.sets.find((s) => s.id === setId);
    if (!set) throw new Error(`Unknown change set ${setId}`);
    const key = uri.toString();
    const previous = set.files.get(key);
    const conflicted = previous ? previous.conflicted === true || previous.after !== before : false;
    set.files.set(key, { uri, before: previous ? previous.before : before, after, conflicted });
    this.emit();
  }

  hasWrites(setId: string): boolean {
    return (this.sets.find((s) => s.id === setId)?.files.size ?? 0) > 0;
  }

  async undo(setId: string): Promise<UndoResult> {
    const set = this.sets.find((s) => s.id === setId);
    const result: UndoResult = { restored: [], skipped: [] };
    if (!set || set.undone) return result;
    const edit = new vscode.WorkspaceEdit();
    const restoredDocs: Array<{ path: string; document: vscode.TextDocument }> = [];
    for (const change of set.files.values()) {
      const path = vscode.workspace.asRelativePath(change.uri, false);
      const document = change.conflicted ? undefined : await openDocument(change.uri);
      if (!document || document.getText() !== change.after) {
        result.skipped.push(path);
        continue;
      }
      if (change.before === undefined) {
        edit.deleteFile(change.uri, { ignoreIfNotExists: true });
      } else {
        edit.replace(change.uri, fullRange(document), change.before);
        restoredDocs.push({ path, document });
      }
      result.restored.push(path);
    }
    if (result.restored.length > 0 && !(await vscode.workspace.applyEdit(edit))) {
      return { restored: [], skipped: [...result.skipped, ...result.restored] };
    }
    const saved = await Promise.all(restoredDocs.map(({ document }) => document.save()));
    const unsaved = new Set(restoredDocs.filter((_, i) => !saved[i]).map(({ path }) => path));
    result.restored = result.restored.filter((path) => !unsaved.has(path));
    result.skipped.push(...unsaved);
    set.undone = result.restored.length > 0;
    this.emit();
    return result;
  }

  async undoLast(): Promise<UndoResult | undefined> {
    const last = [...this.sets].reverse().find((s) => !s.undone && s.files.size > 0);
    return last ? this.undo(last.id) : undefined;
  }

  summaries(): ChangeSetSummary[] {
    return this.sets
      .filter((set) => set.files.size > 0)
      .reverse()
      .map((set) => ({
        id: set.id,
        label: set.label,
        createdAt: set.createdAt,
        undone: set.undone,
        files: [...set.files.values()].map((change) => ({
          path: vscode.workspace.asRelativePath(change.uri, false),
          ...diffStat(change.before ?? "", change.after),
        })),
      }));
  }

  private emit(): void {
    this.onChange(this.summaries());
  }
}

async function openDocument(uri: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  try {
    return await vscode.workspace.openTextDocument(uri);
  } catch {
    return undefined;
  }
}

export function fullRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
}
