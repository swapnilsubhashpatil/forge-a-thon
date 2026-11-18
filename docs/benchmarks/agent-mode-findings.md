# Agent-mode benchmark findings (18 Nov 2026)

Full table: [agent-mode.md](agent-mode.md) · raw rows: [agent-mode.json](agent-mode.json) · per-run reports and logs: `runs/`.
13 models × {main (before), feat/agent-mode-behaviour (after)} × 2 runs = 52 runs, same e2e suite for both builds,
Flask 3.1.3, Tasks A, C, cancel and B scored independently.

## Valid comparison: providers that answered (7 models, 28 runs per build)

Anthropic Haiku 5.5, Sonnet 5.5, Opus 5.5 · OpenAI GPT-5.4-mini, GPT-6.1-sol · Ollama qwen3-8b-16k, qwen2.5-coder-7b-16k (RTX 4050).

| Behaviour | Before | After |
|---|---|---|
| Task A inline edit passed | 10/14 | 10/14 |
| Task C failover passed | 10/14 | 10/14 |
| Cancel left the tree clean | 14/14 | 14/14 |
| Task B fully passed | 9/14 | 9/14 |
| **Task B ended with untested edits** | **11/14** | **1/14** |
| **Task B finished with a verified claim** | **0/14** (no mechanism) | **9/14** (every passing run) |
| **Failed test runs per Task B run** | **3.1** | **0.1** |
| Input tokens per Task B run (hosted models) | 259k | 154k (−41%) |
| Task B wall time (hosted models) | 62 s | 37 s (−40%) |

Reading it:
- **Pass rates are unchanged; behaviour is not.** The same models succeed or fail on the same tasks, but on the branch
  they test after editing, stop claiming success without evidence, and waste far fewer runs.
- **Failed test runs fell from 44 to 2 across the hosted runs.** Before, almost every pytest run failed at least once for environment
  reasons (missing `PYTHONPATH=src`, lowercase drive letter in the cwd on Windows), and models burned turns on it.
  M5 (test command + `PYTHONPATH`) and the cwd fix remove that.
- **Untested edits at the end fell from 11/14 to 1/14** and **verified finishes rose from 0 to 9**: the M8 gate.
  Every "verified" claim on the branch is backed by a passing command after the last accepted edit.
- **Tokens −41% and time −40%** on hosted models follow from fewer failing test loops.
- Local models (8B/7B on a 6 GB GPU) fail Task A and C on both builds: the model does not produce a usable
  `propose_edit`. Anvil behaves the same; this is model capability.

## Excluded: provider or account failures, not Anvil behaviour

| Model | Cause (from the run logs) |
|---|---|
| Groq gpt-oss-120b | `400: 'messages.2' property 'reasoning_content' is unsupported`: TrueForge echoes reasoning back in assistant messages and Groq rejects it. **Harness bug → Round 2 TrueForge PR candidate.** |
| Groq qwen3.8-27b | Model called a non-existent tool `propose allocation`; Groq rejects invalid tool calls server-side before the harness can recover. |
| OpenRouter north-mini-code / gemma-4 / nemotron (free) | `429 free-models-per-day`: the account's free daily quota was used up (OpenRouter asks for $10 of credits for 1000/day). |
| OpenRouter Jev Router | `402 requires more credits` (asked for 8,192 output tokens, can afford 3,977). |

## Found and fixed during benchmarking

1. Turn-budget hint over-counted steps ~15× (model.message is re-emitted per streamed delta); Haiku quit at "116/60".
2. Ollama defaulted to a 4k context and silently truncated prompts; local models now use `*-16k` variants.
3. Windows lowercase drive letter in `run_command` cwd made 7 unrelated Flask tests fail.

## Open gap

GPT-5.4-mini (after, run 2) proposed 4 edits whose `old_string` did not match, then ended without `finish_task`.
The M8 follow-up only fires after accepted edits, so it did not trigger. Extending it to "turn ended after failed edit
attempts" is a small, targeted next step.
