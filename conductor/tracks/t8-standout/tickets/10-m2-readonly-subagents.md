# 10 M2 Read-only subagents (only if time remains)

## Do
- In `TurnRunner.decide()`: for threadId ≠ main, deny `propose_edit`/`create_file` ("subagents are read-only; return a file list") and any `run_command` outside the allowlist (`git log|diff|show|status`, `rg`, `ls`, `dir`).
- Instruction: delegate only broad exploration; trust the returned file list. No nested subagents.

## Acceptance
- Fake scenario: subagent `propose_edit` denied with reason, file unchanged; `git log` allowed.
