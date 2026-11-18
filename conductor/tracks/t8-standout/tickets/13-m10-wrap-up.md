# 13 M10 Wrap-up at the iteration limit (only if time remains)

## Do
- From half the iteration budget, add `<turn-budget>N/MAX</turn-budget>` to tool results.
- On the iteration-limit error: one follow-up turn allowing only `finish_task` (other calls auto-denied), 60 s timer, then a readable summary.

## Acceptance
- Fake scenario with limit 5: readable summary, no raw TrueForge error; settles whether the follow-up resets TrueForge's counter.
