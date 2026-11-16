# Anvil architecture

Anvil is a VS Code extension. The agent loop runs in **TrueForge**; the extension is a client that
streams turns, answers approvals, and serves editor tools over a localhost MCP server.

```
 VS Code extension host                                      TrueForge (localhost:8790)
 ┌──────────────────────────────────────────────────────┐   ┌─────────────────────────────┐
 │ ui/ChatViewProvider ◄──state── agent/ConversationStore│   │ sessions · turns · events   │
 │ ui/inlineEdit            ▲                            │   │ agent loop · subagents      │
 │                          │ events                     │   │ compaction · approvals      │
 │ agent/TurnRunner ────────┼── SDK (SSE stream) ────────┼──►│                             │
 │   ├ resilience (classify, breaker, failover)          │   │        │ MCP (HTTP)          │
 │   └ approvals ──► edits/ReviewController (per hunk)   │   └────────┼────────────────────┘
 │ tools/ToolServer  127.0.0.1:<port>/mcp  ◄─────────────┼────────────┘
 │   read_file · search_code · find_symbol · repo_map    │
 │   explain_context · propose_edit · create_file · run_command
 │ context/ WorkspaceIndex ─► rankFiles ─► buildContextPack
 │ edits/  editMatcher · hunks · ReviewController · ChangeLedger
 └──────────────────────────────────────────────────────┘
```

## Module contracts

Relative imports use explicit `.ts` extensions (esbuild bundles them; `node --test` runs them with
native type stripping). Pure modules never import `vscode`, so they run in tests and benchmarks.

### context/ (pure)
- `WorkspaceIndex` (`workspaceIndex.ts`): `new WorkspaceIndex(root)`, `build(): Promise<void>`,
  `files(): FileEntry[]`, `get(path)`, `refresh(path): Promise<void>`, `remove(path)`, `read(path): Promise<string>`.
  `FileEntry = { path, symbols: SymbolEntry[], imports: string[], tokens, terms: Set<string>, docLines: string[] }`,
  `SymbolEntry = { name, kind: "class"|"function"|"method", line, signature }`. Paths are POSIX, root-relative.
- `rankFiles(index, { text, mentions, activeFiles }) => RankedFile[]` (`ranker.ts`),
  `RankedFile = { path, score, role, reasons }`.
- `buildContextPack(index, ranked, budgetTokens) => Promise<{ text, report: ContextReport }>` (`contextPack.ts`).
- `renderRepoMap(index, focusPaths, maxTokens) => string` (`repoMap.ts`).
- `estimateTokens(text) = ceil(chars / 4)` (`tokens.ts`).

### edits/ (pure + vscode)
- `applyReplacement(source, oldString, newString, replaceAll) => MatchResult` (`editMatcher.ts`, pure).
  Cascade: exact unique → line-trimmed whitespace-insensitive → indentation-normalised → fuzzy (≥0.85 similarity, single best).
  Failure returns `{ ok: false, reason, hint }` with the closest lines, so the model can retry.
- `computeHunks`, `renderReview`, `resolveText` (`hunks.ts`, pure).
- `ReviewController` (`reviewController.ts`, vscode): `review(request) => Promise<ReviewOutcome>`, inline
  red/green decorations, per-hunk CodeLens, `acceptHunk/rejectHunk/acceptAll/rejectAll/discardAll`.
- `ChangeLedger` (`changeLedger.ts`, vscode): records pre-change text per file per change set; `undo(id)`.

### tools/ (vscode + MCP SDK)
`ToolServer` binds `127.0.0.1:0`, Streamable HTTP at `/mcp`, bearer token per run. Tool annotations drive
TrueForge approval selectors: reads are `readOnlyHint: true`; `propose_edit`/`create_file` are
`readOnlyHint: false`; `run_command` is `destructiveHint: true`. Agent specs also list them by name.

### harness/ and agent/
- `HarnessProcess`: probe `GET /api/v1/models`; optionally spawn `npx @truefoundry/trueforge` with
  `OUTBOUND_URL_ALLOWED_HOSTS=["127.0.0.1","localhost"]`.
- `HarnessClient`: SDK wrapper (register MCP server, sessions, streams, approvals, cancel).
- `TurnRunner`: one turn end to end, including model failover and approval routing.
- `ConversationStore`: single source of truth for `ChatState`; throttled snapshots to the webview.

## State management
The extension host owns all state (`ConversationStore`). The webview is a pure view: it renders the latest
`ChatState` snapshot and sends intents (`WebviewMessage`). Snapshots are coalesced to one per animation frame
(~33 ms), so streaming deltas never flood `postMessage`. Reloading the webview loses nothing.
