# Anvil

A VS Code coding agent whose agent loop runs on [TrueForge](https://github.com/truefoundry/trueforge).

Anvil shows its work. Every turn opens with a Context card that lists the files it chose, why, and how much of the
token budget they used. Every edit goes through TrueForge's approval step into a per-hunk review in the editor;
nothing reaches disk until you accept it, and applied edits can be undone. If the primary model fails, Anvil
switches to the next model in your chain and says why.

Anvil is a new extension, not a fork. The agent loop is TrueForge's. The panel's interaction design is inspired by
Kilo Code (MIT) and Cursor; no upstream code is copied. Licence: MIT.

## Install

Requirements: VS Code 1.95+, Node.js 22.18+, git, Python 3.9+ for the Flask demo, and a model: an API key for
OpenAI, Anthropic or Gemini, or a local [Ollama](https://ollama.com) model with tool calling.

```bash
git clone https://github.com/swapnilsubhashpatil/forge-a-thon.git anvil
cd anvil
npm install
npm run build
cp .env.example .env    # add a key, or set OLLAMA_MODEL; never commit .env
npm run harness         # starts TrueForge on :8790 and registers the providers from .env
```

`npm run harness` runs `npx @truefoundry/trueforge@0.185.1` with `OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'`.
TrueForge blocks loopback URLs by default, and Anvil's MCP server and Ollama live on loopback. If no server is
running, the extension starts one with the same flags. Providers can also be added in the TrueForge UI at
`http://localhost:8790` under Settings, Models.

Open this folder in VS Code and press `F5` ("Run Anvil"); the Extension Development Host opens `../flask-3.1.3`.
To install instead, run `npm run package` and install `dist/anvil.vsix`.

Local models: set `OLLAMA_MODEL=qwen3:8b` in `.env`, set `anvil.models.reasoningEffort` to `none`, and start Ollama
with `OLLAMA_CONTEXT_LENGTH=16384`. Models under about 14B often write invalid tool calls; use a hosted model for the demo.

## Quick start

Demo repository:

```bash
git clone --branch 3.1.3 https://github.com/pallets/flask.git ../flask-3.1.3
cd ../flask-3.1.3 && python -m venv .venv && .venv/Scripts/pip install -e . "pytest==8.3.5"   # macOS/Linux: .venv/bin/pip
```

Run **Anvil: Configure Model Fallback Chain** and pick a primary and a fallback model, then:

| Task | Steps | Verify |
|---|---|---|
| A | Open `src/flask/helpers.py`, select `get_debug_flag`, press `Ctrl+Alt+K`, type the instruction, accept or reject hunks | `FLASK_DEBUG=off python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"` prints `False` |
| B | Paste the Task B prompt in the panel; watch the Context card, tool rows and reviews; open the TrueForge session from the header | `pytest tests/test_cli.py -q`, `flask --app <app> config`, `git diff --stat` (3+ files) |
| C | Set `BROKEN_PROVIDER_FOR_DEMO=1`, rerun `npm run harness`, put `broken/unreachable` first in the chain, repeat Task A | The failover notice names the error and the fallback model; `git status` is clean until you accept |

## Features

Keys are shown for Windows and Linux; on macOS use `Cmd` for `Ctrl`.

| Feature | How to use it |
|---|---|
| Inline edit | Select code, `Ctrl+Alt+K`, type the instruction. Hunks appear in place; `Ctrl+Alt+Y` accepts, `Ctrl+Alt+N` rejects |
| Agent mode | Side panel. One request drives TrueForge's tool loop over Anvil's MCP tools (repo map, search, symbols, read, edit, create, run) |
| Ask mode | Mode switch in the composer. Read-only tools, no edits |
| Context | `@file` and `@symbol` mentions plus automatic ranking under a token budget, shown on the Context card |
| Selection to chat | `Ctrl+Alt+L` adds the editor selection, the terminal selection, or the last terminal command and its output |
| Ask about selection | `Ctrl+Alt+Q`, or the lightbulb and hover link on selected code |
| Diff review | Per-hunk Accept / Reject in the editor; rejected hunks are reported back to the model |
| Changes tray | Edited files with +/- counts, Open diff, Keep, Undo, and Keep all / Discard all |
| Revert | On any user message: conversation only, code only, or both |
| Stop, Continue, Retry | Stop (`Ctrl+Alt+Backspace`) cancels the turn and discards pending edits; Continue or Retry resumes a stopped or failed turn |
| Steering | Messages sent while the agent works are queued and reach it at the next tool call |
| History | Past conversations with search, open and delete |
| Images | Paste, drop or attach images to a message |
| Model picker | Pick the model for the next message; the chain falls back on failure |
| Usage | Session strip with tokens, cache hits and cost |

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `anvil.models.chain` | `[]` | Ordered fallback chain of TrueForge model names (`provider/model`) |
| `anvil.models.reasoningEffort` | `default` | `none` disables thinking on models such as Qwen 3 |
| `anvil.context.budgetTokens` | `6000` | Token budget for the context pack |
| `anvil.agent.iterationLimit` | `60` | Agent loop steps per turn before a wrap-up |
| `anvil.agent.promptProfile` | `auto` | Full or compact agent instructions |
| `anvil.review.mode` | `review` | `review` each edit before it lands, or `applyThenReview` from the Changes tray |
| `anvil.commands.autoApprove` | `[]` | Command prefixes that run without asking |
| `anvil.commands.timeoutSeconds` | `120` | Hard timeout for commands the agent runs |
| `anvil.resilience.firstEventTimeoutSeconds` | `45` | Fail over when no model output arrives in time |
| `anvil.harness.url` | `http://localhost:8790` | TrueForge server |
| `anvil.harness.autoStart` | `true` | Start TrueForge with npx when none is reachable |
| `anvil.selection.askActions` | `true` | Lightbulb and hover link on selected code |

Most of these are also editable from the panel's Settings view.

Agent behaviour lives in [`agents/anvil-agent.json`](agents/anvil-agent.json) (agent mode) and
[`agents/anvil-inline.json`](agents/anvil-inline.json) (inline edits). The extension sends them as inline TrueForge
specs, attaches the `anvil-editor` MCP server with a fresh bearer token, and fills in the model from the chain.

## Development

```bash
npm run typecheck       # extension + webview
npm test                # unit tests and UI rule checks (node --test, native TypeScript)
npm run bench           # context retrieval benchmark on ../flask-3.1.3
npm run e2e             # VS Code + TrueForge + model, on a temporary Flask clone
node scripts/e2e-guards.mjs   # guard scenarios against a scripted model
```

`npm run e2e` reads `ANVIL_E2E_MODEL` (for example `anthropic/claude-sonnet-5-5`), `ANVIL_E2E_REASONING`,
`ANVIL_E2E_TASK_B=1` to include Task B, and `ANVIL_E2E_PYTHON`.

Other repositories work too. Python and JS/TS get symbol outlines and import-graph ranking; `@symbol` uses VS Code's
symbol providers for every language. Files over 512 KB, `node_modules`, `.git`, build output and virtualenvs are skipped.

Layout: `src/` extension host (`agent/`, `context/`, `edits/`, `harness/`, `tools/`, `ui/`, `shared/`),
`webview-ui/` React panel, `agents/` agent definitions, `docs/` documentation, `conductor/` project tracking.

## Documentation

- [Architecture](docs/architecture.md)
- [Benchmarks](docs/benchmarks/README.md)
- [Verification record](docs/verification.md)
- [Decision log](conductor/decisions.md)
