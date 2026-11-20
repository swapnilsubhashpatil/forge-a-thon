# Anvil: a VS Code coding agent on TrueForge

## Team
**TODO before submission: team name and members.**

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
| Anvil | 0.96 | 0.85 |
| BM25 | 0.71 | 0.43 |
| Path-only | 0.21 | 0.14 |

The pack averages about 4.5k tokens, against about 43k to send the top eight files whole. On a held-out set of 200
real Flask commits (request = commit subject, truth = files changed), Anvil puts a changed file in the top five 85%
of the time against 70% for BM25. Files that often change together in git history rank each other up, and project
rules files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.clinerules`, `.github/copilot-instructions.md`,
`.anvil/rules.md`) go into the pack. No embeddings are used, because the rules ban direct calls to model providers.
Details: [benchmarks](benchmarks/README.md).

## Model setup
Models are configured in TrueForge (Settings → Models, or `npm run harness`, which reads `.env`). The
extension stores only an ordered chain of model names (`anvil.models.chain`). Recommended setup: a strong
hosted primary, a fallback from a different provider, and a local Ollama model as the last resort.

Models used:

| Model | Where it ran | Approximate cost |
|---|---|---|
| `anthropic/claude-sonnet-5-5` | Anthropic API through TrueForge's catalog provider | One full e2e run of Tasks A, B and C (about 146k input tokens, most of them cached, and 3.8k output) cost well under US$1 |
| `ollama/qwen3-8b` | Ollama on the laptop, through a TrueForge custom provider | Free; too weak for reliable tool calls |
| `broken/unreachable` | Deliberately dead endpoint, used for Task C | None |

To switch models, run **Anvil: Configure Model Fallback Chain** or edit `anvil.models.chain`.

Failover is client-side because TrueForge has none. An error message, or no model output within 45 seconds,
is classified as auth, not-found, rate-limit, unavailable, timeout or context. Rate-limit and 5xx errors get
one retry with jittered backoff. The model's circuit breaker then opens for 60 seconds, the session spec
switches to the next model, the same request is sent again, and the panel explains what failed and what took
over. Nothing reaches the disk before review, so a failed attempt leaves `git status` clean.

## Agent behaviour
Measured across seven models, before and after (full table in [benchmarks](benchmarks/README.md)): untested
edits at the end of Task B fell from 11/14 runs to 0/14, and failed test runs per task from 3.1 to 0.3.

- **Plan checklist and finish gate.** The agent keeps an `update_plan` checklist. `finish_task` is accepted only
  when a passing check ran after the last accepted edit; otherwise the agent gets one follow-up to verify, and a
  verified finish shows a chip in the panel.
- **Loop guard.** Repeated identical calls or short cycles get a nudge at three and stop the turn at five.
- **Step-limit wrap-up.** At the iteration limit the agent gets one wrap-up turn to summarise instead of failing over.
- **Read-only subagents.** Subagents may read, search and run read-only commands; edits and tests are refused.
- **Rejection feedback.** When hunks are rejected the model receives the new baseline and the current file text.
- **Follow-up on unapplied edits.** A turn that ends after edits that never applied gets one follow-up to retry.
- **`run_command`.** A one-line summary, an inactivity timeout plus a hard cap, and a process-tree kill on Stop.
- **Scope and grounding badges.** Hunks outside the selection, edits to unread lines, and calls to names that exist
  nowhere are flagged on the review and reported to the model.
- **Queued steering notes.** Messages typed while the agent works are queued and delivered inside the next tool result.
- **Editor to chat.** `Ctrl+Alt+L` sends the selection, terminal selection or last terminal command to the chat;
  `Ctrl+Alt+Q` or the lightbulb asks about selected code.
- **Restore to any message**, with or without its code changes.
- **Session usage strip** (tokens, cache hits, cost) and a **model picker** for the next message.

A scripted misbehaving model (`node scripts/e2e-guards.mjs`) drives the real extension, TrueForge and MCP server
through nine guard scenarios; all pass, and they found four bugs that are now fixed.

## UX in this release
- **Agent and Ask modes.** Ask uses a read-only agent spec with no subagents.
- **Chat history.** Conversations are saved with their TrueForge session; open, search, delete, start new.
- **Revert with three scopes** on every user message: conversation only, code only, or both.
- **Continue and Retry** on a stopped or failed turn.
- **Changes tray** above the composer: edited files with +/- counts, Open diff and Undo, plus Keep all / Discard all.
- **Review modes.** Review each edit before it lands, or apply at once and review later from the tray.
- **Images.** Paste, drop or attach; sent to the model as file content.
- **@symbol for every language** through VS Code's symbol providers, merged with Anvil's own index.
- **Settings view** for the model chain, reasoning effort, review mode, auto-approved command prefixes and the MCP
  servers TrueForge sees.
- **Auto-approve.** Command prefixes that run without asking, plus "Allow for this session" on approval cards.
- **Failover marker** on the turn: which model failed, why, and which took over.
- **Selection toolbar.** Selecting code shows Edit, Ask and Add to chat above it; the live selection follows into the chat as a chip, and pinning collects several.
- **Inline edit in the editor.** Ctrl+Alt+K opens a box under the selection; the change is reviewed in place with Accept, Reject or Keep both, Open diff shows before and after, and Refine iterates on the same lines.
- **Skills.** Claude Code compatible SKILL.md folders (project or user); the agent loads a matching one with `use_skill`, `/name` runs one by hand, Settings creates, toggles, opens and deletes them.
- **Type and icons.** IBM Plex Sans and Mono with a custom glyph set; colours stay on VS Code theme tokens.

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
API, React 19, Vite 8, Tailwind CSS 4, IBM Plex, Hugeicons, jsdiff, esbuild, `@vscode/test-electron`, Ollama
(`qwen3:4b` and `qwen3:8b` for local testing). We used Claude Code as a coding assistant during development.

## Known limitations
- Retrieval is lexical and structural. Symbol skeletons cover Python and basic JS/TS; other languages fall back to path and BM25 ranking.
- Failover classifies TrueForge's error text, because errors carry no codes. Unknown errors fail over, which can switch models when it isn't needed.
- If the user types into a file while its review is open, that review is discarded (the baseline is restored and a warning shown) instead of being merged.
- Small local models (around 4B parameters) sometimes write tool calls as text instead of calling the tool. The instructions forbid it, but the result still depends on the model.
- With Auto Save on, a save during review discards that review, so the review text never reaches disk. Anvil warns when Auto Save is on.
- The scope, grounding and loop guards never fire on Task B, because the models that pass it behave; they are proven against a scripted model instead.
- Single-root workspaces only. TrueForge Skills and Code Mode are not used, because they need a paid sandbox; Anvil ships its own skills (`docs/skills.md`).
