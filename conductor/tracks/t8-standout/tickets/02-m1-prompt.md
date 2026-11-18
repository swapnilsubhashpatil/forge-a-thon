# 02 M1 Agent prompt + compact variant
Spec: [M1](../spec.md#m1-agent-prompt-a2) · Criteria: A2

## Do
- Rewrite `agents/anvil-agent.json` instructions: Explore → Plan → (Edit → Verify)* → Summarise; one-sentence preamble before tool batches; "keep going until the request is resolved"; change-surface checklist (closest analogue, `find_references`, registration/tests/docs); "verify by execution, never by assumption"; at most two focused fix attempts on the same failure, then report. Mention `finish_task` once ticket 05 lands.
- Add `agents/anvil-agent-compact.json` (≤12 short lines, same rules).
- `AgentProfiles.spec`: compact when `anvil.promptProfile` = `compact`, or `auto` and the model id starts with `ollama/`. Register the setting in `package.json`.

## Acceptance
- Unit test: profile selection for auto/full/compact × model ids.
- Task B passes on Sonnet 5.5; Task A passes on `qwen3:8b` with the compact prompt.
