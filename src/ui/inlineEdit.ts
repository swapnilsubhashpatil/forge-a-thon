import * as vscode from "vscode";
import { estimateTokens } from "../context/tokens.ts";
import type { TurnRequest, TurnRunner } from "../agent/turnRunner.ts";

const SURROUNDING_LINES = 30;

export async function runInlineEdit(runner: TurnRunner, root: vscode.Uri): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage("Open a file and select the code to edit.");
    return;
  }
  if (runner.busy) {
    void vscode.window.showWarningMessage("Anvil is busy with another turn. Cancel it or wait for it to finish.");
    return;
  }
  const document = editor.document;
  const path = vscode.workspace.asRelativePath(document.uri, false).replaceAll("\\", "/");
  if (!document.uri.fsPath.startsWith(root.fsPath)) {
    void vscode.window.showWarningMessage("Inline edits work on files inside the open workspace.");
    return;
  }
  const selection = editor.selection.isEmpty ? document.lineAt(editor.selection.active.line).range : editor.selection;
  const firstLine = selection.start.line;
  const lastLine = selection.end.character === 0 && selection.end.line > firstLine ? selection.end.line - 1 : selection.end.line;

  const instruction = await vscode.window.showInputBox({
    title: `Anvil · Edit ${path}:${firstLine + 1}-${lastLine + 1}`,
    prompt: "Describe the change",
    placeHolder: "e.g. treat FLASK_DEBUG=off as false and update the docstring",
    ignoreFocusOut: true,
  });
  if (!instruction?.trim()) return;

  const request = inlineRequest(document, path, firstLine, lastLine, instruction.trim());

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Anvil · editing ${path}`, cancellable: true },
    async (_progress, token) => {
      const subscription = token.onCancellationRequested(() => void runner.cancel());
      try {
        await runner.run(request);
      } finally {
        subscription.dispose();
      }
    },
  );
}

export function inlineRequest(document: vscode.TextDocument, path: string, firstLine: number, lastLine: number, instruction: string): TurnRequest {
  const numbered = (from: number, to: number) => {
    const lines: string[] = [];
    for (let line = from; line <= to; line += 1) lines.push(`${String(line + 1).padStart(5)}  ${document.lineAt(line).text}`);
    return lines.join("\n");
  };
  const contextFrom = Math.max(0, firstLine - SURROUNDING_LINES);
  const contextTo = Math.min(document.lineCount - 1, lastLine + SURROUNDING_LINES);
  const message = [
    "Inline edit request.",
    `File: ${path} (${document.languageId})`,
    `Selected lines ${firstLine + 1}-${lastLine + 1}:`,
    "```",
    numbered(firstLine, lastLine),
    "```",
    `Surrounding context, lines ${contextFrom + 1}-${contextTo + 1}:`,
    "```",
    numbered(contextFrom, contextTo),
    "```",
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
