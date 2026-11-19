# T9 – UX iteration (branch `feat/ux-iteration`)

Goal: make every shipped feature easy to find and pleasant to use, close the gaps judges and users notice,
and bring docs and benchmarks up to date. Submission: 20 Nov 2026, 23:59 IST.

Sources: three-agent audit (UI, feature flows, competitor research with Firecrawl) on 2026-11-20.
Status: `[ ]` todo, `[~]` in progress, `[x]` done, `[-]` dropped (reason given).

## UI rules (apply to every task)

- No em dash (U+2014) anywhere user-visible. Use an en dash (–) or two sentences. Add a check that fails on it.
- No blinking or pulsing anything. Live state = static text, elapsed time, a determinate bar.
- No stock codicons in the panel. One `Glyph` component with a custom icon set.
- One bundled typeface pair (sans for UI, mono for paths, numbers and code), loaded through the CSP-allowed font-src.
- Minimum label size 11px. Theme colours stay mapped to `--vscode-*` tokens so every theme works.

## Phase 0 – Contract (done first, by lead, before lanes start)

- [ ] 0.1 Extend `src/shared/protocol.ts`: `mode: "agent" | "ask"` on send; image attachment kind; history list/open/delete messages; settings read/write messages; `keepAll` / `discardAll` / `continue` / `retry`; revert scope `"conversation" | "code" | "both"`.
- [ ] 0.2 Pick and wire the typeface and icon set; add the `Glyph` component and the em-dash check script.

## Lane A – Panel (webview-ui)

- [ ] A1 Remove the blink and pulse animations (styles.css keyframes, Dot `pulse`, Header, Reasoning, ToolRow, TurnView). Replace with static state.
- [ ] A2 Replace the 4 em dashes (ApprovalCard, Composer, Header, ModelChain) and the preview fixture.
- [ ] A3 Swap every codicon for `Glyph`; apply the typeface; raise 10px labels to 11px; 2px focus ring.
- [ ] A4 Header: mark, harness status, History, Settings. Remove duplicate New/Open-in-TrueForge (they stay in the view title bar).
- [ ] A5 One usage home: SessionStrip collapses to a hairline bar plus one number; drop ContextGauge from ContextCard; ContextCard closed by default with a one-line summary; scorecard only when expanded.
- [ ] A6 Empty state: readiness checklist (TrueForge, model chain, index size) with fix links, two workspace-based prompts, key hints (Ctrl+Alt+K / L / Q, @, Ask mode).
- [ ] A7 Composer bottom row = control centre: mode switch (Agent | Ask, tints the input border), custom model picker (listbox, provider, health, "fallback #n", usable while busy, "applies to next message"), attach button, Send / Stop. Distinct glyph for the steer-while-busy button.
- [ ] A8 Image attachments: paste, drop and attach button; thumbnail chips; removable. Selection chips open their source range on click.
- [ ] A9 Revert menu on every user message, always visible at low emphasis: Conversation only / Code only / Conversation and code, with inline confirm when code changes. Works on follow-up turns.
- [ ] A10 Continue and Retry on cancelled or failed last turn.
- [ ] A11 Changes tray above the composer: files with +/- counts, per-file Open diff / Keep / Undo, one Keep all / Discard all, pending-review count. Rename "change sets" to "edits".
- [ ] A12 History view: list (title, date, model, edits), search, open, delete; New chat.
- [ ] A13 Settings view: model chain list (reorder, add, remove), reasoning effort, review mode (review each edit / apply and review later), auto-approved command prefixes, read-only list of MCP servers TrueForge sees.
- [ ] A14 Approval card: file link, "Allow for this session", Allow focused so Enter allows.
- [ ] A15 Failover shown inline as a marker on the turn (model A, then model B, reason).

## Lane B – Extension host (src/)

- [ ] B1 Ask mode: `agents/anvil-ask.json` (read-only tools, no subagents), `AgentMode` gains `ask`, turn runner picks the profile from the send message.
- [ ] B2 History persistence: save turn snapshots + TrueForge session id per conversation in `workspaceState`; list, open (reattach the session), delete; New chat keeps the old one in history.
- [ ] B3 Persist the change ledger (`storageUri`, last 50 sets) so Undo and Revert with code survive a reload.
- [ ] B4 Ledger fix: per-file undo state; a set is undone only when every file is; partly undone sets stay visible.
- [ ] B5 Revert fixes: no fake "reverted" turns when the target has no session chain; restore across sessions without losing earlier context.
- [ ] B6 Review mode `anvil.review.mode` = `review` | `applyThenReview`: in the second mode edits apply at once and land in the Changes tray for Keep / Undo.
- [ ] B7 Cross-file `anvil.keepAll` / `anvil.discardAll`, `anvil.nextChange` / `anvil.prevChange` with keybindings; Accept/Reject title buttons only on files under review; hide hunk commands from the palette when nothing is under review.
- [ ] B8 Open diff for edits to existing files (`vscode.diff` of snapshot vs current).
- [ ] B9 @symbol for every language: merge `vscode.executeWorkspaceSymbolProvider` results with the Python/JS index.
- [ ] B10 Images: send attachments as `FileContent` (`data:<mime>;base64,…`) items in `user.message`; size cap; clear message when the model rejects images.
- [ ] B11 Continue / Retry host handlers.
- [ ] B12 Settings bridge: read/write `anvil.*` config from the webview; list TrueForge MCP servers.
- [ ] B13 Auto-approve: `anvil.commands.autoApprove` prefixes + "Allow for this session"; subagent `run_command` follows the same policy.
- [ ] B14 Selection paths consistent: Ask = attach + focus composer with the cursor ready; context-menu items hidden with no folder open; workspace check via `getWorkspaceFolder`.
- [ ] B15 Unregister the MCP server on deactivate.
- [ ] B16 Move the webview message switch out of `extension.ts` into `src/ui/messageRouter.ts`; delete unused `hasPendingReviews`, `onDidChangeState`, `focusInput` or wire them to the tray.

## Lane C – Docs, benchmarks, tests

- [ ] C1 Unit tests: ChangeLedger (partial undo, conflict, multi-set order), history store, webview store reducer.
- [ ] C2 Em-dash and blink check in `npm test`.
- [ ] C3 README: feature table and keys updated (modes, history, revert, tray, images, settings, Ctrl+Alt+L / Q, steering).
- [ ] C4 Write-up: Sumeet's features, new UX, Team section; scorecard rows ready for video timestamps.
- [ ] C5 Verification record: re-run typecheck, unit, guard and e2e suites; record results.
- [ ] C6 Benchmarks page: link the before/after and held-out results; one-paragraph summary.
- [ ] C7 Decide on `docs/claude-planning-session.md` before the repo goes public (contains a local username).

## Out of scope for this iteration

- [-] MCP server marketplace / add-server UI: large, not judged. Settings shows a read-only list instead.
- [-] Custom user-defined modes: two built-in modes are enough.
- [-] Slash commands: low value against the time left; revisit after A/B.

## Owner actions (not code)

- [ ] Make the repo public · record the video (≤ 4 min) · fill the scorecard timestamps · export the write-up PDF
- [ ] Submit the 3 links · star the TrueForge repo · revoke the temporary Anthropic key
