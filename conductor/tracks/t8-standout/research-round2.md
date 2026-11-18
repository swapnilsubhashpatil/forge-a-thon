# Research round 2 (18 Nov 2026): what's new beyond handoff §7

Three read-only research passes over shallow clones (gemini-cli, codex, opencode, zed, Roo-Code, SWE-agent) plus
Firecrawl reads. Nothing was run. Paths are repo-relative in the upstream projects. [unverified] = not read in source.

## Per plan item

| Item | New finding | Source | Change to plan |
|---|---|---|---|
| M1 prompt | Two prompt sets chosen by model capability | gemini-cli `packages/core/src/prompts/promptProvider.ts:81` | Ship a short variant for `ollama/` and weak models |
| M1 | "Research → Strategy → Execution", execution = Plan → Act → Validate loop; "Validation is the only path to finality." | gemini-cli `snippets.ts:360,369` | Use Explore → Plan → (Edit → Verify)* → Summarise; reuse the line |
| M1 | "Update related tests, documentation, configuration, or call sites…"; "1-2 focused attempts at fixing diagnostics, then defer"; narrow → broad tests | zed `crates/agent/src/templates/experimental_system_prompt.hbs:53,68,75` | Add attempt cap + narrow-first testing |
| M2 subagents | Explorers keep shell (read-only by prompt), write tools denied, nested subagents denied; result wrapped `<task_result>` | opencode `packages/core/src/plugin/agent.ts:74-93`; codex `core/src/agent/role.rs:331` | Deny writes + nested; allow read-only command allowlist instead of all commands |
| M3 partial reject | Send user changes as patch + "use these changes as the new baseline, no need to re-read" + new diagnostics | Roo `src/integrations/editor/DiffViewProvider.ts:284-360` | Add baseline sentence + diagnostics delta |
| M3 | Failed match → "file has changed on disk since you last read it" | zed `crates/agent/src/tools/edit_session.rs:971` | Add to propose_edit failure text |
| M4 run_command | Process-tree kill: `taskkill /f /t` (Win), `kill -pid` SIGTERM→SIGKILL 200 ms (POSIX); `PAGER=cat GIT_PAGER=cat`; strip ANSI | gemini-cli `packages/core/src/utils/process-utils.ts:31`, `shellExecutionService.ts:609` | Copy |
| M4 | Inactivity timeout (no output for N s) rather than wall clock | gemini-cli `config/config.ts:1321` | Use inactivity timeout |
| M4 | Header: wall time, exit code, original token count; yield + `write_stdin` session for long/interactive commands | codex `core/src/unified_exec/mod.rs:68`, `tools/context.rs:570` | Add wall time + "original N lines, M shown"; yield/session = parked |
| M4 | No harness parses pytest/jest into a summary line | codex, gemini-cli, zed | M4 summary line is novel |
| M6 plan | Statuses incl. `blocked`/`cancelled`; tool *errors* on 2 in_progress | gemini-cli `packages/core/src/tools/write-todos.ts:23,121` | Add statuses; return error, don't normalise |
| M6 | Todo table re-sent to the model every turn as a reminder | Roo `src/core/environment/reminder.ts` | Fixes "plan lost after compaction" |
| M6 | Zed has no plan tool | zed `crates/agent/src/tools/` | Plan tool not universal |
| M7 loop | Period-k cycle detection (k ≤ 5) at 5 repeats; repeated-text detection; LLM judge after 30 turns; reset per prompt; nudge text | gemini-cli `packages/core/src/services/loopDetectionService.ts`, `core/client.ts:1384` | Add k ≤ 3 cycles + repeated-text; skip LLM judge |
| M7 | Per-file failure counter, reset on success | Roo `src/core/tools/ApplyDiffTool.ts:83` | Optional second counter |
| M8 finish | Completion refused while todos open | Roo `src/core/tools/AttemptCompletionTool.ts` | Gate also on open plan items |
| M8 | Subagents must call `complete_task`; stopping without it is a named failure | gemini-cli `packages/core/src/agents/local-executor.ts:375` | Same contract for finish_task |
| M8 | "Next speaker" check: cheap LLM call decides if the model stopped mid-task → "Please continue." | gemini-cli `packages/core/src/utils/nextSpeakerChecker.ts` | Alternative to fixed follow-up (costs a model call via TrueForge) |
| M10 wrap-up | One grace turn, only `complete_task` allowed, 60 s timer | gemini-cli `local-executor.ts:109,426` | Wrap-up through finish_task, with timer |
| M11 steering | Pending input drained between steps, recorded as user messages | codex `codex-rs/core/src/session/turn.rs:555`, `session/input_queue.rs` | Cheaper than estimated (~2–3 h) |

## Guardrails (innovation proposal)

- **G3 grounding:** SWE-agent lints edits with flake8 F821 (undefined name) and rejects new errors
  (`tools/windowed/lib/flake8_utils.py:141`, `tools/windowed_edit_linting/bin/edit`), shown only to the model.
  Nobody shows it per hunk to the user. Cheap extra: `vscode.languages.getDiagnostics()` delta (Pylance).
- **G2 scope fence:** no prior art found in any cloned repo.
- **G1 scorecard:** opencode shows context tokens + cost (`packages/tui/src/mini/footer.view.tsx:210`); nobody shows
  predicted vs read vs edited.

## Not covered
Goose (clone failed), Amp, Continue, Void, Kilo, Cline/Aider latest source, Claude Code internals.
