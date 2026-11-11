# Cline + Aider source research (round 3)

Versions read: **Cline** `eff43e1` (2026-11-06) — note: Cline has been re-architected into `sdk/packages/{core,agents,shared}` + `apps/vscode/src/sdk/*`; the old `src/core/prompts/system-prompt/variants/*` tree (next-gen / compact per-family variants) **no longer exists** in this checkout. **Aider** `5dc9490` (2026-05-22). Paths below are relative to each clone root. Nothing executed.

## Headline shifts in Cline (vs. what earlier rounds recorded)
1. Per-model-family prompt variants are gone. Current prompts are three short templates: `sdk/packages/shared/src/prompt/system/act.ts` (36 lines), `yolo.ts` (40 lines), plus plan-mode/mode-tag blocks in `sdk/packages/shared/src/prompt/cline.ts`. Per-model adaptation moved to **tool routing** (`model-tool-routing.ts`), not prompt text.
2. `attempt_completion` is gone in act mode: "Response without tool calls will considered as completed with final answer" (act.ts:30). Only headless/YOLO uses an explicit `submit_and_exit` tool with a `verified` boolean.
3. Loop detection and mistake tracking are now SDK-level runtime safety modules with explicit constants.

## M1 — System prompt structure / weak-model variants

| Technique | Source | Applies to Anvil |
|---|---|---|
| Act prompt: gather context -> present plan -> tool calls; "Always verify the files you have edited or created at the end of the task" | cline `sdk/packages/shared/src/prompt/system/act.ts:3,24,26` | Short (~35 line) prompt is viable; keep one verify line |
| Termination contract: "IMPORTANT: Always includes tool calls in your response until the task is completed. Response without tool calls will considered as completed with final answer." | act.ts:30 | Matches TrueForge "no tool call = done"; state it explicitly |
| Parallel-tool instruction: "identify every independent read, search, command, or edit needed for the next step and emit all of those tool calls now… Do not split independent reads… across separate turns" + examples | act.ts:22-23, yolo.ts:16-17 | Use for strong models only; Anvil already limits inline tools for local models |
| Anti-overthinking: "Be proactive and avoid overthinking. Once the next action is clear, execute it. Do not seek perfect certainty…" | yolo.ts:10 | Good line for local/reasoning-disabled models |
| Anti-thrash: "If repeated fixes fail without new evidence, stop making similar edits. Test your assumptions with a focused check or minimal reproduction" | yolo.ts:11 | Pair with M7 detector |
| Verification block: "Verify by execution, never by assumption… Treat 'this should work', 'assume it works', or 'probably correct' as a signal that you have NOT verified yet" | yolo.ts:31-35 | Strongest verification wording found; copy for M8 |
| "Put complete code… in the tool arguments. Do not draft them in full in your plan" | yolo.ts:12 | Cuts token waste on small models |
| Per-model adaptation via tool routing: gpt/codex/openai-native get `apply_patch`, `editor` disabled | cline `sdk/packages/core/src/extensions/tools/model-tool-routing.ts:60-75` | Anvil: route edit-tool format by model family instead of prompt variants |
| Old compact/next-gen per-family prompt variants | removed from tree [unverified: only absence checked, history not bisected] | Don't chase; earlier notes referencing them are stale |

## M2 — Subagents / read-only modes

| Technique | Source | Applies |
|---|---|---|
| Plan mode keeps `run_commands` but "strictly for read-only inspection"; mutating commands (rm/mv/cp, sed -i, redirection outside /tmp, git working-tree changes, installs) are **hard-blocked by a command-guard hook** and return a tool error | cline `sdk/packages/shared/src/prompt/cline.ts:21-39` | Anvil plan/read-only mode: prompt + hard guard, not prompt alone |
| Mode tags: user messages wrapped in `<user_input mode="plan|act">`, `<mode_notice>` marks switches; "the newest message's mode is what governs right now" | cline.ts:15-17 | Cheap way to make mode switches robust in history |
| VS Code host: model cannot switch modes; must ask user to "toggle to Act mode" (use those words) | cline.ts:46-53 | Same for Anvil |
| Configured subagents exposed as tools: description `Use the "${name}" subagent: ${description}`; own `maxIterations`; "The parent approves delegation; child tools run autonomously" | cline `sdk/packages/core/src/extensions/tools/team/configured-agent-tool.ts:141-170` | Approve once at delegation boundary |
| Team tools: `team_spawn_teammate`, `team_run_task`, `team_status`, `team_cancel_run`… | `.../team/team-tools.ts:305-584` | Out of scope; note only |

## M3 — Feedback after user edits / partial rejects

| Technique | Source | Applies |
|---|---|---|
| `fileEditWithUserChanges`: "The user made the following updates to your content:" + diff, optional auto-format diff with a note on quote/semicolon/line-wrap changes, then full `<final_file_content path=…>` and 4 numbered notes (don't re-write; new baseline; "If the user's edits have addressed part of the task or changed the requirements, adjust your approach"; base future SEARCH on this) | cline `apps/vscode/src/core/prompts/responses.ts:265-283` | Anvil post-review tool result template; note missing `\n` bug after item 3 in Cline's string |
| `fileEditWithoutUserChanges` still returns final content + auto-format diff | responses.ts:285-297 | Return formatter changes even when user accepted as-is |
| Denial with feedback: `${denial} The user provided the following feedback:\n<feedback>…</feedback>` | cline `apps/vscode/src/sdk/tool-approval-denial.ts:24` | Rejection wording |
| Diff failure: "The file was reverted to its original state" + `<file_content>`; "limit yourself to <5 SEARCH/REPLACE blocks"; "If you run into this error 3 times in a row, you may use the write_to_file tool as a fallback" | responses.ts:299-304 | Fallback ladder for weak models |
| Aider partial apply: "# N SEARCH/REPLACE blocks failed to match!", per-block "Did you mean to match some of these actual lines", "The REPLACE lines are already in {path}!", then "# The other N … were applied successfully. Don't re-send them. Just reply with fixed versions of the blocks above that failed to match." | aider `aider/coders/editblock_coder.py:84-122` | Best partial-apply wording; adopt "Don't re-send them" |
| Editor null `old_text`: error ends "Do not re-send this call unchanged." (comment: models re-send identical calls) | cline `sdk/packages/core/src/extensions/tools/executors/editor.ts:249-257` | Every tool error should say how the next call must differ |

## M4 — Terminal / command output

| Technique | Source | Applies |
|---|---|---|
| `MAX_COMMAND_OUTPUT_CHARS = 48_000`, middle-truncated (head+tail kept); tool description tells model "pipe through grep/head/tail" | cline `sdk/packages/core/src/extensions/tools/executors/output-limits.ts:20`, `definitions.ts:469,489` | Anvil cap + say so in the tool description |
| Foreground timeout 1h; **auto-proceed after 300 s** (`FOREGROUND_COMMAND_AUTO_PROCEED_MS`) leaving command running | cline `apps/vscode/src/sdk/vscode-run-commands-tool.ts:49-52,269` | Long-running/dev-server handling |
| Detach messages: "The user chose to proceed while the command is starting or still running in their terminal." / "…after 300 seconds, so Cline automatically proceeded while leaving it running" + path to a log file (cap 10 MB) the model can read later | same file :60,122-159,207-213 | Give model a log path rather than silence |
| Buffered lines capped (`MAX_UNRETRIEVED_LINES`), note `... (N earlier lines dropped) ...` | same :370,431 | |
| "starting another foreground command will attempt to close it, stopping the command if it is still running" | same :458 | Tell the model about side effects |
| SDK bash: default `timeoutMs = 30000`, `Command timed out after ${ms}ms`; detached log `[Command is still running. Output will continue in <path>]`; `[Command completed with background processes still running; their output is no longer captured]` | cline `sdk/packages/core/src/extensions/tools/executors/bash.ts:837-842,887,1093,1138` | |

## M6 — Focus chain / todo

| Technique | Source | Applies |
|---|---|---|
| Old `task_progress`/focus chain is **removed**: `REMOVED_LEGACY_SAY_TYPES = new Set([... "task_progress"])` | cline `apps/vscode/src/sdk/legacy-state-reader.ts:196` | Evidence the checklist-in-every-tool-call design was abandoned |
| Replacement: a `tasks` tool with `kind: "todo"|"scheduled"`, ops create/update/list/get/pause/resume/delete/run_now; todos are "durable Agenda items that require user or automation approval" — not an in-turn plan | cline `sdk/packages/core/src/tasks/task-tool.ts:60-135` | Not a match for Anvil's in-task checklist |
| YOLO: "Keep task notes focused on confirmed facts, decisions, and remaining work. Update existing notes when possible" | yolo.ts:14 | Lightweight alternative wording |
| Re-injection each turn | [unverified] — not found in new SDK | |

## M7 — Loop / mistake detection

| Technique | Source | Applies |
|---|---|---|
| Identical-call detector: signature = tool name + key-sorted JSON input; `softThreshold: 3`, `hardThreshold: 5` | cline `sdk/packages/core/src/runtime/safety/loop-detection.ts:35-85,113-116` | Exact constants to copy |
| Soft: "Detected N consecutive identical calls to `tool`; consider trying a different approach." Hard: "…; stopping to avoid a loop." | loop-detection.ts:147,153 | Inject soft into tool result; stop at hard |
| Legacy wording: "Tool [X] has been called N times consecutively with identical arguments. This is not making progress. Please use a different tool or different arguments…" | responses.ts:309 | |
| Mistake tracker: default `maxConsecutiveMistakes ?? 6`; `forceAtLimit` jumps straight to limit; on limit a host callback decides continue(with guidance appended as recovery notice, counter reset) or stop | cline `sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts:474`, `runtime/safety/mistake-tracker.ts:88-150` | Anvil: at limit ask user for guidance, inject it, reset |
| Feedback wording: "You seem to be having trouble proceeding. The user has provided the following feedback to help guide you:\n<feedback>…" | responses.ts:45 | |
| CLI yolo: stop with "max consecutive mistakes reached (N) in yolo mode" | cline `apps/cli/src/runtime/interactive/mistakes.ts:19` | |
| Aider: `max_reflections = 3`, warns "Only 3 reflections allowed, stopping." | aider `aider/coders/base_coder.py:100-101,939-940` | Cap auto lint/test fix rounds at 3 |

## M8 — Completion gate

| Technique | Source | Applies |
|---|---|---|
| `submit_and_exit` description: "only submit once all necessary steps are completed AND you have verified the result by execution… re-read the task… If the task provides tests, run them… Do not submit on the assumption that your solution works"; `lifecycle.completesRun: true` | cline `sdk/packages/core/src/extensions/tools/definitions.ts:884-900` | Optional explicit-done tool for autonomous mode |
| `verified` flag: "set 'verified' to true only if your tool output shows the requirements are met"; "Response without the submit_and_exit tool call will considered not completed and the task will continue" | yolo.ts:36-38 | Self-reported verification flag shown in UI |
| Interactive act mode: no gate; text-only reply ends the task | act.ts:30 | |

## M10 — Max requests / auto-approve limits

| Technique | Source | Applies |
|---|---|---|
| `maxRequests: 20` is now "Legacy field - kept for backward compatibility" | cline `apps/vscode/src/shared/AutoApprovalSettings.ts:12,32` | Cline dropped request-count limit; mistake/loop limits replace it |
| New limit is behavioural (mistakes=6, loops 3/5) + foreground auto-proceed 300 s | see M4/M7 | |

## M11 — Messages while the agent works

| Technique | Source | Applies |
|---|---|---|
| Two delivery modes: `"queue"` (appended after current turn) vs `"steer"` (aborts current stream via `steerController`) | cline `sdk/packages/core/src/runtime/host/local/agent-event-bridge.ts:35,218-243` | Anvil: offer queue default + "steer now" |
| On steer abort, partial tool-call JSON and reasoning parts are **dropped**, only visible text kept, finishReason forced to "stop" | cline `sdk/packages/agents/src/agent-runtime.ts:2039-2050` | Avoid replaying broken tool calls after interrupt |
| VS Code follow-ups while running → `queueToActiveSession` → `fireAndForgetSend(…, "queue")`; aborted if task changed meanwhile | cline `apps/vscode/src/sdk/sdk-followup-coordinator.ts:128-160` | |

## G3 — Lint / diagnostics after edit

| Technique | Source | Applies |
|---|---|---|
| Aider flake8 fatal-only: `fatal = "E9,F821,F823,F831,F406,F407,F701,F702,F704,F706"`, `--select=` | aider `aider/linter.py:137-142` | Only surface fatal/undefined-name errors, not style |
| Tree-sitter `basic_lint` for any language; **skips typescript** (#1132) | linter.py:201-231 | For TS use VS Code diagnostics instead |
| Output: "# Fix any errors below, if possible." + `tree_context` with `loi_pad=3`, "## See relevant line(s) below marked with █." | linter.py:111-114,234-256 | Show errors in scoped AST context, not raw lines |
| Flow: after edit → lint → auto_commit → `confirm_ask("Attempt to fix lint errors?")` → reflected_message; same for tests | aider `base_coder.py:1598-1622` | Ask-gated auto-fix, capped by max_reflections |
| Cline new-problems: `newProblemsMessage` appended to edit result | responses.ts:283,297 | Wording/timing of diagnostics collection in new SDK [unverified] |

## B1 — Aider repo map ranking

| Technique | Source | Applies |
|---|---|---|
| Personalization `100 / len(fnames)` for chat files, mentioned files, and files whose path component matches a mentioned ident | aider `aider/repomap.py:383,418-445` | Seed PageRank from open/mentioned files |
| Edge weights: ident mentioned ×10; snake/kebab/camel and len≥8 ×10; starts with `_` ×0.1; defined in >5 files ×0.1; referencer is a chat file ×50; refs `sqrt(num_refs)`; self-edge weight 0.1 | repomap.py:479-514 | Concrete constants |
| Map budget: `max_map_tokens`, expanded ×`map_mul_no_files=8` when no files in chat (bounded by context window) | repomap.py:56,120-132 | Bigger map when agent has nothing open |
