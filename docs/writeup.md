# Anvil: a VS Code coding agent on TrueForge

## Team
_Team name and members: fill in before submission._

## Starting point
Anvil is a new extension written for this hackathon, with no fork. We surveyed Cline, Continue, Roo Code,
Kilo Code and opencode. Forking would have meant removing each project's own agent loop, and judges score
only what changes after the fork point. Continue is in its final release, Roo Code is archived, and
opencode's extension only opens a terminal UI. We kept the interaction ideas that work, compact activity rows
(Kilo Code, MIT) and in-place red/green review (Cursor), and wrote all of the code ourselves. Licence: MIT.

## Architecture on TrueForge
TrueForge runs every agent turn. The extension is a client of the harness plus a tool provider for it.

- **Sessions with inline specs.** Each panel conversation is a TrueForge session created from
  `agents/anvil-agent.json`; each inline edit gets a short-lived session from `agents/anvil-inline.json`.
  The model is filled in at run time from the fallback chain, so `sessions.update` can switch models without
  losing history.
- **MCP tools served by the extension.** A Streamable HTTP MCP server on `127.0.0.1:<random port>/mcp`,
  protected by a bearer token that rotates on every start and is registered with
  `PUT /settings/mcp-servers`. Tools: `repo_map`, `search_code` (VS Code's bundled ripgrep),
  `find_symbol`, `find_references`, `read_file`, `explain_context`, `propose_edit`, `create_file`,
  `run_command`. Reads are annotated `readOnlyHint: true`, edits `readOnlyHint: false`, and `run_command`
  `destructiveHint: true`. The spec also lists the write tools by name in `require_approval_for_tools`.
  TrueForge blocks loopback URLs by default, so the harness is started with
  `OUTBOUND_URL_ALLOWED_HOSTS=["127.0.0.1","localhost"]`.
- **Approval drives review.** On `tool.approval_required` the extension finds the tool call's arguments
  through `sourceEventId`, applies `old_string → new_string` to the file in memory, and opens an inline
  per-hunk review in the editor. Accepting at least one hunk answers `allow`; the tool result then reports
  which hunks were applied and returns the rejected patch to the model. Rejecting everything answers `deny`,
  with a reason the model reads. `run_command` approvals appear as Allow/Deny cards in the panel. Paused
  turns resume with `subscribeToTurn(afterEventId)`, so approvals are never answered twice.
- **Context engineering in the harness.** Subagents are enabled (exploration can be delegated and shows up
  as a thread in the panel and in the Sessions UI), compaction triggers at 60k input tokens, and tools are
  preloaded so weaker models don't have to go through deferred meta-tools.
- **State.** The extension host owns a single `ChatState`, built from the TrueForge event stream (deltas
  merged with `mergeEventDelta`). The React webview renders snapshots throttled to about 30 per second and
  sends back only user intents.

## How context is selected
Before each turn Anvil ranks every tracked file in the workspace and sends a **context pack** limited to
6,000 tokens by default. The pack contains a candidates table (path, role, reason), a repository map of
signatures, and code slices around the strongest matches. Signals, all computed locally:

- @file / @symbol mentions, which are pinned
- path-segment matches with a small synonym map
- BM25 over symbol names and docstrings
- "sibling" symbols (a request for a new command finds the file that defines `routes_command`, `shell_command` and the other commands)
- test and docs companions (`cli.py` → `tests/test_cli.py`, `docs/cli.rst`)
- personalised PageRank over the import graph
- files open in the editor

Files that only match content words are labelled *reference*, so `config.py` doesn't win Task B just because
the prompt says "config". Everything else the agent fetches just in time with search and read tools. Repeat
reads of an unchanged range return a short stub, and every tool output is capped. The panel shows the
selection as a Context card with reasons and a budget bar, and lists files the agent fetched later.

Measured on Flask 3.1.3 with 12 hand-labelled tasks (`npm run bench`):

| | recall@5 | MRR |
|---|---|---|
| Anvil | 1.00 | 0.85 |
| BM25 | 0.71 | 0.43 |
| Path-only | 0.21 | 0.14 |

The pack averages about 4.2k tokens, against about 38k to send the top eight files whole. No embeddings are
used, because the rules ban direct calls to model providers.

## Model setup
Models are configured in TrueForge (Settings → Models, or `npm run harness`, which reads `.env`). The
extension stores only an ordered chain of model names (`anvil.models.chain`). Recommended setup: a strong
hosted primary, a fallback from a different provider, and a local Ollama model as the last resort. We
developed and tested with a local `qwen3:8b` through a TrueForge custom provider.

Failover is client-side because TrueForge has none. An error message, or no model output within 45 seconds,
is classified as auth, not-found, rate-limit, unavailable, timeout or context. Rate-limit and 5xx errors get
one retry with jittered backoff. The model's circuit breaker then opens for 60 seconds, the session spec
switches to the next model, the same request is sent again, and the panel explains what failed and what took
over. Nothing reaches the disk before review, so a failed attempt leaves `git status` clean.

## Scorecard
_Fill in after recording; timestamps must match the video._

| Criterion | Evidence | Video timestamp |
|---|---|---|
| A1 Inline edit | Selection → `Ctrl+Alt+K` → hunks with Accept/Reject in place; `FLASK_DEBUG=off` prints `False` | |
| A2 Agent mode | One prompt edits `cli.py`, `tests/test_cli.py`, `docs/cli.rst`; none named | |
| A3 Streaming / cancel | Live tokens; Stop mid-turn; `git status` clean | |
| B1 Context | Context card: files, roles, reasons, 4.5k / 6k budget | |
| B2 Diff safety | Reject one hunk, accept another, Undo restores | |
| B3 Resilience | Broken primary → failover notice → fallback completes Task A | |
| B4 TrueForge depth | MCP tools, approval → review, subagent thread, Sessions UI | |
| C1 Video | ≤ 4 min, A → B → C | |
| C2 Write-up | This document | |

## Tools used
TrueForge 0.185.1 and `@truefoundry/trueforge-sdk` 0.185.0, `@modelcontextprotocol/sdk`, VS Code extension
API, React 19, Vite 8, Tailwind CSS 4, codicons, jsdiff, esbuild, `@vscode/test-electron`, Ollama
(`qwen3:4b` and `qwen3:8b` for local testing). We used Claude Code as a coding assistant during development.

## Known limitations
- Retrieval is lexical and structural. Symbol skeletons cover Python and basic JS/TS; other languages fall back to path and BM25 ranking.
- Failover classifies TrueForge's error text, because errors carry no codes. Unknown errors fail over, which can switch models when it isn't needed.
- If the user types into a file while its review is open, that review is discarded (the baseline is restored and a warning shown) instead of being merged.
- Small local models (around 4B parameters) sometimes write tool calls as text instead of calling the tool. The instructions forbid it, but the result still depends on the model.
- Single-root workspaces only. Skills and Code Mode are not used, because they need a paid sandbox.
