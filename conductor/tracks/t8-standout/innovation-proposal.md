# Innovation proposal: answer the brief's three complaints on screen

Written 18 Nov 2026 after re-reading `docs/problem-statement.pdf` and comparing Anvil with other agents
([agent-mode-comparison.md](agent-mode-comparison.md)). Status: **proposal, not yet in scope** (see plan.md → Parked).

## The hook is already in the brief

The problem statement opens with three complaints:

> it **loses track of the file you care about**, it **rewrites a function you did not ask it to touch**, it
> **confidently edits a symbol that does not exist**.

…and says the five capabilities are "the floor, not the contest; the contest is in how well you build them".
No mainstream agent (Claude Code, Codex, opencode, Cline, Cursor) has a visible guard for any of the three.
Anvil already has the pieces (workspace symbol index, ranked context pack, per-hunk review). Turning each complaint
into a visible guardrail gives the video and write-up a story judges recognise from their own brief.

All three run inside the extension, use no model calls and no services, so they pass every scope-guard check.

## G1 "Never loses the file": live context scorecard (= S3, already planned)

- **What:** the Context card shows predicted files vs files the agent actually read vs files it edited, live.
  Hit rate at the end ("predicted 3 of 3 edited files").
- **Why it's new:** ContextBench calls the gap between explored and used context an open problem; no IDE agent shows it.
- **Scores:** B1 15-pt anchor ("visibly at work… which files it chose and why"), C2.
- **Prerequisite:** fix `noteFileRead` early-return (`src/agent/turnRunner.ts:100-104`).
- **Effort:** ~2–3 h.

## G2 "Never touches what you didn't ask for": scope fence on hunks

- **What:** each hunk in review gets a badge when it falls outside the expected change surface.
  - Inline mode: any hunk outside the selected range (+ the selected function's docstring) → amber "outside selection".
  - Agent mode: hunk edits a function that is neither in the context pack's targets nor reached from them by
    `find_references` → amber "unexpected area". Deleted public symbols → red.
- The model is told in the tool result ("hunk 2 edits `load_dotenv`, outside the selection; the user was warned").
- **Why it's new:** reviewers today must spot drive-by rewrites themselves; nobody flags them.
- **Scores:** A1, B2 (safer review), video moment in Task A.
- **Effort:** ~3 h (hunk ranges vs selection is easy; symbol-span lookup reuses `workspaceIndex` skeletons).
- **Risk:** false positives in agent mode → badge only, never block.

## G3 "Never edits a ghost symbol": grounding check

- **What:** before review, extract identifiers the new text *uses* (calls, imports, attribute names on known modules)
  and check them against the workspace symbol index + the file's own definitions + Python builtins/stdlib imports.
  Unknown → red badge "`get_secret_keys` is not defined anywhere" on that hunk, and the tool result tells the model
  so it can fix it before the user accepts.
- **Why it's new:** hallucinated symbols are the brief's third complaint and the classic weak-model failure; agents
  only find them when tests fail (if they run tests).
- **Scores:** B2, B3 / Round 2 ("organisers re-run Task A with a model they choose": weak models benefit most), C2.
- **Effort:** ~3–4 h for Python (regex/tree-sitter-lite over new lines; index already lists definitions).
- **Risk:** dynamic attributes (`app.config[...]`, `click.*`) → only check bare names and `from x import y`,
  and only flag when confident.

## G4 "Done means verified" (= M5 + M8, already planned)

Detected test command in the pack + `finish_task` gate. Change set shows a green "verified: pytest 57 passed" chip
or an amber "not verified" chip. Completes the story: the agent found the right files (G1), changed only what you
asked (G2), used only real code (G3), and proved it (G4).

## Fit against the deadline (20 Nov, 23:59 IST)

| Order | Item | Effort | Visible in |
|---|---|---|---|
| 1 | G1 / S3 + noteFileRead fix | 2–3 h | Task B context card |
| 2 | M1 prompt + M5 test command | 3.5 h | Task B |
| 3 | G2 scope fence | 3 h | Task A review |
| 4 | G3 grounding check | 3–4 h | Task A/B review |
| 5 | M8 verified chip | 3 h | Task B end |
| — | **Record video** (no later than 20 Nov midday) | | |

M6 (plan checklist), M2–M4, M7 and M10 remain good but are less distinctive; do them only if time remains.

## Write-up framing

Section 4 ("How context is selected") gets G1 numbers. A short "Three guardrails" paragraph in section 3 maps each
complaint from the brief to the guard and its video timestamp, and section 8 lists the false-positive limits of G2/G3
honestly.
