# Verification record

What has been checked, how, and what is still open. Updated 2026-11-17.

## Automated checks (pass)

| Check | Command | Result |
|---|---|---|
| Type check (extension + webview) | `npm run typecheck` | clean |
| Unit tests | `npm test` | 14 / 14 pass (context ranking incl. both Task B phrasings, pack budget, edit matcher cascade, hunks round-trip, EOL handling) |
| Context benchmark (Flask 3.1.3, 12 tasks) | `npm run bench` | recall@5 1.00, MRR 0.854, pack ≈ 89 % smaller than whole files |
| Edit robustness benchmark | `node scripts/bench-edits.ts` | 97.5 % apply rate vs 15.2 % exact-only, 0 / 60 wrong-location matches |
| Packaging | `npm run package` | `dist/anvil.vsix`, 12 files, 457 KB, no `node_modules` |
| Flask baseline tests | `pytest tests/test_cli.py -q` (pytest 8.3.5) | 55 passed, 3 skipped |

## Live checks against TrueForge 0.185.1 (Windows, standalone)

| Check | Result |
|---|---|
| Custom Ollama provider registered through the API; loopback MCP server reachable with `OUTBOUND_URL_ALLOWED_HOSTS` | works |
| Tool call → `tool.approval_required` → `user.tool_approval` allow → resume with `afterEventId` → tool runs → `turn.done` (spike script) | works: 38 s on qwen3:4b, 6 s on qwen3:8b with `reasoning_effort: none` |
| Resubscribing without `afterEventId` replays the stream and re-answers approvals (HTTP 400) | reproduced and fixed (decision D10) |
| Extension inside VS Code (`@vscode/test-electron`): activation, harness connect, MCP registration, indexing, model listing, agent turn streamed through TrueForge to `done` | works |
| `npm run harness` registers providers from `.env` | works (after switching to snake_case REST fields) |

## Open: model-dependent end-to-end runs

The E2E suite (`npm run e2e`) runs Task A, Task C failover and cancel against a temporary Flask clone. On
this machine only small local models were available (no hosted API keys), and they could not complete the
inline edit:

- **qwen3:4b with thinking** used its whole 4,096-token output budget on reasoning. That led to the
  `anvil.models.reasoningEffort` setting.
- **qwen3:8b without thinking** produced the right `propose_edit` call, but with unescaped quotes inside
  `old_string`. Ollama's tool-call parser dropped the invalid JSON, so the turn ended with an empty message.
  We confirmed this by replaying the captured request directly against Ollama.
- **qwen3:8b with thinking** took more than 10 minutes per call on a 6 GB laptop GPU.
- Ollama's default 4,096-token context window also truncated prompts. Start Ollama with
  `OLLAMA_CONTEXT_LENGTH=16384`.

## Live end-to-end run (hosted model)

Run on 2026-11-17 with `npm run e2e` against pallets/flask 3.1.3, with `ANVIL_E2E_MODEL=anthropic/claude-sonnet-5-5`,
`ANVIL_E2E_REASONING=low`, `ANVIL_E2E_TASK_B=1` and `BROKEN_PROVIDER_FOR_DEMO=1`. All stages passed (exit code 0).

| Stage | Result | Wall time | Tokens (in / out / cached) |
|---|---|---|---|
| Task A: inline edit of `get_debug_flag` | Done. One hunk (+5 / -1), checked in Python. | 6.9 s | 7,878 / 430 / 3,746 |
| Task C: failover | `broken/unreachable` failed ("bad port"). Switched to Sonnet, same edit. | 4.6 s | 7,878 / 433 / 7,872 |
| Cancel mid-turn | Turn cancelled, pending edits discarded. | 15 ms | — |
| Task B: `flask config` command | cli.py, docs/cli.rst and tests/test_cli.py (+51 lines). Agent ran pytest; the new tests pass. | 36.0 s | 130,437 / 2,951 / 109,447 |

Context selection labelled cli.py, cli.rst and test_cli.py as targets and config.py as a reference. On its
first pytest run the agent hit an import error because `PYTHONPATH` was missing. It read the error, set
`PYTHONPATH=src` and reran; the new tests passed (`2 passed`). The e2e harness needs a Python interpreter
with Flask's dependencies, either on `PATH` or set through `ANVIL_E2E_PYTHON`.

## Independent review

A five-lens review (agent loop, diff safety, security, webview contract, lifecycle/packaging) reported 1
critical and about 20 high/medium findings. All were fixed: commits `d93c987`, `838132c`, `48b6a78`,
`b3b0dee`, `a57e9f8`. See `conductor/decisions.md` D12–D17.
