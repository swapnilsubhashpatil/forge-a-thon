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

The run was also stopped when the machine ran out of memory. **Before recording, run `npm run e2e` with a
hosted model** (`ANVIL_E2E_MODEL=openai/<model>` or similar) and do Tasks A, B and C by hand per the README
demo script. The failover and cancel stages have not yet run end to end. Their logic is covered by code
review, and the harness behaviour they depend on was confirmed in the spike.

## Independent review

A five-lens review (agent loop, diff safety, security, webview contract, lifecycle/packaging) reported 1
critical and about 20 high/medium findings. All were fixed: commits `d93c987`, `838132c`, `48b6a78`,
`b3b0dee`, `a57e9f8`. See `conductor/decisions.md` D12–D17.
