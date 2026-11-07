# Anvil

**A VS Code coding agent whose agent loop runs on [TrueForge](https://trueforge.dev).**

Anvil shows its work. Every turn opens with a *Context card* listing the files it chose, why, and how much
of the token budget they used. Every edit goes through TrueForge's approval step into an inline, per-hunk
review in the editor; nothing reaches disk until you accept it, and every applied change set can be undone
in one click. If the primary model fails, Anvil switches to the next model in your chain and tells you why.

| Capability | How Anvil does it |
|---|---|
| Inline edit | Select code, `Ctrl+Alt+K` (`Cmd+Alt+K`), type the instruction; red/green hunks appear in place with Accept / Reject CodeLens |
| Agent mode | Side panel; one request drives TrueForge's tool loop over Anvil's MCP tools (repo map, search, symbols, read, edit, create, run) |
| Context | `@file` / `@symbol` mentions plus automatic ranking (path, BM25, sibling symbols, test/docs companions, import-graph PageRank) packed under a token budget |
| Diff safety | `tool.approval_required` opens the review; partial accepts are applied and the rejected patch is returned to the model; multi-file undo |
| Streaming & cancel | Live tokens; Stop cancels the TrueForge turn, discards pending hunks and denies pending approvals, so the workspace stays clean |
| Resilience | Ordered model chain, error classification, one retry for rate limits/5xx, circuit breaker, first-output watchdog, on-screen failover notice |
| TrueForge depth | Inline agent specs, MCP server with annotation-driven approvals, subagents, compaction, session link to the TrueForge UI |

## Starting point

Anvil is a new extension, not a fork. The agent loop is entirely TrueForge's. The panel's interaction
design (compact activity rows, inline review) is inspired by Kilo Code (MIT) and Cursor; no upstream code
is copied, so there is no fork point to declare. Licence: MIT.

## Requirements

- VS Code ≥ 1.95, Node.js ≥ 22.14, git
- Python ≥ 3.9 for the Flask demo
- A model provider: an API key for OpenAI / Anthropic / Gemini, **or** a local [Ollama](https://ollama.com) model with tool calling (e.g. `qwen3:4b`)

## Setup from a clean clone

```bash
git clone https://github.com/swapnilsubhashpatil/forge-a-thon.git anvil
cd anvil
npm install
npm run build

cp .env.example .env          # add a key, or set OLLAMA_MODEL; never commit .env
npm run harness               # starts TrueForge on :8790 and registers the providers from .env
```

`npm run harness` launches `npx @truefoundry/trueforge@0.185.1` with
`OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'`. That allowlist is required: TrueForge blocks
loopback URLs by default, and Anvil's MCP server (and Ollama) live on loopback. You can also add providers in
the TrueForge UI at `http://localhost:8790` → Settings → Models. If no server is running, the extension
starts one itself with the same flags.

Demo repository:

```bash
git clone --branch 3.1.3 https://github.com/pallets/flask.git ../flask-3.1.3
cd ../flask-3.1.3 && python -m venv .venv && .venv/Scripts/pip install -e . "pytest==8.3.5"   # macOS/Linux: .venv/bin/pip
```

Run the extension: open this folder in VS Code and press `F5` (“Run Anvil”). The Extension Development Host
opens `../flask-3.1.3`. Then run **Anvil: Configure Model Fallback Chain** and pick the primary and fallback
models. To install instead: `npm run package` and install `dist/anvil.vsix`.

### Agent definition

Agent behaviour lives in [`agents/anvil-agent.json`](agents/anvil-agent.json) (agent mode) and
[`agents/anvil-inline.json`](agents/anvil-inline.json) (inline edits). The extension turns them into inline
TrueForge agent specs per session, attaches the `anvil-editor` MCP server (registered on every start with a
fresh bearer token) and requires approval for `propose_edit`, `create_file` and `run_command`. The model is
filled in from the fallback chain at run time, so the same session can switch models after a failure.

## Demo script

| Task | Steps | Verify |
|---|---|---|
| A | Open `src/flask/helpers.py`, select `get_debug_flag`, `Ctrl+Alt+K`, paste the instruction, accept/reject hunks | `FLASK_DEBUG=off python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"` → `False` |
| B | Paste the Task B prompt in the panel; watch the Context card, tool rows and per-file reviews; open the TrueForge session from the header | `pytest tests/test_cli.py -q`, `flask --app <app> config`, `git diff --stat` (3+ files) |
| C | Set `BROKEN_PROVIDER_FOR_DEMO=1`, rerun `npm run harness`, put `broken/unreachable` first in the chain, repeat Task A | Failover notice names the error and the fallback model; `git status` is clean until you accept |

## Development

```bash
npm run typecheck     # extension + webview
npm test              # unit tests (node --test, native TypeScript)
npm run bench         # context retrieval benchmark on ../flask-3.1.3
node scripts/bench-edits.ts
npm run e2e           # VS Code + TrueForge + model, on a temporary Flask clone
```

Layout: `src/` extension host (`agent/`, `context/`, `edits/`, `harness/`, `tools/`, `ui/`, `shared/`),
`webview-ui/` React panel, `agents/` agent definitions, `docs/` architecture and benchmarks,
`conductor/` project tracking (product, decisions, tracks).

See [docs/architecture.md](docs/architecture.md) and
[docs/benchmarks](docs/benchmarks).
