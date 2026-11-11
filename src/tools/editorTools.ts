import { exec } from "node:child_process";
import { createHash } from "node:crypto";
import { z } from "zod";
import { findReferences, findSymbol, searchCode } from "../context/codeSearch.ts";
import { renderRepoMap } from "../context/repoMap.ts";
import { estimateTokens } from "../context/tokens.ts";
import type { WorkspaceIndex } from "../context/workspaceIndex.ts";
import type { EditCoordinator } from "../agent/editCoordinator.ts";
import type { ContextReport } from "../shared/protocol.ts";
import type { ToolDefinition } from "./toolServer.ts";

export interface ToolServices {
  index: WorkspaceIndex;
  rgPath: string | undefined;
  edits: EditCoordinator;
  commandTimeoutMs: () => number;
  /** Extra environment for run_command (e.g. PYTHONPATH=src for src layouts), set without shell-specific syntax. */
  commandEnv?: () => Record<string, string>;
  currentContext: () => ContextReport | undefined;
  onFileRead: (path: string) => void;
  onCommandOutput: (command: string, output: string) => void;
  onCommandResult?: (command: string, exitCode: string) => void;
  finishTask?: (args: { summary: string; files_changed?: string[]; verification?: string; verified: boolean }) => string;
}

const MAX_READ_LINES = 400;
const MAX_COMMAND_OUTPUT_CHARS = 12_000;

export class ReadCache {
  private readonly seen = new Map<string, string>();
  savedTokens = 0;

  check(key: string, content: string): boolean {
    const digest = createHash("sha1").update(content).digest("hex");
    const repeated = this.seen.get(key) === digest;
    this.seen.set(key, digest);
    if (repeated) this.savedTokens += estimateTokens(content);
    return repeated;
  }

  clear(): void {
    this.seen.clear();
  }
}

export function createEditorTools(services: ToolServices, readCache: ReadCache): ToolDefinition[] {
  const readOnly = { readOnlyHint: true };
  return [
    {
      name: "repo_map",
      title: "Repository map",
      description: "Directory tree plus class/function signatures of the most relevant files. Call first on unfamiliar code. Example: {\"focus\": [\"src/flask/cli.py\"]}",
      inputSchema: {
        focus: z.array(z.string()).optional().describe("Workspace-relative files to expand with signatures"),
        max_tokens: z.number().int().min(200).max(4000).optional(),
      },
      annotations: readOnly,
      run: async (args) => {
        const focus = (args.focus as string[] | undefined) ?? services.currentContext()?.files.slice(0, 6).map((file) => file.path) ?? [];
        return renderRepoMap(services.index, focus, (args.max_tokens as number | undefined) ?? 1500);
      },
    },
    {
      name: "search_code",
      title: "Search code",
      description: "Search file contents with ripgrep (smart case). Results are grouped by file with line numbers. Example: {\"query\": \"def routes_command\"}",
      inputSchema: {
        query: z.string().min(1),
        regex: z.boolean().optional().describe("Treat query as a regular expression"),
        glob: z.string().optional().describe("Limit to files matching this glob, e.g. src/**/*.py"),
        max_results: z.number().int().min(1).max(200).optional(),
      },
      annotations: readOnly,
      run: (args) => searchCode(services.index, {
        query: String(args.query),
        regex: args.regex === true,
        glob: args.glob as string | undefined,
        maxResults: args.max_results as number | undefined,
      }, services.rgPath),
    },
    {
      name: "find_symbol",
      title: "Find symbol",
      description: "Find where a class, function or method is defined. Accepts an exact name or a pattern like *_command.",
      inputSchema: { name: z.string().min(1) },
      annotations: readOnly,
      run: async (args) => {
        const hits = findSymbol(services.index, String(args.name)).slice(0, 40);
        if (!hits.length) return `No definitions found for ${String(args.name)}.`;
        return hits.map((hit) => `${hit.path}:${hit.line}  ${hit.signature}`).join("\n");
      },
    },
    {
      name: "find_references",
      title: "Find references",
      description: "Find word-bounded usages of an identifier across the workspace.",
      inputSchema: { name: z.string().min(1) },
      annotations: readOnly,
      run: (args) => findReferences(services.index, String(args.name), services.rgPath),
    },
    {
      name: "read_file",
      title: "Read file",
      description: `Read a workspace file with line numbers, at most ${MAX_READ_LINES} lines per call. Re-reading an unchanged range returns a short note instead of the text; pass fresh=true if you no longer have it.`,
      inputSchema: {
        path: z.string().min(1),
        start_line: z.number().int().min(1).optional(),
        end_line: z.number().int().min(1).optional(),
        fresh: z.boolean().optional(),
      },
      annotations: readOnly,
      run: async (args) => {
        const path = String(args.path).replaceAll("\\", "/").replace(/^\.\//, "");
        const content = await services.index.read(path);
        const lines = content.split(/\r?\n/);
        const start = Math.max(1, (args.start_line as number | undefined) ?? 1);
        const end = Math.min(lines.length, (args.end_line as number | undefined) ?? start + MAX_READ_LINES - 1, start + MAX_READ_LINES - 1);
        const body = lines.slice(start - 1, end).map((line, offset) => `${String(start + offset).padStart(5)}  ${line}`).join("\n");
        services.onFileRead(path);
        if (args.fresh !== true && readCache.check(`${path}:${start}-${end}`, body)) {
          return `${path} lines ${start}-${end} are unchanged since you last read them in this session. Pass fresh=true to receive them again.`;
        }
        const more = end < lines.length ? `\n… ${lines.length - end} more lines. Read with start_line=${end + 1}.` : "";
        return `${path} (${lines.length} lines)\n${body}${more}`;
      },
    },
    {
      name: "explain_context",
      title: "Explain context selection",
      description: "Show which files Anvil pre-selected for this task, their role (edit target or reference) and why.",
      inputSchema: {},
      annotations: readOnly,
      run: async () => {
        const report = services.currentContext();
        if (!report) return "No context pack was attached to this turn.";
        const rows = report.files.map((file) => `- ${file.path} [${file.role}] ~${file.tokens} tok: ${file.reasons.join("; ")}`);
        return [report.strategy, `Budget ${report.usedTokens}/${report.budgetTokens} tokens.`, ...rows].join("\n");
      },
    },
    {
      name: "propose_edit",
      title: "Propose edit",
      description: "Replace old_string with new_string in a file. The user reviews every hunk before anything is written. old_string must match the file uniquely; include 2-3 surrounding lines. To create a file use create_file.",
      inputSchema: {
        path: z.string().min(1).describe("Workspace-relative path"),
        old_string: z.string().describe("Exact text to replace, copied from read_file output without line numbers"),
        new_string: z.string().describe("Replacement text"),
        replace_all: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false },
      run: (args) => services.edits.execute("propose_edit", args),
    },
    {
      name: "create_file",
      title: "Create file",
      description: "Create a new file with the given content. The user reviews it before it is written.",
      inputSchema: { path: z.string().min(1), content: z.string() },
      annotations: { readOnlyHint: false },
      run: (args) => services.edits.execute("create_file", args),
    },
    {
      name: "finish_task",
      title: "Finish task",
      description:
        "Call once when the request is complete. verified=true is accepted only if a test or check ran with run_command after your last accepted edit and passed; otherwise set verified=false and explain why in verification.",
      inputSchema: {
        summary: z.string().describe("What you changed, in one or two sentences"),
        files_changed: z.array(z.string()).optional(),
        verification: z.string().optional().describe("The command you ran and its result, or why you could not verify"),
        verified: z.boolean(),
      },
      annotations: readOnly,
      run: async (args) => services.finishTask?.({
        summary: String(args.summary ?? ""),
        files_changed: args.files_changed as string[] | undefined,
        verification: args.verification as string | undefined,
        verified: args.verified === true,
      }) ?? "Recorded.",
    },
    {
      name: "run_command",
      title: "Run command",
      description: "Run a shell command in the workspace root after the user approves it, e.g. tests. Returns exit code and output.",
      inputSchema: { command: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: true },
      run: (args) => runCommand(String(args.command), services),
    },
  ];
}

function runCommand(command: string, services: ToolServices): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { cwd: services.index.root, env: { ...process.env, ...services.commandEnv?.() }, timeout: services.commandTimeoutMs(), maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      const output = clip(`${stdout}${stderr ? `\n${stderr}` : ""}`.trim());
      services.onCommandOutput(command, output);
      const code = error ? (error.killed ? "timeout" : String(error.code ?? 1)) : "0";
      services.onCommandResult?.(command, code);
      resolve(`$ ${command}\nexit code: ${code}\n${output}`);
    });
  });
}

function clip(text: string): string {
  if (text.length <= MAX_COMMAND_OUTPUT_CHARS) return text;
  const half = MAX_COMMAND_OUTPUT_CHARS / 2;
  return `${text.slice(0, half)}\n… ${text.length - MAX_COMMAND_OUTPUT_CHARS} characters omitted …\n${text.slice(-half)}`;
}
