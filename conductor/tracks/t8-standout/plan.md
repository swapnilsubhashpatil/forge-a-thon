# T8 Standout: scope-locked improvements

## Scope guard
Every change must pass all four checks, or it is out of scope:
1. It improves one of the five core capabilities or protects reference Tasks A, B, C.
2. It stays inside the project rules: TrueForge runs the agent loop, editor actions are MCP tools,
   no direct model-provider calls (no embeddings), local mode only, no keys in the repo.
3. It is listed below. Anything new is written under "Parked" first, never built straight away.
4. It does not touch the out-of-scope list (verbatim):
   > Out of scope: tab completion or fill-in-the-middle;
   > training, fine-tuning or hosting your own model; a hosted backend, database or deployed service
   > beyond TrueForge in local mode; user accounts or authentication; publishing to the VS Code Marketplace.

Audit of every T8 item against check 4: S1–S5 are all local, inside the extension, and use only
TrueForge in local mode. No item adds completion, a model, a service, an account or a Marketplace step.

## In scope (in order)
- [x] S1 Inline mode exposes only `propose_edit` and `read_file`; reasoning effort `none` for local models
- [x] S2 `truncated` failure kind: retry with no reasoning and more output tokens instead of failing over
- [ ] S3 Live prediction scorecard on the Context card: record every read, record edited files, show predicted vs read vs edited
- [ ] S4 Rescue step: detect empty or text-only edit turns, parse the edit locally, one rewrite retry, normal per-hunk review
- [ ] S5 Held-out context benchmark built from Flask commit history

## Agent-mode behaviour (details, before/after, benchmarks and edge cases: [agent-mode-handoff.md](agent-mode-handoff.md))
- [ ] T1 Fake model server for deterministic guard tests + before/after benchmark runner
- [ ] M1 Agent instructions: phases, preambles, persistence, change-surface checklist
- [ ] M2 Subagents read-only: auto-deny writes and commands from non-main threads
- [ ] M3 Partial-rejection feedback with current region text
- [ ] M4 `run_command` summary line, tail-heavy clip, process-group kill
- [ ] M5 Detected test command in the context pack
- [ ] M6 `update_plan` tool and live checklist
- [ ] M7 Stuck-loop guard: nudge at 3, stop at 5
- [ ] M8 `finish_task` verification gate and one follow-up
- [ ] M9 Live metrics strip
- [ ] M10 Wrap-up turn at the iteration limit

## Parked (later)
- M11 Messages sent mid-turn delivered at the next tool result (design in agent-mode-handoff.md §10; swap in only by decision)
- Pre-review test run in a git worktree ("shadow workspace")
- Git co-change and stack-trace ranking signals
- Skills / Code Mode on TrueForge's local macOS sandbox
- Upstream TrueForge PRs: structured model-error codes, #878 MCP reconnect crash, Windows loopback bind
- Fix D14 wording (issues #508/#1224 are about createTurn cancelling the running turn) in decisions
