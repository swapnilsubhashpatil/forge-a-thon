import * as vscode from "vscode";
import type { Attachment } from "../shared/protocol.ts";
import { inWorkspace, selectionFromEditor } from "./attachCommands.ts";

const ASK = "anvil.askAboutSelection";

export function registerAskSelection(folder: vscode.Uri, attach: (attachment: Attachment) => Promise<void>): vscode.Disposable[] {
  const enabled = () => vscode.workspace.getConfiguration("anvil").get<boolean>("selection.askActions", true);

  const ask = vscode.commands.registerCommand(ASK, async () => {
    const attachment = selectionFromEditor(vscode.window.activeTextEditor, folder);
    if (attachment) await attach(attachment);
  });

  const actions = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" },
    {
      provideCodeActions(document, range) {
        if (!enabled() || range.isEmpty || !inWorkspace(document.uri, folder)) return [];
        const askAction = new vscode.CodeAction("Ask Anvil about this", vscode.CodeActionKind.Empty);
        askAction.command = { command: ASK, title: "Ask Anvil about this" };
        const edit = new vscode.CodeAction("Edit with Anvil…", vscode.CodeActionKind.RefactorRewrite);
        edit.command = { command: "anvil.inlineEdit", title: "Edit with Anvil" };
        return [askAction, edit];
      },
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.Empty, vscode.CodeActionKind.RefactorRewrite] },
  );

  const hover = vscode.languages.registerHoverProvider(
    { scheme: "file" },
    {
      provideHover(document, position) {
        const editor = vscode.window.activeTextEditor;
        if (!enabled() || !editor || editor.document !== document || !inWorkspace(document.uri, folder)) return undefined;
        const selection = editor.selection;
        if (selection.isEmpty || !selection.contains(position)) return undefined;
        const lines = selection.end.line - selection.start.line + 1;
        const markdown = new vscode.MarkdownString(
          `[$(comment-discussion) Ask Anvil about this](command:${ASK} "Add the ${lines} selected line${lines === 1 ? "" : "s"} to the chat")` +
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
