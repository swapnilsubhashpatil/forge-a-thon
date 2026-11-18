# Spec: Anvil agent-mode behaviour and guardrails (Round 1)

Status: agreed 18 Nov 2026 (grilling Q1–Q21). Tickets: [tickets/](tickets/). Research: [research-round2.md](research-round2.md),
[research/](research/). Background: [agent-mode-handoff.md](agent-mode-handoff.md), [innovation-proposal.md](innovation-proposal.md).

## Problem
The brief opens with three complaints about AI coding tools: they **lose track of the file you care about**, **rewrite
functions you did not ask them to touch**, and **confidently edit symbols that do not exist**. Anvil already passes
Tasks A–C. This work makes the existing capabilities better and shows, on screen, a guard for each complaint, while
staying strictly inside the brief's scope.

## Goals
1. Each brief complaint has a visible guard in the editor (G1, G2, G3).
2. Agent mode explores, edits, verifies and reports reliably on strong, weak and local models (M1, M5, M8, M3, M4).
3. Messages typed while the agent works are never lost and never cancel work by accident (M11).
4. A measured before/after table for the write-up.

## Non-goals
Anything on the brief's out-of-scope list (tab completion, own models, hosted services, accounts, Marketplace);
auto mode / model routing in the extension; embeddings; Round-2-only work (TrueForge PRs, shadow workspace).

## Constraints
- TrueForge runs the loop; editor actions stay MCP tools; the extension never calls a model provider.
- Must work with whatever model TrueForge has; no regression on Haiku 5.5 or Ollama `qwen3:8b`.
- Build stops 20 Nov 2026 12:00 IST; video, write-up PDF and public repo follow.
- One commit per ticket on `feat/agent-mode-behaviour`; `npm run typecheck` and `npm test` green after each; no push without asking.

## Requirements

### G1 Live context scorecard (B1)
- Record every file the agent reads (including files already in the context pack) and every file with accepted hunks.
- Context card shows three lists: predicted (pack top 10), read, edited; final line "edited files in top-5 predicted: n/m".
- Context gauge: current input tokens vs the 60k compaction trigger and cache-hit %; "n/a" when the provider reports no cache fields; marks compactions.

### M1 Agent prompt (A2)
- Phases Explore → Plan → (Edit → Verify)* → Summarise; one-sentence preamble before tool batches; persistence ("keep going until resolved");
  change-surface checklist (closest analogue, `find_references`, registration/tests/docs); "verify by execution, never by assumption";
  at most two focused fix attempts on the same failure, then report.
- Compact variant for weak/local models, chosen automatically for `ollama/` models; setting `anvil.promptProfile: auto | full | compact`.

### M5 Test command (B1, A2)
- Detect the test command (pyproject/pytest config, package.json scripts, nearest test companion) and add "Verify with: …" to the pack, phrased as a hint; omit when unsure.
- `run_command` sets `PYTHONPATH=src` in the environment when the workspace has a Python `src/` layout (no inline env syntax).

### M11 Messages sent while the agent works (UX, A3)
- Composer stays enabled while busy; sending creates a "queued" chip (editable/removable).
- Queued notes are appended to the next **main-thread** tool result as `<user_note sent_mid_task>…</user_note>` plus: "If this belongs to the current task, adapt now. If it is a separate request, finish the current task first and say you will handle it next."
- Notes not delivered when the turn ends are sent as the next turn automatically. Chip shows "delivered at step N".
- Per-chip "Stop and send": cancel the turn (existing cancel path), then send; the cancelled turn is labelled "superseded", not as an error.
- Never delivered into subagent threads; inline mode always queues to next turn; cancel keeps queued chips.

### M8 Completion gate (A2, B2)
- New `finish_task {summary, files_changed, verification, verified}` tool. `verified:true` is rejected unless a `run_command` ran after the last accepted edit; the rejection says what is missing.
- If a turn ends with accepted edits and no valid `finish_task`, send exactly one follow-up on the same session (uses the last completed turn id).
- `verified:false` with a reason is always accepted (user denied tests, no tests in repo, docs-only change).
- Change set shows a green "verified: <command> passed" or amber "not verified: <reason>" chip.

### G2 Scope badges (A1, B2)
- Inline: any hunk outside the selected range (plus the selected function's docstring) gets an amber "outside selection" badge.
- Agent: any hunk on lines the agent never saw (no `read_file` range, no pack slice covering them) gets an amber "edited without reading" badge. New files exempt.
- Badges never block Accept; the tool result tells the model which hunks were flagged.

### G3 Grounding badges (B2, B3)
- For each proposed hunk, extract names the new text uses (bare calls, `from x import y`, `import x`) and check against the workspace symbol index, the file's own definitions, Python builtins and imported modules. Unknown → red "`name` is not defined anywhere" badge; the tool result tells the model.
- Extra when available: VS Code diagnostics delta on the edited file after apply ("new problems" fed back).
- Only flag when confident; skip attribute access on unknown objects.

### M3 Partial-rejection feedback (B2)
- Partial/rejected results add: "Accepted hunks are already written; do not re-send them. This was the user's decision, not a tool failure. Use the current text below as the new baseline." plus the current region (±4 lines around hunks, numbered, ≤60 lines).
- Failed `old_string` matches add "the file may have changed since you last read it; read it again".
- If auto-format changed the applied text, say so.

### M4 run_command (A2)
- First line: `exit N · <summary> · <wall time>s` with pytest/jest summary and first failure location when parseable.
- Clip ~2k head / ~10k tail with "original N lines, M shown"; strip ANSI; `PAGER=cat`, `GIT_PAGER=cat`, `CI=1`; stdin closed.
- Inactivity timeout (no output for N s) plus a hard cap; explicit "timed out after Ns"; kill the process tree (`taskkill /T /F` on Windows, process group on POSIX).

### Below the line (only if time remains)
M2 read-only subagents (deny write tools and nested subagents; allow a read-only command allowlist) · M7 loop guard (identical call or short A→B cycle: nudge at 3, stop at 5, reset on accepted edit) · M6 plan tool for weak models · M10 wrap-up via `finish_task` at the iteration limit.

## Testing
- Unit tests (`node --test`) for pure logic in every ticket.
- Fake OpenAI-compatible model server (scripted replies) for deterministic scenarios: early-stop (M8), mid-turn note (M11), partial reject (M3), huge output (M4), ghost symbol (G3), out-of-selection hunk (G2).
- Model matrix (Q21): smoke Task A+B once on Haiku/Sonnet/Opus 5.5, 3 OpenRouter free models, xAI/Groq, `qwen3:8b`, `qwen2.5-coder:7b`; before/after (`main` vs branch, 2 runs) on Sonnet 5.5, `qwen3:8b`, `cohere/north-mini-code:free`.

## Success criteria
- Tasks A, B, C still pass on Sonnet 5.5; Task A passes on Haiku 5.5 and `qwen3:8b`.
- Task B: 0 environment-caused failed test runs; 0 runs ending with untested edits; context hit rate shown.
- All fake-model scenarios pass. Before/after table filled from measured runs, regressions reported.
