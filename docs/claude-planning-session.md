# Planning session notes

Condensed from a planning conversation with Claude Code on 16 Nov 2026, before any code was written. It covers
the problem statement, the scoring rubric, an audit of TrueForge (docs plus source at commit `3e8184b`) and the
design decisions that came out of it. Chit-chat and tool output are left out.

## The problem

TrueFoundry Forge-a-thon (Techfest, IIT Bombay). Build a coding agent as a **VS Code extension** whose agent loop
runs on **TrueForge**, TrueFoundry's open-source agent harness. The challenge is an editor-native agent that:

- finds the right code in a repo bigger than the model's context window,
- makes a multi-file change the user did not spell out file by file,
- shows every change for review before it touches disk,
- keeps working when the model fails.

The focus is **context assembly** and a **safe, fast editor experience**. TrueForge handles streaming, sessions,
tool calls and approvals; the extension is a client of a TrueForge agent.

### Mandatory features

1. **Inline edit.** Select code, press a keybinding, type an instruction, get a diff to accept or reject. A chat
   reply you copy by hand does not count.
2. **Agent mode.** A panel that runs a tool loop (read, search, write, terminal) and changes 3+ files the user
   never named.
3. **Context assembly.** `@file` and `@symbol` mentions plus automatic retrieval, under a size budget.
4. **Diff review.** Per-hunk accept or reject, no silent writes, undo for applied changes.
5. **Streaming and cancel.** Live tokens, instant cancel, no half-applied edits after a cancel.

Out of scope: tab completion, training or hosting models, a deployed backend, accounts, Marketplace publishing.

### Eligibility gate (pass/fail)

- Sessions and turns go through the TrueForge HTTP API or TypeScript SDK.
- Editor abilities (read, search, propose write, run command) are exposed to the agent as **MCP tools**.
- TrueForge runs locally (`npx @truefoundry/trueforge@latest`).
- The model is configured in TrueForge. The extension never calls a model provider directly.
- A fork (Cline, Continue, Roo Code, opencode) must replace its agent loop, keep its licence and declare the fork commit.
- The repo contains the agent definition and no API keys (ship an example config).

### Demo tasks (pallets/flask, tag 3.1.3, commit `22d92470`)

| Task | What | Verified by |
|---|---|---|
| A | Inline edit of `get_debug_flag` so `off` and `n` are false, plus a docstring update | `FLASK_DEBUG=off` prints `False` |
| B | From the panel, no files named: add `flask config` that prints the config as JSON with secrets masked, with a test and docs | `pytest tests/test_cli.py` passes, 3+ files changed, TrueForge session shown |
| C | Point TrueForge at a dead endpoint or bad key and repeat A | Editor responsive, clear error or fallback model, `git status` clean |

Round 1 deliverables: a demo video (4 min max, A, B, C in order, verified on screen), a 1–3 page PDF write-up with
eight fixed headings, and a public repo whose README works from a clean clone.

## Scoring (100)

Judges pick the anchor that fits; between two anchors you get the lower one.

| # | Criterion | Middle anchors | Full marks |
|---|---|---|---|
| A1 | Inline edit (10) | 4: edit, no diff · 7: diff, accept-all only | Per-hunk accept and reject |
| A2 | Agent mode (10) | 4: one file · 7: several files the user named | Finds and edits 3+ files on its own |
| A3 | Streaming and cancel (10) | 4: streams, no cancel · 7: cancel can leave half-applied edits | Instant cancel, workspace consistent |
| B1 | Context assembly (15) | 5: `@` mentions only · 10: automatic retrieval, explained | Retrieval with a size budget, visibly choosing files in Task B |
| B2 | Diff safety (10) | 5: whole-file preview | Per-hunk review plus working undo |
| B3 | Resilience (10) | 4: clear error · 7: retry with backoff | Automatic switch to a second model |
| B4 | TrueForge depth (10) | 4: sessions only · 7: MCP tools with approval driving review | Plus subagents, deferred loading, Code Mode, compaction or skills, visible |
| C1 | Video (10) | 5: all tasks, not verified | All three complete and verified on screen |
| C2 | Write-up (15) | 5: feature list · 10: architecture, context, models | Plus an accurate scorecard with timestamps and honest limitations |

About 55 points (B1, B4, C2) reward design decisions that can be explained, not just working features.

## TrueForge audit

TrueForge is an MIT agent harness: it runs the loop *model call, tool call, result, repeat* and handles streaming,
session history, approvals, context management and MCP connections. The extension is the car; TrueForge is the engine.

### What it provides

| Area | Detail |
|---|---|
| Models | Catalog providers (OpenAI, Anthropic, Gemini and others) plus any OpenAI-compatible endpoint (Ollama, vLLM, Groq) |
| Retries | Two retries with backoff on timeouts, 429 and 5xx; none on 401 (source) |
| Sessions | History persists, one active turn per session; a new message cancels the running turn (`cancelled-for-next-turn`) |
| Streaming | `model.message.delta` events; SDK helpers `isEventDelta` and `mergeEventDelta`; resume from the last event id |
| Cancel | `sessions.cancel()` aborts the model call, waits for running MCP tools, ends with `turn.done` status `cancelled` |
| MCP client | Streamable HTTP and SSE, no stdio; auth none, header or OAuth |
| Approvals | Per tool call: the turn pauses on `tool.approval_required`, answered with `allow` or `deny` plus a reason; works in subagents |
| Context features | Subagents, deferred tool loading and compaction (80% of the window) on by default |
| Sessions UI | Turns, tool calls, subagents, tokens and timing, shown during Task B |

### What it lacks

| Gap | Consequence for Anvil |
|---|---|
| Localhost is blocked by an outbound network guard (`ssrfGuard.ts`) | Start TrueForge with `OUTBOUND_URL_ALLOWED_HOSTS='["localhost","127.0.0.1"]'`, otherwise the MCP server and Ollama are rejected |
| No model fallback (roadmap: planned) | Build the fallback chain in the extension |
| Large-result offloading, Skills and Code Mode need a sandbox (Daytona key) | Tools cap their own output; use subagents and deferred loading for B4 |
| Cancel does not stop running tools | The extension discards pending edits and kills its own processes on Stop |
| No message queue | Queue follow-up messages in the extension |
| Approval is per call, not per hunk | Per-hunk review lives in the editor; the tool result tells the model which hunks landed |
| No retrieval or indexing | Context assembly is entirely ours, which is the point of the contest |

## Design decisions

- **Approvals drive review.** `propose_edit` is listed in `require_approval_for_tools` by name. On
  `tool.approval_required` the extension shows the hunks; accepting any hunk answers `allow` and the result reports
  which hunks were applied; rejecting all answers `deny` with a reason.
- **Edits are proposals until accepted.** Nothing reaches disk before review, so cancel only discards pending
  proposals and the workspace stays consistent.
- **Inline agent specs.** Named sessions reject spec updates, inline specs do not, so the model can be swapped
  mid-session for failover. The spec JSON lives in the repo.
- **Client-side failover.** Watch for `turn.done` with `status: error`, retry the same request on the next model in
  the chain, and tell the user what failed and what took over.
- **Local HTTP MCP server.** TrueForge has no stdio transport, so the extension runs a Streamable HTTP server on
  loopback.
- **Context pipeline.** Repo map of paths and symbols, ranked candidates under a fixed token budget, the chosen files
  and reasons shown in the panel, exploration delegated to a subagent.
- **Model choice.** Read configured models from TrueForge, keep an ordered fallback chain, never hard-code a provider.
  A smart auto-router was dropped: it is not scored and adds a failure point.
- **Messages sent while busy** are queued in the extension instead of cancelling the running turn.

## Round 2 PR candidates

- Model fallback chains per agent.
- stdio MCP transport for local tools.
- Per-session allow-listing of localhost MCP servers, safer than turning the guard off.
- "Approve once" for a tool.
