# Agent-mode behaviour work: handoff

Written 18 Nov 2026 for implementation and testing on the gaming laptop (Ollama + GPU).
Everything below was researched or checked in the 18 Nov session. Claims marked **[unverified]** were
not confirmed against code or a primary source.

Read in this order: §1 status → §2 scope guard → §8 agent-mode plan → §9 testing.

---

## 1. Status snapshot

| Item | State |
|---|---|
| Round 1 deadline | **20 Nov 2026, 23:59 IST** (video + write-up PDF + public repo) |
| Engineering | Tasks A, B, C and cancel passed live on Claude Sonnet 5.5 (17 Nov, `docs/verification.md`) |
| Video | **Not recorded** (C1, 10 pts) |
| Write-up | `docs/writeup.md` drafted; Team and scorecard timestamps empty; no PDF yet (C2, 15 pts) |
| Repo visibility | **PRIVATE**: must be made public before submitting |
| Branches | `main` = baseline for all "before" benchmarks. This branch builds on `development` |

Commits already on this branch beyond `main`:

| Commit | What |
|---|---|
| `56cac55` | **S1**: inline mode exposes only `propose_edit` + `read_file`; `ollama/` models default to reasoning effort `none` |
| `109718e` | **S2**: TrueForge "Output truncated" → new `truncated` failure kind → one same-model retry with reasoning off and 2× output tokens (cap 32k), breaker not tripped |
| `0ad170a` | Scope guard quotes the brief's out-of-scope list verbatim |

Checks at hand-off: `npm run typecheck` clean, `npm test` 21 pass / 1 skip (the skip needs a Flask checkout), `npm run build` ok.
S1 and S2 have **not** been exercised live against TrueForge yet.

---

## 2. Scope guard (do not skip)

Full text: [plan.md](plan.md). Every change must:
1. move a scored criterion (A1–A3, B1–B4, C1–C2) or protect the A/B/C demo;
2. obey eligibility: TrueForge runs the loop, editor actions are MCP tools, **no direct model-provider calls**
   (no embeddings), TrueForge in local mode, no keys in the repo;
3. be listed in plan.md (new ideas go under "Parked" first);
4. avoid the brief's out-of-scope list:
   > tab completion or fill-in-the-middle; training, fine-tuning or hosting your own model; a hosted backend,
   > database or deployed service beyond TrueForge in local mode; user accounts or authentication;
   > publishing to the VS Code Marketplace.

Recording the video outranks every feature in this file.

Scoring reminder: A1 inline 10 · A2 agent mode 10 · A3 streaming/cancel 10 · B1 context 15 · B2 diff safety 10 ·
B3 resilience 10 · B4 TrueForge depth 10 · C1 video 10 · C2 write-up 15. "Judges score behaviour, not model quality."
Round 2: organisers re-run Task A live with a model **they** choose; finals require a PR to TrueForge.

---

## 3. Corrections to existing docs (found 18 Nov)

- **D14 cites the wrong issues.** TrueForge #508 and #1224 are about `createTurn` cancelling the in-flight turn,
  not approval-id collisions (checked with `gh issue view`). Reword D14 and anything in the write-up that repeats it.
- **D8 may be stale on macOS/Linux.** TrueForge now has a local sandbox fallback (`sandbox/localRuntime.ts`,
  PR #306), which could make Skills / Code Mode free there. Not on Windows. **[unverified at runtime]**: check
  `GET /api/v1/capabilities`.
- Add `OLLAMA_GO_TEMPLATE=false` and `OLLAMA_CONTEXT_LENGTH=16384` to the Ollama setup notes (see §9.4).

---

## 4. Research findings: context selection (B1)

- Among Cursor, Cline, Claude Code and Codex, none shows whether its own context selection was right. Cline has a
  context-window bar (cline.bot/blog/understanding-the-new-context-window-progress-bar-in-cline); Claude Code has
  `/context` (code.claude.com/docs/en/context-window). Continue, Roo, Kilo, opencode and Amp were not checked.
  A live "predicted vs read vs edited" check is new.
- Closest prior work: **ContextBench** (arxiv.org/html/2602.05892v2) scores agent trajectories for context
  recall/precision and finds a "substantial gap between explored and utilized context".
- **LocAgent** (aclanthology.org/2025.acl-long.426.pdf): file Acc@5 94% (Claude-3.5) vs SWE-agent 69%,
  OpenHands 74%, Moatless 85% on SWE-bench Lite. Use Acc@5 so our numbers are comparable (different dataset).
- Docs files are missed 73% of the time by agents (arxiv.org/html/2606.11976v1). Our docs/test companion signal is a
  real differentiator; say so in the write-up.
- Aider repo map (aider.chat/docs/repomap.html): reference-weighted tree-sitter graph + PageRank, binary search to fit
  the budget. Our PageRank is import-only.
- **Bug found:** `noteFileRead` (`src/agent/turnRunner.ts:95`) returns early for files already in the pack, so reads
  of predicted files are never recorded. S3 must fix this first.
- Held-out benchmark idea (S5): Flask commit history; message = query, changed files minus CHANGES.rst = truth,
  index at `commit^`. `scripts/bench.ts` hard-codes `C:/Coding/flask-3.1.3` (probably a tarball; needs a real clone).

## 5. Research findings: weak models (B3, Round 2)

- **Ollama silently drops malformed or unknown tool calls** (ollama issues #19187, #19377, #19524, #14570): the
  response comes back `content:"" tool_calls:null done_reason:stop` with `eval_count > 0`. Nothing to parse;
  detect the empty turn and retry. `OLLAMA_GO_TEMPLATE=false` reportedly fixes qwen3:8b tool calls (#19524).
- TrueForge has no tool_choice, structured output, repair hook or lifecycle hooks (hooks = proposal #379).
  `model.params` accepts only max_tokens, temperature, top_p, top_k, parallel_tool_calls, reasoning_effort.
- TrueForge adds 4 meta tools even when every server is `preload:true` (issue #1211; PR #1226 open). S1 reduces
  inline tools to 2 of ours.
- TrueForge truncation message (`core/runtime/finishReasonError.ts`):
  `Output truncated: hit the N token limit[ after M tokens]. Raise max_tokens and retry.` (handled by S2).
- TrueForge issue #447: turns can end silently with `finish_reason=tool_calls`; fix is a nudge message.
- Aider edit-format leaderboard: small models reach 97–100% correct format with `whole`, 73–88% with SEARCH/REPLACE.
- Roo/Cline/Goose: one "you did not use a tool" nudge; Goose parses XML tool calls from text for Ollama.
  Cap corrections at one (uncapped loops: Roo #4900).
- `jsonrepair` cannot reliably fix unescaped `"` inside code (its changelog marks it WIP).

S4 rescue design (unchanged): detect empty / text-only / truncated inline turns → parse locally
(`<tool_call>` JSON → regex old/new → SEARCH/REPLACE → unified diff → single fence as selection rewrite), accept only
if `applyReplacement` places it → else one tool-less "rewrite lines X–Y in one fenced block" turn → normal per-hunk
review with a "Recovered from text output" badge.

## 6. Research findings: TrueForge upstream (Round 2 PRs)

- **CONTRIBUTING.md: PRs need maintainer approval on an issue first** (docs fixes excepted). Open issues early.
- Top 3 PR candidates:
  1. Structured model-error codes on the error state and `turn.done` (`AgentThread.ts:1669` keeps only the message;
     `VercelAILLM.ts:1055` builds `ModelProviderError("Request failed (429): …")`). Removes our regex classifier.
  2. Fix #878 (harness crashes when a loopback MCP server goes down, which happens whenever VS Code closes) + docs section on
     local MCP servers / `OUTBOUND_URL_ALLOWED_HOSTS`.
  3. Windows loopback bind (`config.ts DEFAULT_HOST = 'localhost'` → `::1` on Windows) **[root cause inferred]**.
- Pitch model fallbacks only as a design comment on the roadmap item "Automatic model selection".

Shadow-workspace verification (parked for finals): reusable detached `git worktree` in temp, copy dirty files,
apply hunks, run linked tests with `PYTHONPATH=shadow/src`, baseline-on-HEAD to label pre-existing failures,
status line in review that never blocks Accept. ~1–1.5 days.

## 7. Research findings: agent mode

Sources were shallow clones (read-only, never run) of openai/codex, sst/opencode, cline/cline,
OpenHands/software-agent-sdk, SWE-agent/SWE-agent, SWE-agent/mini-swe-agent, Aider-AI/aider, plus Anthropic
("Building effective agents", "Effective harnesses for long-running agents", "Effective context engineering",
"Writing effective tools for agents", "Multi-agent research system"), Manus ("Context engineering"),
Cognition ("Don't build multi-agents"), OpenAI GPT-5 prompting guide. Re-clone with `git clone --depth 1` if needed.

**What TrueForge does and doesn't do (checked in its source):**
- Ends a turn as soon as the model replies with no tool calls (`AgentThread.ts:1632`). No completion gate.
- At `iterationLimit` it emits only "You have reached iteration limit… please request again".
- No stuck/loop detection.
- Compaction replaces the whole context with `[summary, continuation]`, with no verbatim tail
  (`capabilities/builtins/ContextCompaction.ts:196-270`). The summary prompt honours "# Summary instructions" found
  in the conversation (lines 106-117) **[effect unverified]**.
- Subagents get the same tools, including `propose_edit`.
- Per-call usage is available in `model.message.usage` (input, output, cacheRead/Write, `inputTokensBreakdown`).
  Anvil reads metrics only on `turn.done` (`turnRunner.ts` `applyMetrics`).
- Anthropic `cache_control: ephemeral` is on by default (`VercelAILLM.ts:453-460`). Task B already had 84% cache hits.
- A new user message **cancels** a running or paused turn (`reason: "cancelled-for-next-turn"`), and user messages are
  rejected while approvals are pending (`AgentThread.ts:302`). No mid-turn steering upstream.

**What the strong agents do:**
- Phases are enforced by prompt text + a plan/todo tool the UI renders (Codex `update_plan`, opencode `todowrite`,
  OpenHands `task_tracker`). Nobody enforces explore→edit order in code; plan mode is the only hard gate.
- Early "done" is the top failure mode (Anthropic, Cline, GPT-5 guide). Cline's `submit_and_exit` takes a `verified`
  flag: "Treat 'this should work' as a signal that you have NOT verified yet."
- Stuck detection is harness-side: OpenHands `StuckDetector` (4 identical action/observation pairs, 3 identical
  action/errors, nudge first), Cline loop detection (warn at 3 identical calls, stop at 5).
- Tool output: SWE-agent ablation: 100-line viewer 18.0% vs full file 12.7%; lint guardrail 18.0% vs 15.0%;
  summarised search 18.0% vs iterative 12.0%. mini-swe-agent keeps 5k head + 5k tail with a warning; Codex reports
  exit code, wall time, total lines, timeout.
- Partial rejection: aider says "the other N blocks were applied… don't re-send them"; Cline returns the final file
  content and "rejected by the user… NOT a tool or system failure".
- Subagents should be read-only explorers (Cognition, opencode `explore`, Anthropic: multi-agent ≈ 15× tokens).
- Codex lets read-only MCP tools run in parallel (`readOnlyHint`). Anvil never sets `parallel_tool_calls`.
- Nobody has a "registration / tests / docs" checklist for unnamed files. Anvil's sibling + companion ranker is
  already ahead.

**Anvil facts confirmed 18 Nov:** `propose_edit`/`create_file` have `readOnlyHint:false` but no `destructiveHint`
(`editorTools.ts:146,154`); `run_command` output clipped 50/50 head/tail at 12k chars (`editorTools.ts:180`),
timeout reported only as the word `timeout`; partial-rejection message returns only the rejected diff
(`editCoordinator.ts:156`); a no-op edit message already exists (`editCoordinator.ts:152`); composer is locked while
busy (`webview-ui/src/components/Composer.tsx:160`).

---

## 8. Agent-mode plan (24 research suggestions merged into 10)

Benchmark legend: **🧪 fake model** = scripted misbehaving local model, deterministic pass/fail, no cost (§9.1).
**📊 real models** = Claude Haiku/Sonnet/Opus + local Ollama models, 3 runs each, `main` vs this branch (§9.2–9.3).
"After" is expected behaviour, not a measured result. *(to measure)* = baseline must come from re-running `main`.

### Known baseline (Sonnet 5.5, 17 Nov, `main`)

| Task | Result | Time | Tokens in / out / cached |
|---|---|---|---|
| A inline edit | pass | 6.9 s | 7,878 / 430 / 3,746 |
| B `flask config` | pass, 3 files | 36.0 s | 130,437 / 2,951 / 109,447 (84% cached) |
| B test step | **1 failed pytest run** (missing `PYTHONPATH=src`), then self-fixed | | |

No per-tool-call counts were recorded; the first benchmark run must capture them.

### M1 Rewrite agent instructions. `agents/anvil-agent.json` · 1.5 h · A2
- **Before:** 6-step workflow; no preambles, no persistence line, no "should work ≠ verified", no change-surface checklist.
- **After:** named phases Explore → Plan → Edit → Verify → Summarise; one-sentence preamble before tool batches
  (Codex: "8–12 words"); "keep going until the request is completely resolved"; "find the closest existing analogue
  (e.g. `routes_command`), run `find_references`, treat every file that mentions it as a candidate:
  registration, tests, docs"; "done only when backed by command output"; read several files in parallel.
- **Benchmark 📊:** Task B, all models: unnamed files found (target 3/3), runs ending without tests (target 0),
  tool calls and tokens *(to measure)*.
- **Edge cases:** longer prompt may hurt Haiku/local models. If a model regresses, keep a short variant for weak models.

### M2 Read-only subagents. `src/agent/turnRunner.ts` (`decide()`), `agents/anvil-agent.json` · 1 h · A2, B4
- **Before:** TrueForge subagents can call `propose_edit` and `run_command`.
- **After:** auto-deny write/command approvals from any non-main thread with reason
  "subagents are read-only; return a file list". Instruction: delegate only exploration across 5+ unknown files.
- **Benchmark 🧪:** subagent calls `propose_edit`. Pass = denied, reason reaches model, file unchanged.
- **Edge cases:** subagent wants `git log` (deny all commands; acceptable); nested subagents (test "not main", not a
  specific thread name).

### M3 Partial-rejection feedback. `src/agent/editCoordinator.ts` (`describeForModel`) · 1 h · B2
- **Before:** returns only the rejected diff; model's view of the file is now stale.
- **After:** "Accepted hunks are already written; do not re-send them. This was a user decision, not a tool
  failure. Base your next old_string on the current text below" + the current region (±4 lines around hunks,
  numbered, capped ~60 lines).
- **Benchmark 🧪:** accept 1 hunk, reject 1, model makes a follow-up edit. Pass = applies first try, no rejected
  hunk re-proposed. Before *(to measure)*.
- **Edge cases:** user typed during review (review already discarded); huge region (cap); CRLF (reuse hunks.ts EOL handling).

### M4 Better `run_command`. `src/tools/editorTools.ts` · 2 h · A2
- **Before:** 50/50 head/tail clip at 12k, timeout shown as `timeout`, no wall time, no summary.
- **After:** first line `exit 1 · 2 failed, 55 passed · 3.2s · first failure tests/test_cli.py:412`; ~2k head /
  ~10k tail; env `PAGER=cat CI=1`; explicit "timed out after Ns"; optional `timeout_ms` argument.
- **Benchmark 🧪+📊:** scripted failing test with huge output, pass = first failure visible; test runs per Task B *(to measure)*.
- **Edge cases:** never-ending commands (servers): `exec` timeout kills the shell but **child processes may
  survive**, so kill the process group (POSIX) / `taskkill /T /F` (Windows); strip ANSI colours; close stdin
  (interactive prompts); non-pytest runners → generic "exit code + time"; invalid UTF-8.

### M5 Detected test command in context pack. `src/context/contextPack.ts` · 2 h · B1, A2
- **Before:** instructions hard-code `python -m pytest <path> -q`. Flask's `src/` layout made the first run fail.
- **After:** pack line `Verify with: PYTHONPATH=src python -m pytest tests/test_cli.py -q` (from pyproject /
  package.json scripts / nearest test companion).
- **Benchmark 📊:** environment-caused failed test runs in Task B: before 1 (Sonnet), target 0 on all models.
- **Edge cases:** no pyproject; several frameworks; venv interpreter (prefer the VS Code-selected Python); non-Python
  repos; wrong detection → phrase as a hint ("likely"), omit when unsure; Windows env syntax (set env, don't inline).

### M6 `update_plan` tool + live checklist. `src/tools/editorTools.ts`, `src/agent/toolCallView.ts`, webview · 3–4 h · A2, A3
- **Before:** plan is 1–2 sentences of free text that scroll away.
- **After:** Codex schema `plan[{step, status}]` + `explanation`, ≤ 1 `in_progress`, tool replies "Plan updated";
  panel renders a checklist; instructions require it before the first edit and on status changes.
- **Benchmark 📊:** % of Task B runs with a plan before first edit (target 100% Sonnet/Opus; report others as
  measured); extra tokens and calls the plan costs.
- **Edge cases:** model never calls it (fine); several in_progress (normalise); update spam; plan lost after
  compaction (store per turn in Anvil); cancel mid-plan.

### M7 Stuck-loop guard. `src/tools/toolServer.ts` / `editorTools.ts`, `turnRunner.ts` · 2–3 h · A2, A3
- **Before:** no loop detection anywhere; a looping model burns all 60 iterations.
- **After:** signature = tool name + sorted-key JSON args (+ output hash). 3rd identical → append "You repeated this
  3×; change approach or explain the blocker." 5th → runner cancels with a notice.
- **Benchmark 🧪:** fake model repeats one call forever. Pass = nudge at 3, stop at 5, workspace clean.
  Before = runs to the iteration limit (time/tokens *(to measure)*).
- **Edge cases:** legitimate repeats (pytest re-run after a fix, re-read after an edit): reset counters on every
  accepted edit and require identical args **and** identical output; count per thread; parallel identical calls.

### M8 Check before "done". new `finish_task` tool + `turnRunner.ts` · 3 h · A2, B2
- **Before:** TrueForge ends the turn when the model stops calling tools; edits can land untested.
- **After:** `finish_task {summary, files_changed, verification, verified}` rejects `verified:true` if no
  `run_command` ran after the last accepted edit (rejection lists what is missing). If a done turn has accepted edits
  and no valid finish, send **one** follow-up (Cline `noToolsUsed` wording) to the same session.
- **Benchmark 🧪+📊:** fake model edits then stops → exactly one follow-up, then a test run. Real models: runs whose
  last accepted edit had no later test, before *(to measure)*, target 0.
- **Edge cases:** questions / docs-only changes; repo without tests; tests failing before the change; **user denies
  run_command** → `verified:false` with a reason is always allowed; gate only when files changed and a test command is
  known; cancel during the follow-up; follow-up must use `previousTurnId` of the last completed turn (D12).

### M9 Live metrics strip. `src/agent/turnRunner.ts` (`render`, usage events), webview · 3–4 h · A3, B4
- **Before:** tokens shown only at `turn.done`.
- **After:** live context size vs 60k compaction threshold, cache hit %, tool calls, retries/failovers,
  compactions, subagents, test pass/fail, accepted vs rejected hunks.
- **Benchmark:** displayed numbers equal the e2e JSON report. Visibility only.
- **Edge cases:** providers without cache fields (Ollama) → "n/a" not 0; compaction resets the gauge (mark it).

### M10 Wrap-up at the iteration limit. `src/agent/turnRunner.ts` · 2 h · A2
- **Before:** raw "You have reached iteration limit… please request again".
- **After:** one tools-off follow-up (opencode MAX_STEPS_PROMPT: done / remaining / next) with any tool calls auto-denied.
- **Benchmark 🧪:** fake model with iteration limit 5. Pass = readable summary, no raw error.
- **Edge cases:** **[unverified]** whether a follow-up on the same session resets TrueForge's iteration counter
  (this test settles it); wrap-up itself fails → normal failover; cancel during wrap-up.

### Parked (finals)
Multi-edit `propose_edit` (`edits[]`, all-or-nothing); LSP diagnostics delta after edits (needs a language server);
read-only plan mode (`agents/anvil-plan.json`); compaction steering via "# Summary instructions" (effect unverified);
`parallel_tool_calls: true` (concurrent approvals risk); `destructiveHint:false` on write tools; did-you-mean paths in
`read_file`; M11 below.

### Cross-cutting edge cases (test all of these)
- Cancel at every stage: pending approval, follow-up, nudge, wrap-up → `git status` clean.
- Failover mid-turn: follow-ups/nudges never chain from a failed attempt (D12).
- Non-git workspace, Windows paths and env syntax, two VS Code windows (D17), Auto Save during review.
- Benchmark hygiene: reset the Flask clone between runs; alternate before/after order (warm vs cold cache);
  count harness errors separately from model failures.

---

## 9. Testing strategy

### 9.1 Fake model (deterministic harness tests, no cost) · ~3 h
A small local OpenAI-compatible server (chat completions + tool calls) registered in TrueForge as a `custom`
provider, the same way `scripts/start-harness.mjs` registers Ollama and `BROKEN_PROVIDER_FOR_DEMO`. Each scenario
replays a script of model replies:

| Scenario | Script | Pass condition |
|---|---|---|
| loop | same `read_file` call forever | nudge at 3rd, cancel at 5th, workspace clean (M7) |
| early-stop | `propose_edit` then text "done" | exactly one follow-up, then `run_command` (M8) |
| subagent-write | subagent calls `propose_edit` | denied with reason, file unchanged (M2) |
| partial-reject | two hunks; harness accepts 1 rejects 1; follow-up edit | follow-up applies first try (M3) |
| text-tool-call | tool call written as text / empty reply | rescue path or clear notice (S4) |
| truncated | provider returns `finish_reason=length` | one same-model retry with reasoning none and 2× tokens (S2) |
| iteration-limit | endless tool calls, limit 5 | readable wrap-up, no raw error (M10) |
| huge-output | `run_command` printing 50k chars then a failure | failure line visible in result (M4) |

Pure logic (signatures, message text, clipping, test-command detection) also gets `node --test` unit tests.

### 9.2 Model matrix
- Claude console key: **Haiku 5.5** (weak), **Sonnet 5.5** (mid), **Opus 5.5** (strong): same key, three tiers.
- Local Ollama on the laptop: `qwen3:8b`, `qwen2.5-coder:7b`, optionally `llama3.1:8b`. Earlier notes say the laptop
  GPU has 6 GB VRAM, so 7–8B Q4 models fit and 14B models will not.
- Optional extra providers: any OpenAI-compatible endpoint can be added as a TrueForge `custom` provider
  (free tiers exist; check current limits before relying on them).

### 9.3 Before/after runner · ~2 h
Script loops `{model} × {main, this branch} × 3 runs` over Tasks A and B using `npm run e2e` with
`ANVIL_E2E_MODEL`, `ANVIL_E2E_TASK_B=1`, `ANVIL_E2E_REPORT=<json>`; checks out `main` in a separate worktree for
"before"; resets the Flask clone between runs; aggregates the JSON reports into this table for the write-up:

| Metric (Task B, 3 runs each) | Before (`main`) | After |
|---|---|---|
| Passed (pytest, `flask config`, 3+ files) | Sonnet ✓; others *(to measure)* | |
| Tool calls | *(to measure)* | |
| Input tokens / cache hit % | Sonnet 130k / 84% | |
| Environment-caused failed test runs | Sonnet 1 | target 0 |
| Edits not tested before "done" | *(to measure)* | target 0 |
| Plan shown before first edit | 0% (no plan tool) | target 100% (strong models) |
| 🧪 guard scenarios passed | 0 / 6 (guards don't exist) | target 6 / 6 |

Report every result as measured, including regressions.

Cost estimate: the 17 Nov Sonnet A+B+C run cost well under US$1. 3 Claude models × 2 versions × 3 runs = 18 runs;
expect a few dollars up to roughly $10–20 with Opus. Check console pricing.

### 9.4 Laptop setup (Windows assumed)
- `.env` from `.env.example`; put `ANTHROPIC_API_KEY` there yourself (never commit, never paste into chat).
- TrueForge URL `http://localhost:8790` (not 127.0.0.1; D9). `npm run harness` sets `OUTBOUND_URL_ALLOWED_HOSTS`.
- Ollama: start with `OLLAMA_CONTEXT_LENGTH=16384` (4k default truncates prompts); try `OLLAMA_GO_TEMPLATE=false`
  for qwen3 tool calls **[unverified on the judges' version]**; set `OLLAMA_MODEL` in `.env`.
- Reasoning: S1 now defaults `ollama/` models to `none`; hosted models use `ANVIL_E2E_REASONING=low`.
- Flask: `git clone --branch 3.1.3 https://github.com/pallets/flask.git ../flask-3.1.3`, venv,
  `.venv/Scripts/pip install -e . "pytest==8.3.5"`; e2e needs a Python with Flask deps on PATH or `ANVIL_E2E_PYTHON`.

---

## 10. M11 (parked, needs a decision): messages sent while the agent works

**Goal:** behave like Claude Code: a message sent mid-turn is delivered at the next tool result; the model decides
whether it belongs to the current task (adapt now) or is separate (finish first, then handle it).

- **Before:** composer locked while busy (`Composer.tsx:160`); TrueForge cancels a running turn on a new message.
- **After:**
  1. Composer stays open while busy; a mid-turn message becomes a "queued note" chip.
  2. Delivered by Anvil's MCP server at the next main-thread tool result:
     `<user_note received_mid_task>…</user_note>` + "If this changes the current task, adapt now. If it is a
     separate request, finish the current task first and say you will handle it next."
  3. If the turn ends before any tool result carries it, Anvil sends it as the next turn automatically (never lost).
  4. Per-chip overrides: **Send after** (queue) and **Stop and send** (current behaviour).
- **Edge cases:** note during an approval pause (delivered with that edit's result); several notes (batched in
  order); failover resend (include delivered notes); subagent threads (never); inline mode (always next turn);
  `@file` in a note (pass the path; model reads it); cancel (keep queued notes visible); note contradicts an accepted
  edit (model told which hunks are on disk; can correct or point to Undo).
- **Benchmark:** 🧪 note sent during a 5-call turn appears in the next tool result; a note after the last call
  becomes the next turn. 📊 Task B + mid-turn "also mask keys containing CREDENTIAL": final diff and test cover it
  without restart; measure adapt-now vs after-finish per model.
- **Effort ~5–6 h.** Trade-off decided by the user: M11 vs M7+M8 before 20 Nov.

---

## 11. Suggested order

1. Fake model server + runner (§9.1, §9.3); capture the `main` baseline on all models first.
2. M1, M2, M3, M4, M5 (~7.5 h; low risk, all improve Task B).
3. S3 live prediction scorecard (B1, 15 pts) → M6 plan checklist (visible on video).
4. Re-run the matrix → fill the table → rehearse → **record the video**.
5. Only if time remains: M7, M8 (or M11), then M9, M10.
6. 20 Nov: write-up (timestamps, D14 fix, "Upstream findings" section, before/after table), make repo public, submit.
