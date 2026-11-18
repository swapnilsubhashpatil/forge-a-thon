# 08 M3 Partial-rejection feedback
Spec: [M3](../spec.md#m3-partial-rejection-feedback-b2) · Criteria: B2

## Do
- `describeForModel` (`src/agent/editCoordinator.ts:148`): for partial/rejected add "Accepted hunks are already written; do not re-send them. This was the user's decision, not a tool failure. Use the current text below as the new baseline." + current region (±4 lines around hunks, numbered, ≤60 lines, EOL-safe).
- Match failures: append "the file may have changed since you last read it; read it again".
- When the written text differs from the proposal (auto-format), say so.

## Acceptance
- Unit tests on message text and region capping.
- Fake scenario: accept 1 of 2 hunks → follow-up edit applies first try; rejected hunk not re-proposed.
