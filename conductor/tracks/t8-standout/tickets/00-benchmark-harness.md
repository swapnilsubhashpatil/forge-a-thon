# 00 Benchmark harness and baseline
Spec: [Testing](../spec.md#testing) · Needs: keys in `.env`, Ollama models pulled

## Do
- Fake OpenAI-compatible model server (`scripts/fake-model.mjs`) replaying a scripted list of replies (text and tool calls); registered by `start-harness.mjs` as a `custom` provider when `FAKE_MODEL=1`.
- Runner (`scripts/matrix.mjs`): `{model} × {main worktree, branch} × runs` over `npm run e2e` with `ANVIL_E2E_MODEL`, `ANVIL_E2E_TASK_B=1`, `ANVIL_E2E_REPORT`; reset the Flask clone per run; alternate before/after order; aggregate to `docs/benchmarks/agent-mode.{json,md}`.
- Capture per run: pass/fail, tool calls by name, tokens in/out/cached, wall time, failed test runs, edits untested before done.
- Start the `main` baseline first: Sonnet 5.5, `qwen3:8b`, `cohere/north-mini-code:free`, 2 runs each.

## Acceptance
- A fake scenario runs headless and returns pass/fail.
- Baseline JSON exists for all three models; harness errors counted separately from model failures.
