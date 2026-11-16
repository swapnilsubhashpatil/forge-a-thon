export interface ToolCallView {
  title: string;
  detail?: string;
  path?: string;
}

export function parseArguments(rawName: string, rawArguments: string): { name: string; args: Record<string, unknown> } {
  let args: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rawArguments || "{}");
    if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
  } catch {
    args = {};
  }
  if (rawName === "call_tool" && typeof args.tool_name === "string") {
    const inner = args.arguments;
    const innerArgs = typeof inner === "string" ? parseArguments("", inner).args : (inner as Record<string, unknown> | undefined) ?? {};
    return { name: args.tool_name, args: innerArgs };
  }
  return { name: rawName.split(/__|\./).pop() ?? rawName, args };
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text ?? "") : ""))
      .join("");
  }
  return "";
}

export function describeToolCall(name: string, args: Record<string, unknown>): ToolCallView {
  const path = typeof args.path === "string" ? args.path : undefined;
  const base = path ? path.split("/").pop() ?? path : "";
  switch (name) {
    case "read_file": {
      const range = args.start_line ? `lines ${String(args.start_line)}–${String(args.end_line ?? "end")}` : undefined;
      return { title: `Read ${base}`, detail: range, path };
    }
    case "search_code":
      return { title: `Searched “${String(args.query ?? "")}”`, detail: typeof args.glob === "string" ? args.glob : undefined };
    case "find_symbol":
      return { title: `Located ${String(args.name ?? "symbol")}` };
    case "find_references":
      return { title: `Found usages of ${String(args.name ?? "")}` };
    case "repo_map":
      return { title: "Mapped repository", detail: Array.isArray(args.focus) ? args.focus.join(", ") : undefined };
    case "explain_context":
      return { title: "Reviewed context selection" };
    case "propose_edit":
      return { title: `Edit ${base}`, path };
    case "create_file":
      return { title: `Create ${base}`, path };
    case "run_command":
      return { title: "Run command", detail: typeof args.command === "string" ? args.command : undefined };
    case "create_sub_agent":
      return { title: "Started subagent", detail: typeof args.title === "string" ? args.title : undefined };
    default:
      return { title: name.replaceAll("_", " ") };
  }
}
