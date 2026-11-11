# Agent mode: what Anvil has vs. other agent harnesses

Written 10 Nov 2026. "Anvil" = this extension. Anvil facts were read from source on branch
`feat/agent-mode-behaviour` (file:line refs below). Facts about other tools come from the source reading recorded in
[agent-mode-handoff.md §7](agent-mode-handoff.md) (Codex, opencode, Cline, OpenHands, SWE-agent, mini-swe-agent, Aider)
or, where marked **[general knowledge]**, from public behaviour that wasn't checked against source this session.

---

## 1. How Anvil's agent mode works today

```
Composer (webview) ──► extension builds context pack ──► TrueForge turn (SDK) ──► model
                                                             │ tool calls
              anvil-editor MCP server (127.0.0.1, bearer token) ◄┘
              read / search / repo_map / propose_edit / create_file / run_command
                    │ write tools pause the turn (tool.approval_required)
                    ▼
              ReviewController: per-hunk diff in the editor → accepted hunks written → ChangeLedger (undo)
```

| Piece | What it does | Where |
|---|---|---|
| Agent definition | 6-step prompt (state plan → read → propose_edit → respect rejections → test → summary), temp 0.2, 60 iterations, subagents on, compaction at 60k input tokens, large-result offload off | `agents/anvil-agent.json`, `src/agent/agentProfile.ts` |
| Loop | TrueForge runs it. Anvil streams events, renders steps, answers approvals, resumes paused turns (≤200 resumes) | `src/agent/turnRunner.ts:303-386` |
| Context pack | Before each turn: rank every file (mentions, path match, BM25, sibling symbols, defines, open editor, import-graph PageRank, test/docs companions), then pack a candidates table with reasons + repo map + code slices under a token budget | `src/context/ranker.ts`, `src/context/contextPack.ts` |
| Tools (9) | `repo_map`, `search_code` (ripgrep), `find_symbol`, `find_references`, `read_file` (400 lines, dedup cache for unchanged ranges), `explain_context`, `propose_edit`, `create_file`, `run_command` | `src/tools/editorTools.ts` |
| Edit review | `propose_edit` = exact/fuzzy string replace → per-hunk accept/reject in the editor → only accepted hunks written; model told accepted/partial/rejected | `src/agent/editCoordinator.ts`, `src/edits/` |
| Safety | Path must stay in workspace (realpath check), refuses dirty files, per-file edit queue, approvals for write tools and commands | `editCoordinator.ts:96-126` |
| Undo | Change sets per turn; "Undo Last Agent Change" restores files | `src/edits/changeLedger.ts` |
| Cancel | Aborts stream, denies pending approvals, discards open reviews, calls TrueForge cancel | `turnRunner.ts:228-240` |
| Resilience | Model fallback chain + circuit breaker (60 s cooldown), failure classifier (auth / 404 / 429 / 5xx / timeout / context / truncated), one same-model retry for 429/5xx, truncation retry with 2× tokens, first-event watchdog, session-lost recovery | `src/agent/resilience.ts`, `turnRunner.ts:153-212` |
| UI | Streamed text + reasoning, tool rows, subagent rows, approval cards, context card (chosen files + reasons), changes bar, model chain health, link to TrueForge session | `webview-ui/src/components/` |

---

## 2. Side-by-side comparison

Legend: ✅ has it · 🟡 partial · ❌ missing.

| Capability | Anvil | Claude Code | Codex CLI | opencode | Cline / Roo | Cursor agent |
|---|---|---|---|---|---|---|
| **Pre-turn context selection with reasons shown** | ✅ ranked pack + "why" table | ❌ agent searches itself | ❌ | ❌ | 🟡 context bar only | 🟡 codebase index, reasons hidden [general knowledge] |
| Repo map / symbol outline | ✅ import PageRank | ❌ | ❌ | ❌ | 🟡 file tree + defs | ✅ embeddings [general knowledge] |
| Test/docs companion files suggested | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Per-hunk review before write** | ✅ | ❌ whole-edit approve | ❌ whole patch | ❌ | 🟡 whole file diff | ✅ |
| Undo of agent changes | ✅ change sets | ✅ checkpoints / rewind [general knowledge] | 🟡 git | ✅ `/undo` | ✅ checkpoints | ✅ checkpoints |
| Model fallback chain | ✅ automatic | ❌ | ❌ | ❌ | ❌ | 🟡 auto model [general knowledge] |
| Plan / todo tool shown in UI | ❌ (free text) | ✅ TodoWrite | ✅ `update_plan` | ✅ `todowrite` | ✅ focus chain / plan mode | ✅ todos |
| Read-only plan mode | ❌ | ✅ | 🟡 approval modes | ✅ `plan` agent | ✅ Plan/Act | ✅ ask mode |
| "Done" requires verification | ❌ | 🟡 prompt only | 🟡 prompt only | 🟡 prompt only | ✅ `submit_and_exit{verified}` | 🟡 |
| Stuck / loop detection | ❌ | 🟡 [general knowledge] | ❌ | ❌ (step cap only) | ✅ warn 3 / stop 5 | 🟡 |
| Graceful wrap-up at step limit | ❌ raw TrueForge error | n/a | n/a | ✅ MAX_STEPS prompt | 🟡 | n/a |
| Subagents | ✅ (can still write) | ✅ explore agents, scoped tools | ❌ | ✅ read-only `explore` | 🟡 | ✅ |
| Read-only subagents | ❌ | ✅ | n/a | ✅ | n/a | ? |
| Command output shaping | 🟡 12k 50/50 clip, timeout = word "timeout" | ✅ tail + exit code [general knowledge] | ✅ exit, wall time, line count, timeout | 🟡 | 🟡 | 🟡 |
| Kills child processes on timeout/cancel | ❌ `exec` kills shell only | ✅ | ✅ | ✅ | 🟡 | ✅ |
| Background / long-running commands | ❌ | ✅ | 🟡 | 🟡 | ✅ | ✅ |
| Lint / diagnostics after edit | ❌ | 🟡 via hooks | ❌ | ✅ LSP diagnostics | ✅ VS Code problems | ✅ |
| Project rules file (AGENTS.md etc.) | ❌ | ✅ CLAUDE.md | ✅ AGENTS.md | ✅ AGENTS.md | ✅ .clinerules | ✅ .cursor/rules |
| Partial-rejection feedback includes current file | ❌ rejected diff only | n/a | n/a | n/a | ✅ final content + "user decision" | ? |
| Messages while agent works | ❌ composer locked; TrueForge cancels on new message | ✅ queued, delivered mid-turn | 🟡 | 🟡 | 🟡 | ✅ queue |
| Chat history survives window reload | ❌ in-memory store (session lives in TrueForge) | ✅ `--resume` | ✅ | ✅ | ✅ | ✅ |
| Parallel read-only tool calls | ❌ | ✅ | ✅ (readOnlyHint) | ✅ | ❌ | ✅ |
| Live token / context gauge | 🟡 totals at turn end | ✅ `/context` | 🟡 | ✅ | ✅ | 🟡 |
| Hooks / custom slash commands / skills | ❌ | ✅ | 🟡 | ✅ | 🟡 workflows | 🟡 |
| Recovery from text-only / empty tool calls (weak models) | ❌ | n/a (Claude only) | n/a | 🟡 | ✅ one nudge | n/a |

---

## 3. Where Anvil is already ahead

1. **Visible, budgeted context selection.** None of the tools above show *which* files were picked and *why* before the
   agent starts. ContextBench and LocAgent treat this as an open problem. Anvil's candidates table directly targets B1.
2. **Companion signal (tests + docs).** Agents miss docs files ~73% of the time (arxiv 2606.11976). Anvil ranks them in.
3. **Per-hunk review tied to harness approvals.** Most terminal agents approve whole edits; Anvil's diff review is
   Cursor-grade and drives TrueForge's approval pause (B2, B4).
4. **Automatic model fallback with health display.** Not built into any of the open-source agents compared.
5. **Read de-duplication** (`ReadCache`) — saves tokens on re-reads; uncommon elsewhere.

---

## 4. Gaps, ranked by value

| # | Gap | Who does it well | Impact | Fix (handoff item) | Effort |
|---|---|---|---|---|---|
| 1 | No plan/todo tool; plan scrolls away | Codex, opencode, Claude Code | agent mode, legibility | M6 `update_plan` + checklist | 3–4 h |
| 2 | Agent can say "done" without running tests | Cline `verified` flag | agent mode, diff safety | M8 `finish_task` gate | 3 h |
| 3 | Test command guessed (`python -m pytest`), failed on Flask `src/` layout | — (nobody detects it) | agent mode, context | M5 detected command in pack | 2 h |
| 4 | Prompt lacks phases, persistence, "should work ≠ verified", change-surface checklist | Codex / GPT-5 guide, Anthropic | agent mode | M1 prompt rewrite | 1.5 h |
| 5 | `run_command`: weak summary, no wall time, child processes survive timeout | Codex | agent mode, streaming/cancel | M4 | 2 h |
| 6 | Partial rejection leaves the model with a stale view | Cline, Aider | diff safety | M3 | 1 h |
| 7 | Subagents can write/run commands | opencode `explore`, Claude Code | TrueForge depth | M2 | 1 h |
| 8 | No loop detection | Cline, OpenHands | streaming/cancel, cost | M7 | 2–3 h |
| 9 | Raw iteration-limit error | opencode | agent mode | M10 | 2 h |
| 10 | Mid-turn messages cancel the turn | Claude Code, Cursor | UX | M11 (parked) | 5–6 h |
| 11 | Reads of pre-selected files aren't recorded (`noteFileRead` returns early, `turnRunner.ts:100-104`) | — | context scorecard | fix before S3 | 15 min |
| 12 | No AGENTS.md / project rules | everyone | minor | read `AGENTS.md`/`CLAUDE.md` into the pack | 1 h |
| 13 | No diagnostics after edits | opencode, Cline, Cursor | minor | parked (needs language server) | — |
| 14 | No chat persistence across reloads | everyone | minor | parked | — |
| 15 | No parallel read-only calls | Codex, Claude Code | speed | parked (approval races) | — |

Items 12–15 are common in other tools but matter less for Anvil; they're listed so its
limitations can be named honestly.

---

## 5. Recommendation

Do 1–7 + 11 (≈ 14 h, mostly low-risk, all visible in Task B). They close the biggest behavioural gaps against
Claude Code / Codex / Cline while keeping Anvil's unique strengths (context table, per-hunk review, fallback) front
and centre. Treat 8–10 as stretch; leave 12–15 for later.
