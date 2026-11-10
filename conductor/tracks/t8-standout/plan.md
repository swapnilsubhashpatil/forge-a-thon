# T8 Standout: scope-locked improvements

## Scope guard
Every change must pass all four checks, or it is out of scope:
1. It improves one of the five core capabilities or protects reference Tasks A, B, C.
2. It stays inside the project rules: TrueForge runs the agent loop, editor actions are MCP tools,
   no direct model-provider calls (no embeddings), local mode only, no keys in the repo.
3. It is listed below. Anything new is written under "Parked" first, never built straight away.
4. It does not touch the out-of-scope list: tab completion, training or hosting models,
   hosted backends or databases, authentication, Marketplace publishing.

## In scope (in order)
- [x] S1 Inline mode exposes only `propose_edit` and `read_file`; reasoning effort `none` for local models
- [ ] S2 `truncated` failure kind: retry with no reasoning and more output tokens instead of failing over
- [ ] S3 Live prediction scorecard on the Context card: record every read, record edited files, show predicted vs read vs edited
- [ ] S4 Rescue step: detect empty or text-only edit turns, parse the edit locally, one rewrite retry, normal per-hunk review
- [ ] S5 Held-out context benchmark built from Flask commit history

## Parked (later)
- Pre-review test run in a git worktree ("shadow workspace")
- Git co-change and stack-trace ranking signals
- Skills / Code Mode on TrueForge's local macOS sandbox
- Upstream TrueForge PRs: structured model-error codes, #878 MCP reconnect crash, Windows loopback bind
- Fix D14 wording (issues #508/#1224 are about createTurn cancelling the running turn) in decisions
