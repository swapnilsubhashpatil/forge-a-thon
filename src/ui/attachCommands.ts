import * as vscode from "vscode";
import { selectionAttachment, terminalAttachment } from "../context/attachments.ts";
import type { Attachment } from "../shared/protocol.ts";

const MAX_CAPTURE_CHARS = 200_000;

interface Execution {
  command: string;
  output: string;
  exitCode?: number;
}

export function inWorkspace(uri: vscode.Uri, folder: vscode.Uri): boolean {
  return vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() === folder.toString();
}

export function selectedLines(selection: vscode.Selection): { startLine: number; endLine: number } {
  const startLine = selection.start.line;
  const endLine = selection.end.character === 0 && selection.end.line > startLine ? selection.end.line - 1 : selection.end.line;
  return { startLine, endLine };
}

export function selectionFromEditor(editor: vscode.TextEditor | undefined, folder: vscode.Uri): Attachment | undefined {
  if (!editor) return undefined;
  const path = vscode.workspace.asRelativePath(editor.document.uri, false).replaceAll("\\", "/");
  if (!inWorkspace(editor.document.uri, folder)) {
    void vscode.window.showWarningMessage("Anvil: only files inside the workspace can be added to the chat.");
    return undefined;
  }
  const selection = editor.selection;
  const { startLine, endLine } = selectedLines(selection);
  const range = selection.isEmpty
    ? editor.document.lineAt(startLine).range
    : new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length);
  return selectionAttachment(path, startLine + 1, endLine + 1, editor.document.getText(range));
}

export function registerAttachCommands(folder: vscode.Uri, attach: (attachment: Attachment) => Promise<void>): vscode.Disposable[] {
  const last = new Map<vscode.Terminal, Execution>();

  const capture = vscode.window.onDidStartTerminalShellExecution(async ({ terminal, execution }) => {
    const record: Execution = { command: execution.commandLine.value, output: "" };
    last.set(terminal, record);
    try {
      for await (const chunk of execution.read()) {
        if (record.output.length < MAX_CAPTURE_CHARS) record.output += chunk;
      }
    } catch {
    }
  });
  const ended = vscode.window.onDidEndTerminalShellExecution(({ terminal, execution, exitCode }) => {
    const record = last.get(terminal);
    if (record && record.command === execution.commandLine.value) record.exitCode = exitCode;
  });
  const closed = vscode.window.onDidCloseTerminal((terminal) => last.delete(terminal));

  const addSelection = vscode.commands.registerCommand("anvil.addSelectionToChat", async () => {
    const attachment = selectionFromEditor(vscode.window.activeTextEditor, folder);
    if (attachment) await attach(attachment);
  });

  const addTerminalSelection = vscode.commands.registerCommand("anvil.addTerminalSelectionToChat", async () => {
    const previous = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText("");
    await vscode.commands.executeCommand("workbench.action.terminal.copySelection");
    const text = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText(previous);
    if (!text.trim()) {
      void vscode.window.showInformationMessage("Anvil: select text in the terminal first, or use “Add Last Terminal Command to Chat”.");
      return;
    }
    await attach(terminalAttachment(text));
  });

  const addTerminalOutput = vscode.commands.registerCommand("anvil.addTerminalOutputToChat", async () => {
    const terminal = vscode.window.activeTerminal;
    const record = terminal ? last.get(terminal) : undefined;
    if (!record) {
      void vscode.window.showInformationMessage(
        "Anvil: no command captured in this terminal yet. Shell integration must be on (default for bash, zsh, pwsh); run the command again, or select the text and use “Add Terminal Selection to Chat”.",
      );
      return;
    }
    await attach(terminalAttachment(`$ ${record.command}\n${record.output}`, record.command, record.exitCode));
  });

  return [capture, ended, closed, addSelection, addTerminalSelection, addTerminalOutput];
}
