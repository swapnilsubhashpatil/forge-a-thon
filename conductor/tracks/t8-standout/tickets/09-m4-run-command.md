# 09 M4 run_command output and process control
Spec: [M4](../spec.md#m4-run_command-a2) · Criteria: A2 · Refs: gemini-cli process-utils, codex unified_exec, Goose shell

## Do
- Replace `exec` with `spawn` (shell), stdin closed, env `PAGER=cat GIT_PAGER=cat CI=1` (+ PYTHONPATH from ticket 03).
- Inactivity timeout + hard cap; on timeout or turn cancel kill the tree (`taskkill /PID n /T /F` on Windows; detached process group + `process.kill(-pid)` on POSIX).
- Output: strip ANSI; head ~2k / tail ~10k chars with "original N lines, M shown"; first line `exit N · <summary> · <T>s`; pytest/jest summary + first failure location.

## Acceptance
- Unit tests: summary parser (pytest pass/fail/error, jest), clip, ANSI strip.
- Fake scenario: 50k chars then a failure → failure line visible. Timeout leaves no orphan process.
