# Benchmarks

All benchmarks run on pallets/flask 3.1.3. Each section links the full report and its raw data.

## Context retrieval

Twelve hand-labelled tasks; does the ranker put the files a correct change touches at the top?

| Ranker | recall@3 | recall@5 | MRR |
|---|---|---|---|
| Anvil | 0.875 | 0.958 | 0.854 |
| BM25 | 0.625 | 0.708 | 0.432 |
| Path only | 0.167 | 0.208 | 0.144 |

The context pack averages 4.5k tokens against 42.7k for sending the same top eight files whole (89.5% smaller).
Indexing takes about 180 ms; ranking and packing one query about 6 ms.

Report: [context.md](context.md) · data: [context.json](context.json) · run: `npm run bench`

## Held-out history

200 real Flask commits since 2021. The request is the commit subject; the truth is the files it changed; the index is
built at the parent commit. Tuned on the dev split, reported on the test split (103 tasks).

| Ranker | hit@1 | hit@5 | all@5 | MRR |
|---|---|---|---|---|
| Anvil before co-change ranking | 0.602 | 0.825 | 0.466 | 0.699 |
| Anvil after | 0.612 | 0.854 | 0.515 | 0.716 |
| BM25 | 0.398 | 0.699 | 0.369 | 0.532 |

Report: [context-history.md](context-history.md) · data: [context-history.json](context-history.json) · run: `node scripts/bench-history.ts`

## Edit matching

198 `old_string` cases built from 30 Flask functions, perturbed the way models get them wrong (trailing whitespace,
tabs, wrong indentation, CRLF, typos, missing blank lines).

| Matcher | Applied correctly | Wrong-location matches |
|---|---|---|
| Exact search and replace | 15.2% | – |
| Anvil cascade (exact, whitespace, indentation, fuzzy) | 97.5% | 0 of 60 |

Report: [edits.md](edits.md) · data: [edits.json](edits.json) · run: `node scripts/bench-edits.ts`

## Agent mode, before and after

The same e2e suite (Task A, Task C failover, cancel, Task B) drives the build before the agent-behaviour work and
the build after it. Seven models that answered (Claude Haiku, Sonnet and Opus 5.5, GPT-5.4-mini, GPT-6.1-sol, two
local Ollama models), two runs each.

| Behaviour | Before | After |
|---|---|---|
| Task B ended with untested edits | 11/14 | 0/14 |
| Task B finished with a claim backed by a passing check | 0/14 | 10/14 |
| Failed test runs per Task B | 3.1 | 0.3 |
| Task B fully passed | 9/14 | 10/14 |
| Input tokens per Task B | 193k | 141k |
| Cancel left the tree clean | 14/14 | 14/14 |
| Restore (message and code) left the tree clean | – | 14/14 |

Pass rates barely move; behaviour does. Models test after editing, stop claiming success without evidence and waste
far fewer runs. Local 7–8B models fail Tasks A to C on both builds. Six more models were excluded because of
provider quota or API errors, not Anvil behaviour; the findings page lists each cause.

The guards that never fire on Task B (scope, grounding, loop, wrap-up, read-only subagents) are exercised by
`node scripts/e2e-guards.mjs` against a scripted misbehaving model: 9 of 9 scenarios pass.

Report: [agent-mode.md](agent-mode.md) · findings: [agent-mode-findings.md](agent-mode-findings.md) ·
data: [agent-mode.json](agent-mode.json) · per-run reports: [runs/](runs) · run: `node scripts/matrix.mjs`
