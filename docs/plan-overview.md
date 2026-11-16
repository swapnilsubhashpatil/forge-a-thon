# Plan Overview: TrueForge VS Code Agent

Input for the PRD. Based on the problem statement ([problem-statement.pdf](problem-statement.pdf)), the [project brief](project-brief.md), and research on 16 Nov 2026 (TrueForge docs/source, fork candidates, retrieval and diff techniques).

**Time:** Round 1 is due **20 Nov 2026, 23:59 IST**. That leaves about 4.5 build days. Aim to submit by 18:00 IST on the 20th.

---

## 1. Hard constraints (cannot move)

### Eligibility. Breaking any of these disqualifies the submission.

| # | Constraint | Consequence for the design |
|---|---|---|
| E1 | The agent loop runs on TrueForge. The extension creates sessions and turns through the HTTP API or `@truefoundry/trueforge-sdk`. | No local agent loop. Inline edit (Task A) also goes through a TrueForge turn. |
| E2 | Editor capabilities (read, search, propose write, run command) are exposed as **MCP tools**. The agent decides what to call. | The extension hosts a **localhost HTTP MCP server** (TrueForge only supports remote/URL servers). |
| E3 | TrueForge runs in local mode (`npx @truefoundry/trueforge@latest`). Nothing is deployed. | A launcher script or command starts it with the correct environment. |
| E4 | The extension **never calls a model provider directly** and hard-codes no provider. | Embeddings are ruled out, because TrueForge has no embeddings endpoint. Retrieval is lexical, symbol and graph based. |
| E5 | The repo contains the agent definition. The video shows the TrueForge session for Task B. | Agent specs are committed as JSON and created through the SDK on startup. |
| E6 | If we fork, the upstream loop is removed, the LICENSE/NOTICE is kept, and the fork URL and commit are declared. | Applies only if we fork or vendor code. |
| E7 | No API keys are committed. An example config file ships instead. | `.env.example` and `models.example.json`. `.gitignore` already covers `.env`. |
| E8 | All three links (video, write-up PDF, GitHub repo) are **public** before the deadline. | The repo is currently private. Flip it on the 20th. |
| E9 | Licence is open source and compatible with any upstream. | MIT (TrueForge is MIT, Continue/Cline are Apache-2.0, both compatible). |

### Technical constraints found in research

| # | Fact | Consequence |
|---|---|---|
| T1 | **The SSRF guard blocks loopback/private URLs by default.** Our localhost MCP server is rejected unless TrueForge is launched with `OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'`. The same applies to a local Ollama endpoint. | The launcher **must** set this. Document it in the README. Easy to miss, and missing it breaks everything. |
| T2 | MCP servers are attached to an agent **by name only**. Register with `PUT /api/v1/settings/mcp-servers` (upsert), using header auth for a per-run bearer token. | Register on extension start on a random port, and rotate the token each run. |
| T3 | `@write`/`@destructive` approval only matches tools annotated `readOnlyHint:false` / `destructiveHint:true`. Unlabelled tools run **without approval**. | Annotate every tool. Also list write tools by name in `require_approval_for_tools`. |
| T4 | The deny reason **is passed to the model** (`ApprovalDeny.reason`). | Partial rejections can tell the agent which hunks were rejected. |
| T5 | **TrueForge has no model fallback.** It retries twice internally on 408/429/5xx/connect timeouts. A 401 fails fast. Errors arrive as `turn.done{state:{status:'error', message}}`, with no error code. | Fallback is **client-side**: classify the error message, retry with backoff, then switch to model #2. |
| T6 | There is no per-turn model override. The model belongs to the session's agent (named or inline spec). An inline-spec session can be PATCHed. | Fallback means PATCHing the inline session spec to model #2 and re-sending, or opening a new session on a fallback agent. |
| T7 | SDK `0.185.x` has a breaking turn-pause lifecycle. Pre-November examples are stale. Default SDK timeout is 60 s; set 600. | Pin `0.185.x`. Use `createTurnStream`, `subscribeToTurn` and `createTurnEvents`. |
| T8 | Node ≥ 22 for the SDK, ≥ 22.14 for the server. | Check the Node version of the VS Code extension host. Fallback option: use raw `fetch` + SSE instead of the SDK. |
| T9 | Skills, Code Mode and large-response offloading **need a sandbox** (Daytona cloud key). | Use **subagents + compaction** for the B4 context-engineering feature. Cap our tool outputs at about 4k tokens ourselves. |
| T10 | Open bugs: #878 (a dying localhost MCP server crashes the harness), #447 (local-mode turn ends early after a tool response), #508/#1224 (a duplicate approval cancels the turn), #1385 (Gemini via `custom` provider drops thought signatures). | MCP handlers must never throw at the transport level. Guard against double-sent approvals. Use the native `google-gemini` provider type, not `custom`. |
| T11 | Python symbol providers return nothing without the Pylance extension. `workspace.findTextInFiles` is a proposed API. | Use regex Python skeletons and VS Code's bundled ripgrep, falling back to the `@vscode/ripgrep` package. |

### Fixed-task constraints

- Repo: **pallets/flask tag 3.1.3** (commit 22d92470), with exact instruction wording.
- Video: **≤ 4 min**, order A, B, C, each followed by its on-screen verification. You may cut model waiting time, but not the gap between giving the instruction and the diff appearing.
- Write-up: a 1–3 page PDF with **8 headings in this order**: Team · Starting point · Architecture on TrueForge · How context is selected · Model setup · Scorecard (criterion, timestamp, claim) · Tools used · Known limitations.
- Scoring: when a submission falls between two anchors, **the lower score applies**. Every criterion needs visible proof on screen.

### Out of scope (zero points)
Tab completion or FIM, training or hosting models, hosted backend/database, auth, Marketplace publishing, embeddings/vector DB, Daytona sandbox features.

---

## 2. What we build

```
┌──────────── VS Code extension ────────────────────────────────┐
│ Webview panel (chat, Context card, approvals, timeline)       │
│ Inline edit (Ctrl+I)    Diff review (per-hunk CodeLens, undo) │
│ TrueForge client (SDK): sessions, turns, stream, cancel,      │
│   approvals, fallback chain, first-token watchdog             │
│ Context engine: index, ranking, budgeted pack                 │
│ Local MCP server  http://127.0.0.1:<rand>/mcp  (bearer token) │
│   repo_map · search_code · find_symbol · find_references      │
│   read_file · explain_context · propose_edit · create_file    │
│   run_command                                                 │
└──────────────┬──────────────────────────────▲─────────────────┘
               │ HTTP/SSE                     │ MCP tool calls
               ▼                              │
        TrueForge local :8790 ────────────────┘
               │
               ▼
     model #1 (primary) / model #2 (fallback)
```

### Mapping to the scoring criteria

| Criterion (points) | Build | On-screen proof |
|---|---|---|
| A1 Inline edit (10) | Ctrl+I opens an input box, runs a TrueForge turn on an `inline-edit` agent, and the `propose_edit` approval shows the diff with per-hunk Accept/Reject | The code change and the docstring appear as 2+ hunks. Reject one, accept the other. |
| A2 Agent mode (10) | A webview panel runs the `coder` agent through the tool loop | Counter shows 3+ files (`cli.py`, `test_cli.py`, `cli.rst`) that the prompt never named |
| A3 Streaming/cancel (10) | Deltas are batched every 16–32 ms. Cancel = abort the stream, `sessions.cancel`, and discard staged edits. | Cancel mid-stream, then `git status` is clean |
| B1 Context (15) | A budgeted context pack (≤ 6k tokens) plus just-in-time tools, shown in a **Context card** (files, role, score, reason, token bar) | The card fills during Task B and the agent states "files I'll change and why" |
| B2 Diff safety (10) | Edits are staged and nothing reaches disk before accept. Per-hunk review. Change-set undo. | Reject a hunk, accept, then Undo reverts every file |
| B3 Resilience (10) | Error classifier, backoff with jitter, circuit breaker, first-token watchdog, **automatic fallback to model #2** | Bad key → toast "Primary failed (401) → fallback X" → Task A completes → `git status` is clean |
| B4 TrueForge depth (10) | MCP tools; **approval drives diff review**; an **explorer subagent** plus compaction | Sessions UI shows tool calls, a subagent thread and approvals |
| C1 Video (10) | Shot list (§5) | All three tasks verified and legible |
| C2 Write-up (15) | 8 headings plus a timestamped scorecard and honest limitations | — |

### Key design decisions (recommended defaults)

**1. Approval drives the per-hunk review (B4 + B2 + A1)**
- `propose_edit {path, old_string, new_string}` and `create_file` are approval-gated.
- When `tool.approval_required` arrives, read the arguments from the source `model.message` and compute the proposed text.
- Show it with the **baseline vs buffer** method: the baseline sits in a virtual document, the proposal is written into the editor buffer but not saved, `jsdiff structuredPatch` splits it into hunks, and each hunk gets a CodeLens Accept/Reject.
- Result handling:
  - **All accepted:** send `allow`, then apply and save.
  - **Some accepted:** send `allow`. The MCP handler applies only the accepted hunks and returns "rejected hunks 2,3" to the model.
  - **All rejected:** send `deny` with a reason.

**2. Edit matching that tolerates weak models**
- Try an exact unique match first, then ignore leading whitespace, then fuzzy matching (≥ 0.8).
- On no match or several matches, return a structured error showing the closest lines. This follows Aider's approach.
- Unified diff is not used as the model's input format.

**3. Context engine (B1), deterministic with no network**
- On activation, run `git ls-files`, build regex Python skeletons, extract import edges and tokenize paths and symbols.
- Ranking signals:
  - @mention pinned
  - path match ×3
  - BM25 over symbols and docstrings ×2
  - sibling pattern (`*_command`) ×2
  - companion files (tests/docs) at 0.6× the parent score
  - Aider-style personalized PageRank over the import graph as tie-breaker
  - editor state ×1.5
- Each file is labelled **edit-target** or **reference**. This avoids the trap where `config.py` outranks `cli.py`.
- Pack budget:

| Part | Budget |
|---|---|
| Strategy line | 60 |
| Repo map | 1.5k |
| Candidates table | 400 |
| @mentions | ≤ 3k |
| Code slices | ≤ 1.5k |
| **Total** | **≤ 6k tokens** (chars/4, adjustable in settings) |

- A replay test checks that the Task B prompt ranks `cli.py`, `test_cli.py` and `cli.rst` in the top 5.

**4. Resilience (B3)**
- Errors classified as 401, 403, invalid key or model not found switch to the fallback immediately.
- Errors classified as 429, 5xx, ECONNREFUSED or timeout get one retry (backoff 500 ms ×2, full jitter, 4 s cap), then switch.
- **Unknown errors also switch.**
- A first-token watchdog (15 s) and a 60 s circuit breaker per model run alongside.
- Fallback = PATCH the inline session spec to model #2 and re-send the request.

**5. Undo**
- Keep a `Map<uri, preText>` for each applied change-set. One `WorkspaceEdit` restores all files, skipping and warning on any file the user has edited since.
- No shadow git.

**6. Agent spec defaults**
- `preload: true` for our small server, because weak models handle deferred meta-tools badly (#1211).
- `dynamic_sub_agents` on, plus an "explorer" subagent instruction.
- Compaction on at 60k input tokens.
- Sandbox off, generative UI off.
- `iteration_limit: 60`.
- `require_approval_for_tools: ["propose_edit","create_file","run_command"]`.

---

## 3. Standout features (ranked by impact per unit of effort)

| # | Feature | Lifts | Effort | Call |
|---|---|---|---|---|
| 1 | Fallback chain with a status-bar health dot and fallback toast | B3 (the only route to 10) | 0.5–0.75 d | MUST |
| 2 | "Why these files" Context card with token budget bar, plus an `explain_context` tool so the choice also appears in the session | B1 | 0.5 d plus engine | MUST |
| 3 | Approval-driven per-hunk review with partial allow and rejected hunks fed back to the model | B4, B2, A1 | 0.75 d | MUST |
| 4 | Self-verify loop: the agent runs `pytest` through `run_command` (approval-gated) and fixes failures | A2, C1 | 1 h | DO |
| 5 | Explorer subagent for localization, visible in the Sessions UI | B4, B1 | 2 h | DO |
| 6 | One-click multi-file undo / change-set timeline | B2 | 3 h | DO |
| 7 | "Open in TrueForge" session deep link | B4, C1 | 15 min | DO |
| 8 | Per-turn token and cost meter (`usage.input_tokens_breakdown`) | B1, C2 | 1 h | NICE |
| 9 | Small-model robustness pass: Task A on a free or cheap model | Shortlist call (live rerun with organiser's model) | 2 h | NICE, de-risks |
| — | Editable plan mode, embeddings, Code Mode/skills, tab completion | — | — | SKIP |

**Round 2 PR candidate:** a `fallback_models: []` field in the agent spec, implemented in the harness. It is the gap we work around now and is on TrueForge's roadmap.

---

## 4. Build approach: fork vs scratch

| Option | Effort to parity | Delta judges see | Verdict |
|---|---|---|---|
| **A. From scratch, borrowing selected pieces** (own diff via jsdiff; optionally copy Cline `apps/examples/vscode` shadcn chat components or Continue's diff files, with Apache attribution) | ~3–3.5 d | ~100% our own work | **Recommended** |
| B. Fork Kilo Code `packages/kilo-vscode` (already a thin client over REST/SSE) and swap in the TrueForge SDK | ~3 d | Looks like "Kilo with a new backend"; SolidJS; 260 KB provider monolith | Only if the team knows SolidJS |
| C. Full fork of Cline | 3–4 d just for rip-out | Large deletion diff; proto/gRPC build | No |
| D. Full fork of Continue | 3+ d | GUI coupled to its core LLM layer | No |
| E. Roo Code | — | Upstream archived | No |
| — opencode | — | Its VS Code extension only opens the TUI in a terminal | Not a candidate |

Why from scratch wins here: the rules give fork-based diff UI as their main reason to fork, but our diff design (baseline vs buffer) is about 0.75 day of our own code. It fits the approval flow better than Continue's streaming diff in the buffer. Ripping out any upstream loop costs more time than writing the thin client.

---

## 5. Timeline (5 days)

| Day | Goal | Exit criterion |
|---|---|---|
| **D0 · 16 Nov** | Environment and **spike**: Node 22, Python + Flask 3.1.3 venv, 2 model keys, TrueForge with SSRF allowlist. A Node script registers a hello MCP server, streams a turn, and completes one approval round-trip and one cancel. | Spike passes. Event shapes captured as fixtures. |
| **D1 · 17 Nov** | Extension skeleton; MCP server with all tools; TrueForge client; webview chat with streaming + cancel | Task B runs end to end without diff UI (auto-allow in dev) |
| **D2 · 18 Nov** | Per-hunk diff review + undo; Ctrl+I inline edit; context engine + Context card | Task A and Task B pass with review |
| **D3 · 19 Nov** | Fallback chain + watchdog; explorer subagent; self-verify; session link; rehearse A/B/C 5+ times on the chosen models. **Feature freeze by evening.** | Task C passes. All three tasks pass 5 times in a row. |
| **D4 · 20 Nov** | Record the video; write-up PDF; README clean-clone test; make the repo public; submit by 18:00 IST | 3 public links submitted |

### Role split (up to 5 people)
1. **TrueForge client:** sessions, stream, approvals, cancel, fallback
2. **MCP server + context engine**
3. **Diff review + inline edit + undo**
4. **Webview UI:** chat, Context card, approvals, timeline
5. **Environment/demo owner:** Flask setup, models, launcher, README, rehearsals, video, write-up

---

## 6. Decisions needed (with recommendations)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Base | Scratch + borrowed pieces / fork Kilo / fork Cline | **Scratch + borrowed pieces** |
| D2 | Webview tech | React + Vite / vanilla TS / Solid | **React + Vite** (copy shadcn chat components from Cline's example if needed) |
| D3 | Models | Primary and fallback; paid / free / local | **Primary:** a strong tool-calling model on a native provider (OpenAI or Anthropic, about $5–10 total). **Fallback:** a different provider on a free tier (native `google-gemini`, or Groq through `custom`). Avoid Ollama unless the SSRF allowlist is tested. |
| D4 | Approval granularity | One approval per `propose_edit` call / batch review at the end of the turn | **Per call** (it is the B4 anchor wording) |
| D5 | Diff mechanism | Own baseline vs buffer + jsdiff / vendor Continue vertical diff | **Own**: less code, fits the approval flow |
| D6 | B4 context feature | Subagents / deferred loading / compaction | **Explorer subagent + compaction on**; `preload:true` (no deferred loading, safer with weak models) |
| D7 | Agent definitions | Named agents created from repo JSON / inline specs | **Repo JSON, created as named agents on start**, with inline-spec sessions so the fallback PATCH works |
| D8 | Stretch features | #4–#9 | **#4, #5, #7** certain; #6 and #8 if time allows |
| D9 | Repo licence | MIT / Apache-2.0 | **MIT** (add an Apache NOTICE if any Cline or Continue code is copied) |
| D10 | Team size and roles | — | Confirm team size so roles can be assigned |

## 7. Top risks

1. The SSRF allowlist is forgotten, so MCP calls fail. Mitigation: the launcher command sets it, and the README says so in bold.
2. Node version mismatch between the extension host and the SDK. Mitigation: confirm in the D0 spike; fall back to raw fetch + SSE.
3. Task B is model-dependent. Mitigation: strong primary model, 5+ rehearsals, a backup take.
4. Flaky turns (#447, #508). Mitigation: idempotent approval sending and a watchdog.
5. Windows + Flask editable install. Mitigation: pinned venv steps in the README.
6. Scope creep. Mitigation: freeze features on the evening of 19 Nov; the video and write-up are worth 25 points.
