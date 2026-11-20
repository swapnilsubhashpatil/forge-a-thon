import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import * as vscode from "vscode";
import type { ChangeSetSummary } from "../shared/protocol.ts";
import { diffStat } from "./hunks.ts";

const KEPT_SETS = 50;

interface FileChange {
  uri: vscode.Uri;
  before: string | undefined;
  after: string;
  conflicted?: boolean;
  undone?: boolean;
}

interface ChangeSet {
  id: string;
  label: string;
  createdAt: number;
  kept?: boolean;
  files: Map<string, FileChange>;
}

interface StoredSet {
  id: string;
  label: string;
  createdAt: number;
  kept?: boolean;
  files: Array<Omit<FileChange, "uri"> & { uri: string }>;
}

export interface UndoResult {
  restored: string[];
  skipped: string[];
}

export class ChangeLedger {
  private readonly sets: ChangeSet[] = [];
  private readonly onChange: (sets: ChangeSetSummary[]) => void;
  private readonly file: string | undefined;
  private saving: Promise<void> = Promise.resolve();

  constructor(onChange: (sets: ChangeSetSummary[]) => void, file?: string) {
    this.onChange = onChange;
    this.file = file;
  }

  async load(): Promise<void> {
    if (!this.file) return;
    let stored: StoredSet[];
    try {
      stored = JSON.parse(await readFile(this.file, "utf8")) as StoredSet[];
    } catch {
      return;
    }
    this.sets.unshift(...stored.map((set) => ({
      ...set,
      files: new Map(set.files.map((change) => [change.uri, { ...change, uri: vscode.Uri.parse(change.uri) }])),
    })));
    this.onChange(this.summaries());
  }

  saved(): Promise<void> {
    return this.saving;
  }

  begin(label: string): string {
    const id = randomUUID();
    this.sets.push({ id, label, createdAt: Date.now(), files: new Map() });
    return id;
  }

  record(setId: string, uri: vscode.Uri, before: string | undefined, after: string): void {
    const set = this.find(setId);
    if (!set) throw new Error(`Unknown change set ${setId}`);
    const key = uri.toString();
    const previous = set.files.get(key);
    const conflicted = previous ? previous.conflicted === true || previous.after !== before : false;
    set.files.set(key, { uri, before: previous ? previous.before : before, after, conflicted });
    this.emit();
  }

  hasWrites(setId: string): boolean {
    return (this.find(setId)?.files.size ?? 0) > 0;
  }

  keep(setIds: string[]): void {
    for (const id of setIds) {
      const set = this.find(id);
      if (set) set.kept = true;
    }
    this.emit();
  }

  before(setId: string, path: string): string | undefined {
    return [...(this.find(setId)?.files.values() ?? [])].find((change) => relativePath(change.uri) === path)?.before;
  }

  touches(setId: string, path: string): boolean {
    return [...(this.find(setId)?.files.values() ?? [])].some((change) => !change.undone && relativePath(change.uri) === path);
  }

  async undo(setId: string): Promise<UndoResult> {
    const set = this.find(setId);
    const result: UndoResult = { restored: [], skipped: [] };
    if (!set) return result;
    const edit = new vscode.WorkspaceEdit();
    const restored: FileChange[] = [];
    const saves: Array<{ change: FileChange; document: vscode.TextDocument }> = [];
    for (const change of set.files.values()) {
      if (change.undone) continue;
      const path = relativePath(change.uri);
      const document = change.conflicted ? undefined : await openDocument(change.uri);
      if (document && document.getText() === change.before) {
        change.undone = true;
        result.restored.push(path);
        continue;
      }
      if (!document || document.getText() !== change.after) {
        result.skipped.push(path);
        continue;
      }
      if (change.before === undefined) edit.deleteFile(change.uri, { ignoreIfNotExists: true });
      else {
        edit.replace(change.uri, fullRange(document), change.before);
        saves.push({ change, document });
      }
      restored.push(change);
    }
    if (restored.length && !(await vscode.workspace.applyEdit(edit))) {
      result.skipped.push(...restored.map((change) => relativePath(change.uri)));
      return result;
    }
    const saved = await Promise.all(saves.map(({ document }) => document.save()));
    const unsaved = new Set(saves.filter((_, i) => !saved[i]).map(({ change }) => change));
    for (const change of restored) {
      if (unsaved.has(change)) result.skipped.push(relativePath(change.uri));
      else {
        change.undone = true;
        result.restored.push(relativePath(change.uri));
      }
    }
    this.emit();
    return result;
  }

  async undoLast(): Promise<UndoResult | undefined> {
    const last = [...this.sets].reverse().find((set) => set.files.size > 0 && !isUndone(set));
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
        undone: isUndone(set),
        kept: set.kept,
        files: [...set.files.values()].map((change) => ({
          path: relativePath(change.uri),
          ...diffStat(change.before ?? "", change.after),
          undone: change.undone,
        })),
      }));
  }

  private find(setId: string): ChangeSet | undefined {
    return this.sets.find((set) => set.id === setId);
  }

  private emit(): void {
    this.onChange(this.summaries());
    this.save();
  }

  private save(): void {
    const file = this.file;
    if (!file) return;
    const stored: StoredSet[] = this.sets
      .filter((set) => set.files.size > 0)
      .slice(-KEPT_SETS)
      .map((set) => ({ ...set, files: [...set.files.values()].map((change) => ({ ...change, uri: change.uri.toString() })) }));
    const json = JSON.stringify(stored);
    this.saving = this.saving
      .then(() => mkdir(dirname(file), { recursive: true }))
      .then(() => writeFile(file, json))
      .catch(() => undefined);
  }
}

function isUndone(set: ChangeSet): boolean {
  return set.files.size > 0 && [...set.files.values()].every((change) => change.undone);
}

function relativePath(uri: vscode.Uri): string {
  return vscode.workspace.asRelativePath(uri, false).replaceAll("\\", "/");
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
