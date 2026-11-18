# 05 M8 finish_task gate + verified chip
Spec: [M8](../spec.md#m8-completion-gate-a2-b2) · Criteria: A2, B2

## Do
- Tool `finish_task {summary, files_changed[], verification, verified}`; track the last accepted edit and the last `run_command` (with exit code).
- Reject `verified:true` without a command after the last accepted edit; the message lists what is missing. `verified:false` with a reason is always accepted.
- `TurnRunner`: on `done` with accepted edits and no valid finish → exactly one follow-up turn (previousTurnId = last completed turn), Cline-style "you did not finish / verify" wording.
- Change-set chip: green "verified: <command> passed" or amber "not verified: <reason>".

## Acceptance
- Unit tests for the gate rules.
- Fake scenario: edit then text "done" → exactly one follow-up, then `run_command`, then `finish_task`.
- Denied `run_command` → `verified:false` accepted, amber chip.
