import type { Attachment } from "../shared/protocol.ts";
import { clipOutput, stripAnsi } from "../tools/commandRunner.ts";
import { estimateTokens } from "./tokens.ts";

/**
 * Code or terminal text the user explicitly sent to the chat. It is the strongest context signal there is, so it
 * goes ahead of Anvil's own context pack, with a separate budget so it can never crowd the pack out entirely.
 */
export const ATTACHMENT_BUDGET_TOKENS = 4_000;

export function selectionAttachment(path: string, startLine: number, endLine: number, text: string): Attachment {
  const name = path.split("/").pop() ?? path;
  return {
    id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "selection",
    label: startLine === endLine ? `${name}:${startLine}` : `${name}:${startLine}-${endLine}`,
    path,
    startLine,
    endLine,
    text,
  };
}

export function terminalAttachment(text: string, command?: string, exitCode?: number): Attachment {
  const label = command ? `terminal: ${command.length > 40 ? `${command.slice(0, 37)}…` : command}${exitCode === undefined ? "" : ` (exit ${exitCode})`}` : "terminal selection";
  return {
    id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "terminal",
    label,
    command,
    exitCode,
    text: clipOutput(stripAnsi(text).trim(), 1_500, 6_000),
  };
}

/** Renders attachments for the model, numbered like read_file for code so edits can cite exact lines. */
export function formatAttachments(attachments: Attachment[], budgetTokens = ATTACHMENT_BUDGET_TOKENS): { text: string; tokens: number } {
  if (!attachments.length) return { text: "", tokens: 0 };
  const nl = String.fromCharCode(10);
  const fence = "```";
  const blocks: string[] = [];
  let remaining = budgetTokens;
  for (const attachment of attachments) {
    let body = attachment.text;
    if (attachment.kind === "selection" && attachment.startLine !== undefined) {
      body = body.split(/\r?\n/).map((line, i) => `${String(attachment.startLine! + i).padStart(5)}  ${line}`).join(nl);
    }
    const header =
      attachment.kind === "selection"
        ? `Selected by the user: ${attachment.path} lines ${attachment.startLine}-${attachment.endLine}`
        : `Terminal output sent by the user${attachment.command ? ` (command: ${attachment.command}${attachment.exitCode === undefined ? "" : `, exit ${attachment.exitCode}`})` : ""}`;
    let block = `${header}${nl}${fence}${nl}${body}${nl}${fence}`;
    if (estimateTokens(block) > remaining) {
      const keep = Math.max(0, remaining * 4 - header.length - 40);
      if (keep < 200) break;
      block = `${header} (trimmed to fit)${nl}${fence}${nl}${body.slice(0, keep)}${nl}…${nl}${fence}`;
    }
    blocks.push(block);
    remaining -= estimateTokens(block);
  }
  const text = `<attachments>${nl}${blocks.join(nl + nl)}${nl}</attachments>${nl}${nl}`;
  return { text, tokens: estimateTokens(text) };
}
