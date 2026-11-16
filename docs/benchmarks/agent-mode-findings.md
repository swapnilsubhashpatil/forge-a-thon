# Agent-mode benchmark findings (10 Nov 2026)

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
| Groq gpt-oss-120b | `400: 'messages.2' property 'reasoning_content' is unsupported`: TrueForge echoes reasoning back in assistant messages and Groq rejects it. **Harness bug → TrueForge PR candidate.** |
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

## Re-run after context work (10 Nov, evening): by harness trait

Branch re-run on the 7 answering models (co-change ranking, project rules, retry follow-up, restore), 2 runs each,
against the same main runs. Full table in [agent-mode.md](agent-mode.md) ("By harness trait").

| Trait | Metric | Before | After |
|---|---|---|---|
| Verification loops | Task B ended with untested edits | 11/14 | **0/14** |
| | Verified finish backed by a passing check | 0/14 | **10/14** (every passing run) |
| | Failed test runs per Task B | 3.1 | **0.3** |
| | Task B fully passed | 9/14 | **10/14** (GPT-5.4-mini 1/2 → 2/2) |
| Context and state | read_file calls per Task B | 5.2 | 4.3 |
| | Input tokens per Task B | 193k | **141k (−27%)** |
| | Edited files inside Anvil's top-5 prediction | 100% | 100% |
| Safe execution | Cancel clean / failover | 14/14 · 10/14 | 14/14 · 10/14 |
| | Restore (message + code) left the tree clean | n/a | **14/14** |
| Guardrails | Scope / grounding / loop warnings fired | 0 | 0 |

Limits, stated plainly:
- **Guardrails never fired on Task B.** The models that pass it stay in scope, call real functions and do not loop, so
  this task cannot show G2/G3/M7 working. They are covered by unit tests only; a scripted misbehaving "fake model"
  (ticket 00) is the way to exercise them end to end and is not built yet.
- **Task B is easy for retrieval:** both builds predicted 100% of the edited files. Retrieval quality is measured on
  200 real commits instead: [context-history.md](context-history.md) (test split hit@5 0.825 → 0.854, all@5 0.466 → 0.515).
- Haiku used more tokens after (313k vs 268k: more tool calls); the overall drop comes from Sonnet, Opus and the GPT models.
- Local 7–8B models still fail Tasks A–C on both builds; their "after" numbers are not meaningful.

## Guard scenarios with a scripted model (16 Nov)

`node scripts/e2e-guards.mjs` starts `scripts/fake-model.mjs` (an OpenAI-compatible server that misbehaves on purpose,
registered in TrueForge as a custom provider) and drives the real extension, TrueForge and MCP tool server through
`test/e2e/guards.ts`. Result: **9/9 pass**.

| Scenario | What the scripted model does | Passes when |
|---|---|---|
| G3 + G2 (agent) | edits lines it never read, calling `get_secret_keys()` | the tool result it receives contains both the grounding and the "edited without reading" warning |
| G2 (inline) | selection is `get_debug_flag`, edits `get_load_dotenv` | "outside selection" reaches the model |
| M7 | repeats the same `read_file` | nudge at 3, turn stopped at 5, tree clean |
| M8 | edits, then says "Done, it should work." | exactly one follow-up, a test run, `finish_task` verified |
| M3 | one edit, two hunks; test rejects the first | the model receives "new baseline" and the current text |
| M11 | slow reads; test sends a note mid-turn | the note arrives inside the next tool result, not as a new turn |
| M10 | distinct searches past `iterationLimit=5` | no failover, notice, one wrap-up turn with `finish_task` |
| Attachments | none | the selection is in the request and on the Context card |
| M2 | starts a subagent through TrueForge's own tool; child edits, runs pytest, runs `git log` | edit and pytest refused as read-only, `git log` allowed |

Bugs these scenarios found and fixed:
1. **G2:** a one-line change just past the selection slack was treated as an insertion (one extra line of tolerance) and not flagged.
2. **M7:** a failing test re-run alternating with rejected `finish_task` calls was not caught (wall time differed, `finish_task` was excluded). Timings are now ignored in the result hash and `finish_task` counts.
3. **Settings:** changing `anvil.agent.iterationLimit` (or reasoning effort) mid-session never reached TrueForge; they are now part of the spec key.
4. **M10:** the wrap-up turn continued from the turn *before* the one that hit the limit, so the agent summarised work it could not see. It now continues from the limited turn (TrueForge accepts this).

Not covered end to end: the terminal-to-chat command (the test VS Code has no shell integration; formatting is unit-tested).
