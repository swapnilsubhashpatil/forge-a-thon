# 01 G1 Live context scorecard + gauge
Spec: [G1](../spec.md#g1-live-context-scorecard-b1) · Criteria: B1, C2

## Do
- Fix `noteFileRead` (`src/agent/turnRunner.ts:100-104`): it returns early for files already in the pack, so their reads are never recorded. Keep a separate `read` list.
- Record edited files when hunks are accepted (`EditCoordinator` `onApplied`).
- `ContextReport` gains `read: string[]`, `edited: string[]`; the Context card shows predicted / read / edited with hit markers and "edited files in top-5 predicted: n/m".
- Gauge: input tokens from `model.message` usage vs `compactionInputTokens`; cache-hit % = cacheRead / input; "n/a" when the provider has no cache fields; marker on compaction events.

## Acceptance
- Unit test for the hit-rate function.
- Task B run shows the three lists filling live and the final hit line.
- Ollama shows "cache n/a", not 0%.
