# 12 M6 Plan tool for weak models (only if time remains)

## Do
- `update_plan {plan[{step, status: pending|in_progress|completed|blocked|cancelled}], explanation}`; error on more than one in_progress; enabled with the compact profile (ticket 02) or a setting.
- Store per turn; re-send the plan in the tool-result footer so it survives compaction; webview checklist.
- `finish_task` also requires no pending/in_progress items.

## Acceptance
- Unit tests for validation; Task B on `qwen3:8b` shows a checklist.
