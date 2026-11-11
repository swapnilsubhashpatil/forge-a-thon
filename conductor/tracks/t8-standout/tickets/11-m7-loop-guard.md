# 11 M7 Loop guard (only if time remains)

## Do
- Signature = tool name + key-sorted JSON args + output hash. Count identical calls and period-2/3 cycles per thread; reset on accepted edit and on a new prompt.
- 3rd → append nudge to the tool result; 5th → cancel the turn with a notice.

## Acceptance
- Unit tests for signatures and cycle detection.
- Fake scenario: nudge at 3, stop at 5, workspace clean; pytest re-run after an edit not flagged.
