# Goose + Continue: source research for Anvil agent mode

Sources (read from shallow clones, code never run):
- Goose `block/goose` @ `0417a6d`. Paths below are relative to the repo root.
- Continue `continuedev/continue` @ `5522c6f`. Paths below are relative to the repo root.

Builds on `agent-mode-handoff.md` and `research-round2.md`. Round 2 had no Goose or Continue source, so everything here is new. Line numbers refer to those commits. Anything not read in source is marked [unverified].

---

## M1: System prompts, weak and local models, text tool-call parsing

| Technique | Source path:line | How it applies to Anvil |
|---|---|---|
| **Separate system prompt for tiny models.** It drops all tool schemas. The only "tool" is a line starting with `$ `: "To run a shell command, start a new line with $: … Keep your responses brief. State what you are doing, then do it … Do not repeat commands you have already run. Do not use shell commands if you already know the answer." It is 21 lines and includes a one-shot example. | goose `crates/goose/src/prompts/tiny_model_system.md:1-22` (same file in `crates/goose-local-inference/src/prompts/`); loaded by `crates/goose-local-inference/src/tool_emulation.rs:19-49` | This is the most aggressive weak-model mode. For Ollama models under ~7B, Anvil could offer a "shell-only" profile: `$ cmd` lines become a `run_command` tool call. This goes further than the current "limit inline tools" commit. |
| **Emulator is chosen only when native tool calling is absent.** `use_emulator = !native_tool_calling && !request.tools.is_empty()`. Native support is detected from the chat template result. | `crates/goose-local-inference/src/llamacpp/mod.rs:56-114, 532-537` | Decide per model from capabilities, not per provider. |
| **Emulator tool list is just `- name: description`** (no JSON schema). Code mode adds fenced ```` ```execute_javascript ````, ```` ```list_functions ````, and ```` ```get_function_details ```` blocks. | `tool_emulation.rs:51-95` | A cheaper tool listing for small context windows. |
| **Streaming fence parser** fails closed on large documents: `MAX_MARKDOWN_CONTEXT_BYTES = 256*1024` and `MAX_MARKDOWN_PARSE_BYTES = 1024*1024`. Fences need at most 3 spaces of indent and at least 3 backticks. | `tool_emulation.rs:107-140` | Same guard for Anvil's inline-tool parser. |
| **Toolshim (two-model).** The main model writes prose or JSON. A second small interpreter model (`DEFAULT_INTERPRETER_MODEL_OLLAMA = "mistral-nemo"`, set by `GOOSE_TOOLSHIM_OLLAMA_MODEL`) is called with Ollama structured output and turns the text into `{"tool_calls":[{name,arguments}]}`. When there is no call it returns a `noop` tool. | `crates/goose/src/providers/toolshim.rs:55-57, 1112-1150` | Optional fallback. It costs an extra call and is probably too heavy for Anvil's MVP. |
| **Cheap parsers run before the interpreter.** Order: (1) Kimi/DeepSeek-style special tokens `<\|tool_call_begin\|>…<\|tool_call_argument_begin\|>{json}<\|tool_call_end\|>`; (2) inline JSON objects with `name` and `arguments`, extracted by a brace-depth scanner that tracks strings and escapes; (3) the LLM interpreter only as a last resort. Residual markers are stripped. | `toolshim.rs:61-66, 551-660, 665-733, 1300-1369` | **Copy (1) and (2) directly.** Local models often leak special tokens into text. A brace-depth scanner is more robust than a regex. |
| **Tolerant JSON**: parse, and on failure escape invalid backslashes and retry. | `toolshim.rs:495-549` | Windows paths (`C:\Users`) in local-model JSON break `JSON.parse`. Anvil runs on Windows, so this matters. |
| **Tool-name repair** `resolve_tool_name`: strips `:0` index suffixes and the `functions.` prefix, maps `a.b` to `a__b`, then tries the short name, then a unique `*__name` suffix match. | `toolshim.rs:118-164` | Fixes hallucinated or namespaced tool names (`functions.read_file:0`) instead of returning "unknown tool". |
| **Toolshim prompt appendix** (exact): "Break down your task into smaller steps and do one step and tool call at a time. Do not try to use multiple tools at once. If you want to use a tool, tell the user what tool to use by specifying the tool in this JSON format {"name": …, "arguments": {…}}. After you get the tool result back, consider the result and then proceed…" | `toolshim.rs:1290-1298` | Wording for "one call per turn" on weak models. |
| **History rewrite for tool-less mode**: past ToolRequest and ToolResponse blocks become text (`Using tool: X\n{json}`, `Tool result:\n…`, `Tool error: …`) because providers reject tool blocks when no tools are declared. | `toolshim.rs:1219-1280` | Needed if Anvil switches a session between native and inline tool modes partway through. |
| **Continue text-tool framework.** Format is ```` ```tool\nTOOL_NAME: x\nBEGIN_ARG: a\n<value>\nEND_ARG\n``` ````. It avoids JSON and XML on purpose. Rules: "You can only call ONE tool at a time", "The tool code block MUST be the last thing in your response. Stop immediately after the closing fence", "Do NOT wrap tool calls in XML tags like <tool_call> or <function=...>", "Do NOT use JSON format", "Do NOT invent tools". | continue `core/tools/systemMessageTools/toolCodeblocks/index.ts:8-127` | The arg-per-block format means a weak model never has to escape multi-line code inside JSON. **This is a strong candidate for Anvil's inline mode.** |
| **Lenient start detection**: "Poor models are really bad at following instructions, alternate starts allowed". `tool_name:` with no fence is rewritten to ```` ```tool\nTOOL_NAME: ````. Matching is case-insensitive and partial-prefix aware while streaming. | `toolCodeblocks/index.ts:8-12`; `systemMessageTools/detectToolCallStart.ts:3-30` | Hold back streamed text while the buffer could still be a tool-call start. |
| **Tools with handcrafted examples**: `systemMessageDescription {prefix, exampleArgs}` per tool. Other tools get generated `tool_definition` blocks plus one worked example. | `systemMessageTools/buildToolsSystemMessage.ts:7-65` | One-shot examples for core tools only, to save tokens. |
| **Mode selection**: native tools if `capabilities.tools` is set, else a per-provider regex table (`PROVIDER_TOOL_SUPPORT.ollama`); otherwise text tools. An `onlyUseSystemMessageTools` override exists. | `core/llm/toolSupport.ts:3, 125-137, 516-526`; `gui/src/redux/thunks/streamNormalInput.ts:112-119` | A user override is useful when an Ollama model claims tool support but handles it badly. |
| `isRecommendedAgentModel` allowlist of regex combos; the UI warns for other models in agent mode. | `core/llm/toolSupport.ts:490-511`; used in `gui/src/components/ModeSelect/ModeSelect.tsx` | Show a "this model may struggle in agent mode" hint. |
| Continue mode prompts (exact): agent "If you need to use multiple tools, you can call multiple read-only tools simultaneously… only output codeblocks for suggestion and demonstration purposes… For implementing changes, use the edit tools." Plan: "Only use read-only tools. Do not use any tools that would write to non-temporary files." | `core/llm/defaultSystemMessages.ts:62-91` | These are short. Continue relies on tool descriptions rather than a long system prompt. |
| Goose main system prompt is tiny (39 lines). Behaviour lives in per-extension `instructions`, for example developer: "You are responsible for managing your context window, and to minimize unnecessary turns which cost the user money… always reading before editing… Test and verify as appropriate." The Windows variant recommends `findstr`/`Select-String`. | `crates/goose/src/prompts/system.md:1-39`; `crates/goose/src/agents/platform_extensions/developer/mod.rs:43-75` | An OS-specific prompt variant is cheap, and Anvil users are on Windows. |

## M2: Subagents and tool restrictions

| Technique | Source | How it applies to Anvil |
|---|---|---|
| Goose `delegate` tool. Params: `instructions`, `source` (recipe or agent), `extensions` ("Restrict extensions by name… Empty array for none"), `provider`, `model`, `temperature`, `max_turns`, `context`, `working_dir` (must be inside the parent's), and `resume` (subagent id). | `crates/goose/src/agents/platform_extensions/summon.rs:476-552` | Restriction is by extension, not by single tool. Model override per delegate lets a cheap model do research. |
| Delegate description (exact): "Delegates know only instructions + source content. Delegates cannot coordinate. Same-file work = conflicts… Research (read-only): delegates explore and report back. Work (writes): partition files strictly - no two delegates touch the same file." | `summon.rs:531-546` | Use this wording if Anvil adds a subagent tool. |
| Max-turns precedence: call param, then recipe `settings.max_turns`, then `GOOSE_SUBAGENT_MAX_TURNS`, then the global default. | `summon.rs:1434-1440` | |
| Subagent system prompt: "Cannot spawn additional subagents", "The maximum number of turns to respond is {{max_turns}}", "You have access to {{tool_count}} tools: {{available_tools}}", "Avoid exploratory tool usage unless explicitly required… Stop using tools once you have sufficient information". | `crates/goose/src/prompts/subagent_system.md:1-29` | No nesting, and the turn budget is stated in the prompt. |
| Continue CLI subagent: "allow all tools for now", which sets policies to `[{tool:"*",permission:"allow"}]` and restores them afterwards. | continue `extensions/cli/src/subagent/executor.ts:78-89, 195` | Counter-example: there are no restrictions. Anvil should not copy this. |

## M3: Feedback when the user rejects or edits a change

| Technique | Source | How it applies to Anvil |
|---|---|---|
| Goose decline text (exact): "The user has declined to run this tool. DO NOT attempt to call this tool again. If there are no alternative methods to proceed, clearly explain the situation and STOP." | goose `crates/goose/src/agents/tool_execution.rs:151-153` | Strict style. Stops retry loops. |
| Continue rejection text (exact), sent only if `ui.continueAfterToolRejection`: "The user skipped the tool call. If the tool call is optional or non-critical to the main goal, skip it and continue with the next step. If the tool call is essential, try an alternative approach. If no alternatives exist, offer to pause here." Otherwise the loop stops (`CANCELLED_TOOL_CALL_MESSAGE = "The user cancelled this tool call."`). | continue `gui/src/redux/thunks/cancelToolCall.ts:11-46`; `core/tools/constants.ts:2`; `streamResponseAfterToolCall.ts:15-35` | Lenient style, behind a setting. Anvil could offer both: "Reject" stops, "Skip" continues. |
| **Auto-format diff fed back to the model.** After an accepted edit, if the editor's formatter changed the file, the tool output gets: "Along with your edits, the editor applied the following auto-formatting:\n\n{diff}\n\n(Note: Pay close attention to changes such as single quotes being converted to double quotes, semicolons being removed or added, long lines being broken… This will help you ensure future SEARCH/REPLACE operations to this file are accurate.)" | `gui/src/redux/thunks/handleApplyStateUpdate.ts:95-110` | **High value for Anvil.** It prevents the next `edit_file` from failing on stale text after format-on-save. The same idea applies when the user hand-edits the diff before accepting: send back the delta. |
| Accept and reject are logged per tool call (`logAgentModeEditOutcome(..., accepted)`). Auto-accept happens when the tool is set to `allowedWithoutPermission`. | `handleApplyStateUpdate.ts:52-93` | Telemetry, plus auto-approve mode per tool. |
| Per-block accept and reject: `acceptRejectBlock(accept, startLine, numGreen, numRed)` then shifts the remaining CodeLens blocks by `-(accept ? numRed : numGreen)`. | continue `extensions/vscode/src/diff/vertical/handler.ts:234-302` | See A1. A partial accept should report which hunks were kept [unverified: whether a per-hunk result reaches the model; the tool-level status is only accepted or canceled]. |

## M4: Shell tool

| Technique | Source | How it applies to Anvil |
|---|---|---|
| Goose limits: `OUTPUT_LIMIT_LINES=2000`, `OUTPUT_LIMIT_BYTES=50_000`. Over the limit, the full output is saved to a temp file and the model sees the **last** `OUTPUT_PREVIEW_LINES=50` lines, capped at `OUTPUT_PREVIEW_BYTES=10_000`. The byte cap covers `\r` progress bars and minified lines. | goose `crates/goose/src/agents/platform_extensions/developer/shell.rs:161-166, 760-800` | Tail preview plus a spill file is better than head truncation, because errors usually appear at the end. |
| Truncation notice is OS-aware: "[{reason} Full output saved to {path}. Read it with PowerShell commands like `Get-Content -TotalCount 200`, `Select-String`… up to 2000 lines at a time.]" | `shell.rs:722-736` | Copy this with Windows wording. |
| Default timeout `DEFAULT_EXTENSION_TIMEOUT = 300`s, overridable per call with `timeout_secs`. The result includes "Command timed out after N seconds". The structured output has `exit_code` (absent if killed), `timed_out`, and `output_truncated`. | `shell.rs:182-211, 338-345`; `crates/goose/src/config/extensions.rs:10` | Use a structured result instead of free text. |
| Kill: unix uses `process_group(0)` then `kill(-pgid, SIGKILL)`. **Windows uses a Job Object** (`CreateJobObjectW` + `AssignProcessToJobObject` + `TerminateJobObject`), so grandchildren die too. The same kill path runs on user cancel (`cancellation_token`). | `developer/shell_process.rs:34-120`; `shell.rs:467-485` | Node `child.kill()` on Windows leaves orphans. Anvil should use `taskkill /T /F` or a job object. |
| Backgrounded process detection: after exit, stdout drain waits `OUTPUT_DRAIN_TIMEOUT_MILLIS=500`; if that elapses it aborts and reports "Output may be incomplete because stream draining timed out after process exit." | `shell.rs:487-511, 349-353` | Stops `npm run dev &` from hanging the tool. |
| cmd.exe guard: multi-line commands are rejected with "cmd.exe silently truncates commands at newlines — only the first line executes, with exit code 0. Use `&` to chain…". The shell name is also in the tool description. | `shell.rs:259-268`; `developer/mod.rs:136-150` | Windows-specific failure that Anvil will hit. |
| Env markers `AGENT=goose`, `GOOSE_TERMINAL=1`. | `shell.rs:616` | Set `AGENT=anvil` so scripts and git hooks can detect the agent. |
| Continue CLI: **idle** timeout (it resets on every output chunk). Default 180 s, max 600. The message is "[Command timed out after N seconds of no output]". | continue `extensions/cli/src/tools/runTerminalCommand.ts:135-139, 198-209, 266-310` | An idle timeout suits long builds that keep printing. |
| Continue CLI: limits are divided by the number of parallel tool calls (`DEFAULT_BASH_MAX_CHARS=50000`, `DEFAULT_BASH_MAX_LINES=1000`, each divided by `parallelToolCallCount`), with a note added. `truncateOutputFromStart` keeps the tail. | `runTerminalCommand.ts:25-27, 180-185, 211-225` | Good for local models with small context. |
| Continue CLI: move a running command to the background on a user signal. Reply: "Command moved to background. Job ID: … Use CheckBackgroundJob("id") to check status." There is a limit of 5 concurrent jobs. | `runTerminalCommand.ts:94-110, 236-264` | Simple background-job model. |

## M6: Plan / todo

| Technique | Source | How it applies to Anvil |
|---|---|---|
| Goose `todo_write` is **one free-text blob, overwritten each call** (max `GOOSE_TODO_MAX_CHARS`=50 000). It is not a structured checklist. Instructions (exact): "Items never need to be checked off, closed out, or verified. Never redo or re-verify completed work because of these notes." | goose `crates/goose/src/agents/platform_extensions/todo.rs:39-50, 68-79, 101-110` | Notable design choice: Goose de-emphasises checklist bookkeeping, which wastes turns on weak models. |
| The todo is **re-injected every turn** through MOIM (see M10) as "Planning notes (for your reference; items need not be closed out):\n…" and survives compaction. | `todo.rs:156-170` | Anvil should inject the current plan into each request rather than relying on it surviving in history. |

## M7: Loop / repetition detection

| Technique | Source | How it applies to Anvil |
|---|---|---|
| `RepetitionInspector`: counts **consecutive identical** calls (same name and deep-equal args). Call max+1 is denied with reason "Tool '{name}' has exceeded maximum repetitions", finding `REP-001`. Changed args reset the count. | goose `crates/goose/src/tool_monitor.rs:33-135`; test `crates/goose/tests/repetition_inspector_tests.rs` | Simple to port. Note that it denies the call rather than stopping the loop. |
| **It is disabled by default**: registered as `RepetitionInspector::new(None)`, lowest priority after the security, egress, adversary and permission inspectors. | `crates/goose/src/agents/services.rs:741-742` | Goose relies on max turns instead. Anvil should turn it on for local models, with a default of about 3. |
| Stop-hook block cap: "Stop hooks blocked the turn from ending more than {block_cap} consecutive times". | `crates/goose/src/agents/state_machine/ops_stop_hook.rs:37` | Guard against an infinite "please continue" loop if Anvil adds a completion check (M8). |

## M8: Completion / verification

Goose and Continue have no completion check of their own. Goose's developer instructions say "Test and verify as appropriate" (`developer/mod.rs:57`). Goose's todo explicitly says *not* to re-verify (`todo.rs:47`). Goose stop hooks (user-configured) can block turn end, with a cap (above). Continue's subagent prompt says "Clearly indicate when your task is complete" (goose `subagent_system.md:25`). No source-level verification loop was found in either repo [searched for stop-hook/verify; nothing else found].

## M10: Max turns

| Technique | Source | How it applies to Anvil |
|---|---|---|
| `GOOSE_MAX_TURNS` default **1000**. At the limit Goose emits an assistant message with error kind `ResourceExhausted`: "I've reached the maximum number of actions I can do without user input. Would you like me to continue?" | `crates/goose/src/config/base.rs:1359`; `crates/goose-agent/src/max_turns.rs:16, 56-76` | Phrase the stop as a question, so the user's "yes" continues the run. |
| **Turn budget is shown to the model** once half is used: `<turn-budget>{taken}/{max} used</turn-budget>` is added to the per-turn context block. The system prompt says: "When `<turn-budget>` is present… As the budget gets low, become more direct: reduce exploration, batch necessary tool calls, make reasonable assumptions, and focus on finishing the user's task." | `max_turns.rs:22-30, 49-54`; `crates/goose/src/agents/moim.rs:9-23` | **Strong idea for Anvil.** It is cheap and lets the model wind down before the hard cap. |
| **MOIM / turn-context message**: each turn adds an agent-only user message `<turn_context>` with current time, working dir, turn budget, and extension parts (todo). It is **skipped when context < `MIN_CONTEXT_FOR_MOIM = 32_000`** tokens. | `moim.rs:7, 37-101` | Use the same structure. Note the small-context skip, which matters for local models. |
| Continue GUI has no max turns. Recursion `depth` is only capped in tests (`depth > 50`). | continue `gui/src/redux/thunks/streamNormalInput.ts:85` | Counter-example. |

## M11: Messages sent while running

| Technique | Source | How it applies to Anvil |
|---|---|---|
| Goose `SteerOperation`: user messages go into a `SteerQueue` and are drained **only between turns** (after a model turn ends, or when the last role is Tool). They are never injected in the middle of a stream. On cancel, drained messages are kept (`finalize_cancellation`). | goose `crates/goose-agent/src/steer.rs:1-80` | **Matches Anvil's need.** Queue during streaming and inject after tool results, so the model sees them before its next step. |
| Desktop `MessageQueue.tsx` plus `interruptionDetector.ts`. A keyword table maps words to actions: stop ("stop, halt, cancel, abort…"), pause ("wait, hold on"), "no, wrong" to stop, redirect ("actually, instead, change of plans"), "never mind" to stop. | `ui/desktop/src/utils/interruptionDetector.ts:7-45, 56-130` | Lightweight heuristic: a queued "stop" cancels, "actually…" steers. |
| Continue CLI `MessageQueue`: plain FIFO, processed after the current response ends (no mid-turn steering). | continue `extensions/cli/src/stream/messageQueue.ts:6-62` | Baseline. |

## Context management

| Technique | Source | How it applies to Anvil |
|---|---|---|
| Goose auto-compaction at `DEFAULT_COMPACTION_THRESHOLD = 0.8` of context, also capped by `DEFAULT_AUTO_COMPACT_TOKEN_LIMIT = 225_000`. | `crates/goose-context-management/src/lib.rs:32`; `crates/goose/src/context_mgmt/mod.rs:21-53` | |
| Compaction prompt asks for **structured JSON**: `user_intent, technical_concepts, files[{path,summary,key_code}], errors_and_fixes, problem_solving, user_messages, pending_tasks, current_work, next_step`. Rules: "Quote error messages… verbatim", "Omit a field rather than inventing content", "No new ideas unless user confirmed". | `crates/goose-context-management/src/prompts/compaction.md` | A JSON summary is easier for a weak model to follow, and Anvil can validate it. |
| Summarizer overflow retry: `REMOVAL_PERCENTAGES = [0,10,20,50,100]`. Tool responses are dropped **from the middle outwards** on each `ContextLengthExceeded`. | `goose-context-management/src/summarize.rs:14, 36-70, 120-170` | Graceful when compacting on a small model. |
| Continuation texts (exact): "Your context was compacted. The previous message contains a summary… Do not mention that you read a summary… Continue calling tools as necessary to complete the task." (tool-loop variant) | `context_mgmt/mod.rs:61-75` | |
| Optional tool-pair summarization (`GOOSE_TOOL_PAIR_SUMMARIZATION`, default off). Old call/result pairs are summarized in batches of 10. Cutoff `(3*effective_limit/20000).clamp(10,500)`, and the current turn's calls are protected. | `context_mgmt/mod.rs:27, 55-59, 409-450` | Gentler than full compaction. |
| Continue CLI compaction: `AUTO_COMPACT_BUFFER_CAP = 15_000`, `RATIO = 0.8`, with a free-text prompt "…Make sure it is clear what the current stream of work was at the very end prior to compaction…" | continue `extensions/cli/src/compaction.ts:18-43` | |

## B1: Retrieval, ranking, repo map, @-mentions (Continue)

| Technique | Source | How it applies to Anvil |
|---|---|---|
| `nFinal = min(25, contextLength/512/2)`. With a reranker, `nRetrieve = 2*nFinal`. | `core/context/retrieval/retrieval.ts:9, 35-41` | Scales retrieval to context size, which helps local models. |
| No-reranker mix: **1/4 recently-edited files, 1/4 full-text search, 1/2 embeddings**, plus repo-map LLM selection, then dedupe. | `core/context/retrieval/pipelines/NoRerankerRetrievalPipeline.ts:13-80` | "Recently edited" is a free, strong signal Anvil gets from VS Code. |
| FTS is SQLite FTS5 with `tokenize='trigram'` and a BM25 threshold. | `core/indexing/FullTextSearchCodebaseIndex.ts:21-34` | Cheap local index without embeddings. |
| **Repo-map file selection**: send the repo map, prefill the assistant with `<reasoning>`, and ask for 5–10 exact relative paths inside `<results>`. Only enabled for strong model families (`claude-3, llama3.1, llama3.2, gemini-2.5, gpt-4`). | `core/context/retrieval/repoMapRequest.ts:7-100` | The prefill trick works on Ollama. |
| Repo map is capped at 0.5 × context length, lists file names plus signatures (signature bodies replaced with `...`), and lists any remaining files without signatures. | `core/util/generateRepoMap.ts:18-165` | |
| Autocomplete snippet ranking by **Jaccard similarity of symbol sets** against the window around the cursor, then dedupe. | `core/autocomplete/context/ranking/index.ts:7-70` | Cheap reranker for @-context. |
| @-providers: File, Folder, Code, Codebase, CurrentFile, OpenFiles, Diff, GitCommit, Problems, Terminal, Tree (FileTree), RepoMap, Search, URL, Docs, Clipboard, OS, MCP, and others. | `core/context/providers/*` | Start with Problems, Diff and Terminal: cheap and IDE-native. |

## G3: Diagnostics after edit / hallucinated symbols

Neither repo checks diagnostics automatically after an edit (grepped `getProblems|diagnostic` in Continue `core/tools`, `gui/src/redux`, and `extensions/vscode/src/apply`; grepped LSP and diagnostics in Goose `platform_extensions`: no hits). Continue only exposes `@Problems` as user-pulled context (`core/context/providers/ProblemsContextProvider.ts:11-55`), and the auto-format diff feedback (M3) is the closest thing to post-edit feedback. **This is an open gap: no source here does it, so Anvil would be first.**

Edit-tool robustness (Continue `core/edit/searchAndReplace/`):
- Match strategies are tried in order: `exactMatch → trimmedMatch → caseInsensitiveMatch → whitespaceIgnoredMatch`. A Jaro-Winkler fuzzy match (threshold 0.9) exists but is **commented out** (`findSearchMatch.ts:301-309, 222-290`).
- Multiple-match error (exact): "String "…" appears N times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true" (`performReplace.ts:119-124`). The replacement indentation is adjusted (`adjustReplacementIndentation`).
- Goose edit errors: "No match found for the specified text.", "Found {} matches. Please provide more context to identify a unique match:" (and lists them), "No change made: the replacement text is identical…" (`developer/edit.rs:135-154`).

## A1: Inline diff / streaming UI (Continue VS Code)

| Technique | Source | How it applies to Anvil |
|---|---|---|
| **Streaming line diff** (`streamDiff`): a greedy matcher over the incoming new lines against the remaining old lines. It emits `old/new/same` as tokens arrive and becomes more permissive after the first indentation mismatch (`seenIndentationMistake`). | `core/diff/streamDiff.ts:14-83` | Lets Anvil paint the diff while the model streams. |
| **Myers correction afterwards**: when the stream ends, reject all provisional blocks and reapply with a deterministic Myers diff ("handle scenarios where we miscalculate the original diff blocks"), with a 100 ms delay ("Diff is messed up without this delay"), then scroll to the first change. | `extensions/vscode/src/diff/vertical/handler.ts:188-230, 316-415` | Two passes: fast streaming preview, then a correct final diff. |
| Decorations: added lines use `diffEditor.insertedLineBackground`. **Removed lines are not real text**; each is a whole-line decoration showing the old text as grey `after.contentText`, with the real text hidden (`textDecoration: "none; display: none"`). Index decorations (`rgba(255,255,255,0.2/0.1)`) mark the streaming cursor. | `extensions/vscode/src/diff/vertical/decorations.ts:3-43` | Theme-aware colours from VS Code diff tokens, so this works in light and dark themes. |
| Diff lines are queued with a lock. If the user switches editors, lines wait in the queue and are re-queued on failure. | `handler.ts:159-186` | Avoids corrupt edits when focus changes. |
| Edits use `undoStopBefore/After: false`, so the whole apply is one undo step. | `handler.ts:378, 494` | |
| Apply pipeline: (1) **deterministic tree-sitter lazy apply** for supported languages, which merges `// ... existing code ...` blocks by AST; (2) unified-diff apply if the block looks like a diff; (3) otherwise an LLM "lazy apply" stream. | `core/edit/lazy/applyCodeBlock.ts:9-63`; `core/edit/lazy/deterministic.ts:19-242` | Lets a weak model emit lazy snippets and Anvil merge them with no extra model call. |

---

### Not verified
- Goose desktop `MessageQueue.tsx` UI behaviour (only the detector was read).
- Whether Continue reports a per-hunk partial accept to the model.
- Default value of Goose `GOOSE_TOOLSHIM` (doc comment says false at `toolshim.rs:861`; not traced in config).
