/**
 * M2: subagents explore, the main agent edits (Cognition, opencode `explore`, Claude Code Explore). TrueForge gives
 * subagents the parent's tools, so Anvil answers their approval requests itself: writes are always denied, and
 * commands only when they are read-only inspection (opencode keeps shell for explorers too).
 */
const READ_ONLY_COMMANDS = [
  /^git\s+(log|diff|show|status|blame|grep|ls-files)\b/,
  /^(rg|grep|findstr|ls|dir|cat|type|head|tail|wc|tree)\b/,
];

const WRITE_TOOLS = new Set(["propose_edit", "create_file"]);

/** Undefined when the call may go ahead; otherwise the reason sent back to the subagent. */
export function subagentDenial(name: string, args: Record<string, unknown>): string | undefined {
  if (WRITE_TOOLS.has(name)) {
    return "Subagents are read-only in Anvil: do not edit. Return the relevant file paths and line numbers with a one-line reason each, and the main agent will make the change.";
  }
  if (name === "run_command") {
    const command = String(args.command ?? "").trim();
    const chained = /[;&|><`$]/.test(command);
    if (chained || !READ_ONLY_COMMANDS.some((pattern) => pattern.test(command))) {
      return "Subagents may only run read-only inspection commands (git log/diff/show/status, rg, ls, dir, cat). Return your findings; the main agent runs tests and other commands.";
    }
  }
  return undefined;
}
