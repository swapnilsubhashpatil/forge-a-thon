# 07 G3 Grounding badges
Spec: [G3](../spec.md#g3-grounding-badges) · Refs: SWE-agent flake8 F821, Void lint feedback

## Do
- `src/edits/grounding.ts`: from added lines extract bare call names, `from x import y`, `import x`. Known = workspace symbol index + file definitions/params + names assigned in the new text + Python builtins + stdlib modules + imported names. Unknown → flag. Skip attribute access on unknown objects.
- Red badge per hunk; tool result: "`name` is not defined anywhere in the workspace; define or import it".
- Extra: after apply, `vscode.languages.getDiagnostics(uri)` delta → "new problems" lines in the tool result.

## Acceptance
- Unit tests: Flask helpers edit → no flags; invented `get_secret_keys()` → flagged; method on a local object → not flagged.
- Task B on Sonnet: zero false positives.
