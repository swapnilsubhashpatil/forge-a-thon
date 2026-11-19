const READ_ONLY_COMMANDS = [
  /^git\s+(log|diff|show|status|blame|grep|ls-files)\b/,
  /^(rg|grep|findstr|ls|dir|cat|type|head|tail|wc|tree)\b/,
];

const WRITE_TOOLS = new Set(["propose_edit", "create_file"]);

const CHAINED = /[;&|><`$\r\n]/;

export function subagentDenial(name: string, args: Record<string, unknown>): string | undefined {
  if (WRITE_TOOLS.has(name)) {
    return "Subagents are read-only in Anvil: do not edit. Return the relevant file paths and line numbers with a one-line reason each, and the main agent will make the change.";
  }
  if (name === "run_command") {
    const command = String(args.command ?? "").trim();
    if (CHAINED.test(command) || !READ_ONLY_COMMANDS.some((pattern) => pattern.test(command))) {
      return "Subagents may only run read-only inspection commands (git log/diff/show/status, rg, ls, dir, cat). Return your findings; the main agent runs tests and other commands.";
    }
  }
  return undefined;
}

export function isAutoApproved(command: string, prefixes: string[]): boolean {
  const trimmed = command.trim();
  if (CHAINED.test(trimmed)) return false;
  return prefixes.map((prefix) => prefix.trim()).some((prefix) => prefix && (trimmed === prefix || trimmed.startsWith(`${prefix} `)));
}
