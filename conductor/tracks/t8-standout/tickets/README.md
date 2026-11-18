# Tickets: agent-mode behaviour and guardrails

Spec: [../spec.md](../spec.md). Order = build order. Stop building 20 Nov 12:00 IST.
Every ticket: one commit on `feat/agent-mode-behaviour`, `npm run typecheck` + `npm test` green, no push without asking.

| # | Ticket | Status |
|---|---|---|
| 00 | [Benchmark harness and baseline](00-benchmark-harness.md) | tooling done; matrix running |
| 01 | [G1 context scorecard + gauge](01-g1-context-scorecard.md) | done |
| 02 | [M1 prompt + compact variant](02-m1-prompt.md) | done |
| 03 | [M5 test command](03-m5-test-command.md) | done |
| 04 | [M11 queued messages](04-m11-queued-messages.md) | done |
| 05 | [M8 finish_task gate](05-m8-finish-gate.md) | done |
| 06 | [G2 scope badges](06-g2-scope-badges.md) | done |
| 07 | [G3 grounding badges](07-g3-grounding-badges.md) | done |
| 08 | [M3 rejection feedback](08-m3-rejection-feedback.md) | done |
| 09 | [M4 run_command](09-m4-run-command.md) | done |
| — | *only if time remains* | |
| 10 | [M2 read-only subagents](10-m2-readonly-subagents.md) | done |
| 11 | [M7 loop guard](11-m7-loop-guard.md) | done |
| 12 | [M6 plan tool](12-m6-plan-tool.md) | done |
| 13 | [M10 wrap-up](13-m10-wrap-up.md) | done |
| 14 | [Model matrix + write-up numbers](14-model-matrix-and-writeup.md) | after 09 |

## Added after the benchmark (grilling round 3, 18 Nov)

| # | Ticket | Status |
|---|---|---|
| 15 | M8 follow-up after edits that never applied (gap found by the benchmark) | done |
| 16 | Send editor selection to chat (Ctrl+Alt+L, right-click), exact numbered lines, own 4k budget | done |
| 17 | Send terminal selection or last command + output to chat (clipboard / shell integration) | done |
| 18 | Restore to any message: message only or message + code; per-turn "Undo these changes" | done (e2e `restore` check) |
