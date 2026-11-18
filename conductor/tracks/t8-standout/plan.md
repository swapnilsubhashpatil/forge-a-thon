# T8 Standout: scope-locked improvements before Round 1

Deadline: 20 Nov 2026, 23:59 IST. Recording the video (T7) outranks every item here.

## Scope guard
Every change must pass all four checks, or it is out of scope:
1. It moves a scored criterion (A1–A3, B1–B4, C1–C2) or protects the demo of Tasks A, B, C.
2. It stays inside the eligibility rules: TrueForge runs the agent loop, editor actions are MCP tools,
   no direct model-provider calls (no embeddings), local mode only, no keys in the repo.
3. It is listed below. Anything new is written under "Parked" first, never built straight away.
4. It does not touch the brief's out-of-scope list (verbatim):
   > Out of scope (not scored; time spent here is time lost): tab completion or fill-in-the-middle;
   > training, fine-tuning or hosting your own model; a hosted backend, database or deployed service
   > beyond TrueForge in local mode; user accounts or authentication; publishing to the VS Code Marketplace.

Audit of every T8 item against check 4: S1–S5 are all local, inside the extension, and use only
TrueForge in local mode. No item adds completion, a model, a service, an account or a Marketplace step.

## In scope (in order; stop and record the video if 19 Nov runs late)
- [x] S1 Inline mode exposes only `propose_edit` and `read_file`; reasoning effort `none` for local models (B3)
- [x] S2 `truncated` failure kind: retry with no reasoning and more output tokens instead of failing over (B3)
- [ ] S3 Live prediction scorecard on the Context card: record every read, record edited files, show predicted vs read vs edited (B1)
- [ ] S4 Rescue step: detect empty or text-only edit turns, parse the edit locally, one rewrite retry, normal per-hunk review (B3)
- [ ] S5 Held-out context benchmark built from Flask commit history (B1, C2)

## Parked (Round 2 / finals only)
- Pre-review test run in a git worktree ("shadow workspace")
- Git co-change and stack-trace ranking signals
- Skills / Code Mode on TrueForge's local macOS sandbox
- Upstream TrueForge PRs: structured model-error codes, #878 MCP reconnect crash, Windows loopback bind
- Fix D14 wording (issues #508/#1224 are about createTurn cancelling the running turn) in decisions and write-up
