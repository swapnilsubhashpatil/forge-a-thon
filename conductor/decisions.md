# Decision log

Each entry: date, decision, reason, alternatives rejected. Append; never rewrite history.

| # | Date | Decision | Reason | Rejected |
|---|---|---|---|---|
| D1 | 2026-11-17 | Revamp, not fork: own extension, UI language borrowed from Kilo Code / Cursor (compact activity rows, inline review) | Forking Cline/Continue means ripping out their loop (3-4 days) and judges score only our delta; Continue is unmaintained, Roo archived, opencode's extension is a TUI launcher. Kilo is MIT, so borrowing its design language is clean. | Fork Cline, fork Continue, fork Kilo |
| D2 | 2026-11-17 | TypeScript everywhere | See tech-stack.md; Rust adds per-platform binaries for no latency gain. | Rust sidecar |
| D3 | 2026-11-17 | Models live in TrueForge settings; extension stores only a model-name chain | Keys never touch our repo or VS Code settings. | Keys in VS Code secrets |
| D4 | 2026-11-17 | Approval-driven review: `propose_edit`/`create_file`/`run_command` require approval; edit approvals open the inline per-hunk review; ≥1 accepted hunk = allow, none = deny with reason | Uses TrueForge's approval lifecycle as the safety gate (B4) and gives per-hunk control (A1/B2). | Review inside the tool call only |
| D5 | 2026-11-17 | Inline red/green review in the real editor, re-rendered statelessly from (baseline, hunks, decisions) | Cursor-like UX without line-shift bookkeeping; nothing touches disk until decided. | Side-by-side diff editor with global CodeLens setting |
| D6 | 2026-11-17 | Lexical + structural + import-graph retrieval, no embeddings | Embedding APIs would be a direct provider call (banned); recall@5 = 1.0 on our Flask task set. | Vector index |
| D7 | 2026-11-17 | Client-side fallback: classify error text, retry once for rate/5xx, trip circuit breaker (60 s), switch session spec to next model and resend | TrueForge has no built-in fallback; errors carry no codes. | Separate agent per model |
| D8 | 2026-11-17 | Tools preloaded (`preload: true`); subagents + compaction on; sandbox off | Weak models struggle with deferred meta-tools; skills/code mode need a paid sandbox. | Deferred tool loading |
| D9 | 2026-11-17 | TrueForge base URL `http://localhost:8790` (not 127.0.0.1) | Standalone server binds IPv6 loopback on Windows; 127.0.0.1 is refused. | — |
| D10 | 2026-11-17 | Resume paused turns with `subscribeToTurn(afterEventId)` | Without it the stream replays from the start and re-answers approvals (HTTP 400 seen in spike). | — |
| D11 | 2026-11-17 | Local Ollama model (qwen3:4b) as the free test/fallback model | No paid keys on the build machine; proves the custom-provider path. | — |
