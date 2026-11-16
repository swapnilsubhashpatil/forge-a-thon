import * as vscode from "vscode";
import type { Attachment } from "../shared/protocol.ts";
import { selectionFromEditor } from "./attachCommands.ts";

const ASK = "anvil.askAboutSelection";

/**
 * "Ask about this": select code and an icon appears (the editor lightbulb, plus a link when hovering the selection).
 * Clicking it asks for a question; the question and the exact selected lines go to the agent panel, which opens.
 * Turn the icon and hover off with `anvil.selection.askActions`.
 */
export function registerAskSelection(
  folder: vscode.Uri,
  send: (question: string, attachment: Attachment) => Promise<void>,
): vscode.Disposable[] {
  const enabled = () => vscode.workspace.getConfiguration("anvil").get<boolean>("selection.askActions", true);
  const inWorkspace = (document: vscode.TextDocument) => document.uri.scheme === "file" && document.uri.fsPath.startsWith(folder.fsPath);

  const ask = vscode.commands.registerCommand(ASK, async () => {
    const attachment = selectionFromEditor(vscode.window.activeTextEditor, folder);
    if (!attachment) return;
    const question = await vscode.window.showInputBox({
      title: `Ask Anvil about ${attachment.label}`,
      prompt: "The selected lines are sent with your question.",
      placeHolder: "e.g. What does this function do? Why is this check here? How would I test it?",
      ignoreFocusOut: true,
    });
    if (!question?.trim()) return;
    await send(question.trim(), attachment);
  });

  // The lightbulb: VS Code shows it next to any selection that has code actions.
  const actions = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" },
    {
      provideCodeActions(document, range) {
        if (!enabled() || range.isEmpty || !inWorkspace(document)) return [];
        const askAction = new vscode.CodeAction("Ask Anvil about this", vscode.CodeActionKind.Empty);
        askAction.command = { command: ASK, title: "Ask Anvil about this" };
        const edit = new vscode.CodeAction("Edit with Anvil…", vscode.CodeActionKind.RefactorRewrite);
        edit.command = { command: "anvil.inlineEdit", title: "Edit with Anvil" };
        return [askAction, edit];
      },
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.Empty, vscode.CodeActionKind.RefactorRewrite] },
  );

  // Hovering the selected text offers the same action as a link.
  const hover = vscode.languages.registerHoverProvider(
    { scheme: "file" },
    {
      provideHover(document, position) {
        const editor = vscode.window.activeTextEditor;
        if (!enabled() || !editor || editor.document !== document || !inWorkspace(document)) return undefined;
        const selection = editor.selection;
        if (selection.isEmpty || !selection.contains(position)) return undefined;
        const lines = selection.end.line - selection.start.line + 1;
        const markdown = new vscode.MarkdownString(
          `[$(comment-discussion) Ask Anvil about this](command:${ASK} "Ask a question about the ${lines} selected line${lines === 1 ? "" : "s"}")` +
            ` · [$(edit) Edit with Anvil](command:anvil.inlineEdit "Change the selection with an instruction")`,
          true,
        );
        markdown.isTrusted = { enabledCommands: [ASK, "anvil.inlineEdit"] };
        return new vscode.Hover(markdown, selection);
      },
    },
  );

  return [ask, actions, hover];
}
