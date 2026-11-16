# Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict, erasable syntax only) | VS Code extensions run on Node; one language for host, webview and tests. Rust was evaluated and rejected: the agent loop lives in TrueForge, so latency is network/model bound, and native binaries complicate packaging. The one hot path that benefits from native code (search) already uses VS Code's bundled ripgrep, which is Rust. |
| Agent harness | TrueForge 0.185.1 (`npx @truefoundry/trueforge`) + `@truefoundry/trueforge-sdk` 0.185.0 | Mandatory. Sessions, SSE turns, approvals, subagents, compaction. |
| Editor tools | MCP Streamable HTTP server inside the extension (`@modelcontextprotocol/sdk`), bound to 127.0.0.1 with a per-run bearer token | TrueForge attaches MCP servers by name; loopback requires `OUTBOUND_URL_ALLOWED_HOSTS`. |
| Diff | `diff` (jsdiff) | Hunk computation; review is rendered inline with decorations + CodeLens. |
| Webview | React 19, Vite 8, Tailwind CSS 4, VS Code codicons, react-markdown | Fast, theme-aware via VS Code CSS variables. The deprecated webview-ui-toolkit is avoided. |
| Bundling | esbuild (extension), Vite (webview) | Single-file bundles; VSIX ships no node_modules. |
| Tests | `node --test` with native type stripping; `@vscode/test-electron` E2E | Minimal: pure-logic unit tests plus one live end-to-end run. |
| Packaging | `@vscode/vsce` | `npm run package` → `dist/anvil.vsix`. |

Runtime requirements: Node ≥ 22.14 (TrueForge), VS Code ≥ 1.95, git, Python 3.9+ for the Flask demo.
