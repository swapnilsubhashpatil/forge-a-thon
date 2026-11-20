import "./fonts.ts";
import "./styles.css";
import { createRoot } from "react-dom/client";
import type { ChatState, HostMessage, MentionItem, WebviewMessage } from "../../src/shared/protocol.ts";
import { App } from "./App.tsx";

const darkModern: Record<string, string> = {
  "--vscode-font-family": "-apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', sans-serif",
  "--vscode-font-size": "13px",
  "--vscode-editor-font-family": "Consolas, 'Courier New', monospace",
  "--vscode-foreground": "#cccccc",
  "--vscode-descriptionForeground": "#9d9d9d",
  "--vscode-errorForeground": "#f85149",
  "--vscode-focusBorder": "#0078d4",
  "--vscode-editor-background": "#1f1f1f",
  "--vscode-editor-foreground": "#cccccc",
  "--vscode-sideBar-background": "#181818",
  "--vscode-editorWidget-background": "#202020",
  "--vscode-widget-border": "#313131",
  "--vscode-input-background": "#313131",
  "--vscode-input-foreground": "#cccccc",
  "--vscode-input-border": "#3c3c3c",
  "--vscode-button-background": "#0078d4",
  "--vscode-button-foreground": "#ffffff",
  "--vscode-button-hoverBackground": "#026ec1",
  "--vscode-button-secondaryBackground": "#313131",
  "--vscode-button-secondaryForeground": "#cccccc",
  "--vscode-button-secondaryHoverBackground": "#3c3c3c",
  "--vscode-list-hoverBackground": "#2a2d2e",
  "--vscode-list-activeSelectionBackground": "#04395e",
  "--vscode-list-activeSelectionForeground": "#ffffff",
  "--vscode-textLink-foreground": "#4daafc",
  "--vscode-textCodeBlock-background": "#2b2b2b",
  "--vscode-gitDecoration-addedResourceForeground": "#81b88b",
  "--vscode-gitDecoration-deletedResourceForeground": "#c74e39",
  "--vscode-charts-blue": "#3794ff",
  "--vscode-charts-green": "#89d185",
  "--vscode-charts-yellow": "#cca700",
  "--vscode-charts-orange": "#d18616",
  "--vscode-charts-red": "#f14c4c",
  "--vscode-charts-purple": "#b180d7",
  "--vscode-badge-background": "#616161",
  "--vscode-badge-foreground": "#f8f8f8",
  "--vscode-editor-selectionBackground": "#264f78",
  "--vscode-scrollbarSlider-background": "rgba(121, 121, 121, 0.4)",
  "--vscode-scrollbarSlider-hoverBackground": "rgba(100, 100, 100, 0.7)",
};

for (const [name, value] of Object.entries(darkModern)) document.documentElement.style.setProperty(name, value);

const now = Date.now();
const primary = "openai-main/gpt-5";
const fallback = "google-gemini/gemini-2.5-pro";

let state: ChatState = {
  conversationId: "conv-2",
  mode: "agent",
  workspace: { name: "flask", files: 214, user: "Swapnil" },
  mcpServers: [
    {
      name: "github",
      url: "https://api.githubcopilot.com/mcp/",
      description: "Issues, pull requests and code search",
      enabled: true,
      status: "ok",
      tools: ["search_issues", "get_issue", "create_issue", "list_pull_requests", "get_pull_request", "search_code"],
    },
    { name: "docs-search", url: "http://localhost:9300/mcp", enabled: false, status: "error", error: "connect ECONNREFUSED 127.0.0.1:9300" },
  ],
  skills: [
    { name: "release-notes", description: "Use when writing release notes from merged PRs", source: "project", path: ".anvil/skills/release-notes/SKILL.md", enabled: true },
    { name: "flask-cli", description: "Use when adding or changing a flask CLI command", source: "project", path: ".claude/skills/flask-cli/SKILL.md", enabled: true },
    { name: "commit-writer", description: "Write Conventional Commit messages", source: "user", path: "~/.claude/skills/commit-writer/SKILL.md", enabled: false },
  ],
  settings: {
    chain: [primary, fallback, "anthropic-main/claude-sonnet-4-5"],
    reasoningEffort: "default",
    reviewMode: "review",
    autoApprove: ["pytest", "npm test"],
    budgetTokens: 6000,
  },
  history: [
    { id: "conv-2", title: "Add flask config command", updatedAt: now - 20_000, turns: 2, model: fallback, edits: 3 },
    { id: "conv-1", title: "Why does the dev server reload twice?", updatedAt: now - 26 * 3_600_000, turns: 4, model: primary, edits: 0 },
  ],
  pendingReviews: [{ path: "src/flask/cli.py", hunks: 2, added: 12, removed: 1 }],
  editorSelection: { path: "src/flask/cli.py", startLine: 57, endLine: 64, label: "cli.py:57-64" },
  availableModels: [primary, fallback, "anthropic-main/claude-sonnet-4-5", "ollama/qwen3-8b"],
  sessionId: "ses_01JD8K2M4QX7R9TF3B6WZ1PN5H",
  sessionUrl: "http://localhost:8790/sessions/ses_01JD8K2M4QX7R9TF3B6WZ1PN5H",
  harness: { state: "ready", url: "http://localhost:8790" },
  queue: [
    { id: "note-1", text: "also mask keys containing CREDENTIAL", mentions: [], status: "delivered", deliveredAtStep: 4 },
    { id: "note-2", text: "then add a changelog entry", mentions: [], status: "queued" },
  ],
  models: [
    { model: primary, state: "cooling", coolingUntil: now + 47_000, lastError: "401 Unauthorized: invalid API key" },
    { model: fallback, state: "healthy" },
    { model: "anthropic-main/claude-sonnet-4-5", state: "unknown" },
  ],
  activeModel: fallback,
  busy: true,
  changeSets: [
    {
      id: "cs1",
      label: "Add flask config command",
      createdAt: now - 20_000,
      undone: false,
      files: [
        { path: "src/flask/cli.py", added: 38, removed: 2 },
        { path: "tests/test_cli.py", added: 27, removed: 0 },
        { path: "docs/cli.rst", added: 14, removed: 0 },
      ],
    },
  ],
  turns: [
    {
      id: "t1",
      prompt: "Explain how the CLI loads the app",
      mentions: ["src/flask/cli.py", "src/flask/helpers.py#get_debug_flag"],
      status: "done",
      model: primary,
      usage: { input: 8420, output: 612, cached: 5120 },
      startedAt: now - 300_000,
      endedAt: now - 288_400,
      steps: [
        {
          kind: "text",
          id: "t1s1",
          text: "`ScriptInfo.load_app()` resolves the app in order: an explicit `--app` import string, then `FLASK_APP`, then `wsgi.py` / `app.py` in the working directory. The result is cached on the `ScriptInfo` instance.",
        },
      ],
    },
    {
      id: "t2",
      prompt:
        "Add a new built-in CLI command flask config that prints the loaded application’s configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as \"***\". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.",
      mentions: [],
      status: "paused",
      model: fallback,
      usage: { input: 24310, output: 2875, cached: 11200 },
      startedAt: now - 42_000,
      context: {
        strategy:
          "BM25 over symbols and docs, boosted by import graph and test/doc companions; packed by score until the 6k budget.",
        budgetTokens: 6000,
        usedTokens: 5240,
        files: [
          {
            path: "src/flask/cli.py",
            role: "target",
            score: 0.94,
            tokens: 2310,
            reasons: ["path match cli", "sibling routes_command", "defines FlaskGroup"],
          },
          {
            path: "tests/test_cli.py",
            role: "target",
            score: 0.81,
            tokens: 1420,
            reasons: ["test companion of cli.py"],
          },
          { path: "docs/cli.rst", role: "target", score: 0.66, tokens: 880, reasons: ["documents built-in commands"] },
          {
            path: "src/flask/config.py",
            role: "reference",
            score: 0.52,
            tokens: 630,
            reasons: ["defines Config", "imported by app.py"],
          },
        ],
        fetched: ["src/flask/json/provider.py"],
        read: ["src/flask/cli.py", "tests/test_cli.py", "docs/cli.rst", "src/flask/json/provider.py"],
        edited: ["src/flask/cli.py", "tests/test_cli.py", "docs/cli.rst"],
        live: { inputTokens: 21400, threshold: 60000, cacheReadTokens: 17900, compactions: 0 },
      },
      steps: [
        {
          kind: "notice",
          id: "n1",
          tone: "warning",
          text: "Primary model failed (401 Unauthorized). Switched to google-gemini/gemini-2.5-pro; workspace unchanged.",
          failover: { from: primary, to: fallback, reason: "401 Unauthorized" },
        },
        { kind: "reasoning", id: "r1", text: "routes_command is the closest sibling: a click command registered on FlaskGroup with with_appcontext. I'll mirror it, add a masked JSON dump, then a test in test_cli.py and an entry in docs/cli.rst." },
        { kind: "tool", id: "a1", name: "repo_map", title: "Mapped repository", detail: "src/flask · 24 files", status: "done", output: "src/flask/cli.py\n  class FlaskGroup\n  def routes_command\n  def run_command\nsrc/flask/config.py\n  class Config" },
        { kind: "tool", id: "a2", name: "search_code", title: "Searched", detail: "“routes_command”", status: "done", output: "src/flask/cli.py:1043  @click.command(\"routes\", short_help=\"Show the routes for the app.\")\nsrc/flask/cli.py:1101  cli.add_command(routes_command)" },
        { kind: "tool", id: "a3", name: "read_file", title: "Read", path: "src/flask/json/provider.py", status: "done" },
        { kind: "subagent", id: "sa1", title: "Find how commands are documented", status: "done" },
        { kind: "tool", id: "a4", name: "read_file", title: "Read", path: "docs/cli.rst", status: "done", threadTitle: "Find how commands are documented" },
        { kind: "tool", id: "a5", name: "propose_edit", title: "Edited", path: "src/flask/cli.py", status: "done", diff: { added: 38, removed: 2 } },
        { kind: "tool", id: "a6", name: "propose_edit", title: "Edited", path: "tests/test_cli.py", status: "done", diff: { added: 27, removed: 0 } },
        { kind: "tool", id: "a7", name: "propose_edit", title: "Edited", path: "docs/cli.rst", status: "done", diff: { added: 14, removed: 0 } },
        {
          kind: "text",
          id: "x1",
          text: "Added `config_command` next to `routes_command` and registered it on `FlaskGroup`. Keys containing **SECRET**, **PASSWORD**, **TOKEN** or **KEY** are masked as `\"***\"`.\n\nNow running the CLI tests to verify:",
        },
        { kind: "tool", id: "a8", name: "run_command", title: "Running", detail: "pytest tests/test_cli.py -q", status: "awaiting-approval" },
        {
          kind: "approval",
          id: "ap1",
          toolCallId: "call_run_1",
          toolName: "run_command",
          title: "Run a command in the workspace",
          detail: "pytest tests/test_cli.py -q",
          status: "pending",
        },
      ],
    },
  ],
};

const mentionPool: MentionItem[] = [
  { kind: "file", label: "cli.py", path: "src/flask/cli.py" },
  { kind: "file", label: "test_cli.py", path: "tests/test_cli.py" },
  { kind: "file", label: "helpers.py", path: "src/flask/helpers.py" },
  { kind: "symbol", label: "get_debug_flag", path: "src/flask/helpers.py", line: 27, detail: "function" },
  { kind: "symbol", label: "FlaskGroup", path: "src/flask/cli.py", line: 531, detail: "class" },
];

function emit(message: HostMessage) {
  window.postMessage(message, "*");
}

function handle(message: WebviewMessage) {
  console.info("[webview → host]", message);
  switch (message.type) {
    case "ready":
      emit({ type: "state", state });
      emit({ type: "attach", attachment: { id: "term-1", kind: "terminal", label: "terminal: pytest -q (exit 1)", command: "pytest -q", exitCode: 1, text: "1 failed, 97 passed" } });
      break;
    case "pinSelection":
      emit({ type: "attach", attachment: { id: `sel-${Date.now()}`, kind: "selection", label: "cli.py:57-64", path: "src/flask/cli.py", startLine: 57, endLine: 64, text: "def config_command():" } });
      break;
    case "searchMentions": {
      const query = message.query.toLowerCase();
      const items = mentionPool.filter((item) => `${item.label} ${item.path}`.toLowerCase().includes(query));
      setTimeout(() => emit({ type: "mentionResults", requestId: message.requestId, items }), 30);
      break;
    }
    case "approve":
      state = {
        ...state,
        busy: false,
        turns: state.turns.map((turn) => ({
          ...turn,
          status: turn.id === "t2" ? "done" : turn.status,
          endedAt: turn.id === "t2" ? Date.now() : turn.endedAt,
          steps: turn.steps.map((step) => {
            if (step.kind === "approval") return { ...step, status: message.allow ? "allowed" : "denied" };
            if (step.id === "a8" && step.kind === "tool")
              return { ...step, status: message.allow ? "done" : "denied", output: message.allow ? "........................ 98 passed in 2.41s" : undefined };
            return step;
          }),
        })),
      };
      emit({ type: "state", state });
      break;
    case "newSession":
      state = { ...state, turns: [], busy: false, queue: [], changeSets: [], pendingReviews: [] };
      emit({ type: "state", state });
      break;
    case "setMode":
      state = { ...state, mode: message.mode };
      emit({ type: "state", state });
      break;
    case "updateSettings":
      state = { ...state, settings: { ...state.settings, ...message.patch } };
      emit({ type: "state", state });
      break;
    case "addMcpServer":
    case "testMcpServer": {
      const { name } = message;
      const existing = state.mcpServers.find((server) => server.name === name);
      const mcpServers = existing ? state.mcpServers : [...state.mcpServers, { name, url: message.type === "addMcpServer" ? message.url : "", enabled: true, status: "unknown" as const }];
      state = { ...state, mcpServers: mcpServers.map((server) => (server.name === name ? { ...server, status: "testing" } : server)) };
      emit({ type: "state", state });
      setTimeout(() => {
        state = { ...state, mcpServers: state.mcpServers.map((server) => (server.name === name ? { ...server, status: "ok", tools: ["search", "fetch"], error: undefined } : server)) };
        emit({ type: "state", state });
      }, 900);
      break;
    }
    case "removeMcpServer":
      state = { ...state, mcpServers: state.mcpServers.filter((server) => server.name !== message.name) };
      emit({ type: "state", state });
      break;
    case "toggleMcpServer":
      state = { ...state, mcpServers: state.mcpServers.map((server) => (server.name === message.name ? { ...server, enabled: message.enabled } : server)) };
      emit({ type: "state", state });
      break;
    case "undo":
      state = {
        ...state,
        changeSets: state.changeSets.map((set) => (set.id === message.changeSetId ? { ...set, undone: true } : set)),
      };
      emit({ type: "state", state });
      break;
  }
}

Object.assign(window, {
  acquireVsCodeApi: () => {
    let saved: unknown;
    return {
      postMessage: handle,
      getState: () => saved,
      setState: (next: unknown) => {
        saved = next;
      },
    };
  },
});

createRoot(document.getElementById("root")!).render(<App />);
