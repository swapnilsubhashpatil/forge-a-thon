# Overnight session report (16–17 Nov 2026)

## Outcome
Anvil, a VS Code coding-agent extension whose agent loop runs on TrueForge, is built, reviewed and packaged.
The `development` branch has 18 meaningful commits and is merged into `main`. A 3-page benchmark report
PDF is at `docs/report/anvil-report.pdf`.

## What was built
- **Extension host (TypeScript).**
  - TrueForge client with local auto-start and the loopback allowlist.
  - Localhost MCP tool server with a rotating bearer token.
  - Nine editor tools.
  - Turn runner covering approvals, a model failover chain, circuit breaker, watchdog and cancel.
  - Inline edit command (`Ctrl+Alt+K`).
- **Context engine.**
  - Workspace index with ranking by path, BM25, sibling symbols, test and doc companions, and import-graph PageRank, labelling files as target or reference.
  - Context pack that never exceeds its token budget.
  - Search through VS Code's bundled ripgrep.
  - Read de-duplication.
- **Diff safety.**
  - Edit matching that falls back through four strategies.
  - Inline red/green per-hunk review driven by TrueForge's approval events.
  - Feedback to the model on which hunks were partially accepted.
  - Multi-file undo with conflict detection.
  - Cancel leaves the workspace clean.
- **Webview (React 19 + Tailwind 4).**
  - Context card, compact tool rows, approval cards, subagent rows and failover notices.
  - Changes bar with Undo, composer with `@` mentions, model-chain health.
  - Every colour comes from VS Code theme variables.
- **Project assets.**
  - Conductor (`conductor/`: product, tech stack, workflow, a 17-entry decision log, 7 tracks).
  - README with clean-clone setup.
  - Write-up draft with the required headings.
  - Benchmarks, verification record, VSIX.

## Key decisions (full log: `conductor/decisions.md`)
- **Revamp, not fork.** We took the design language of Kilo Code (MIT) and Cursor and wrote our own code, so there are no licence issues.
- **TypeScript, not Rust.** The loop lives in TrueForge, and the one hot path (search) already uses ripgrep, which is written in Rust.
- **Approval-driven review.** TrueForge's approval step is the safety gate, and per-hunk control sits on top of it.
- **Client-side failover.** Failed attempts are isolated, and only model errors trip the breaker.

## Findings worth knowing
- On Windows, TrueForge binds IPv6 loopback only. Use `http://localhost:8790`; `127.0.0.1:8790` is refused.
- Resuming a paused turn needs `afterEventId`. Without it, TrueForge replays the stream and the client answers approvals twice (HTTP 400).
- The raw REST API uses snake_case; the SDK uses camelCase.
- Ollama's default context window is 4,096 tokens. Qwen 3 without thinking writes invalid tool-call JSON, which Ollama silently drops.

## Verification
- Typecheck is clean, unit tests pass 14/14, and both benchmarks and the VSIX build pass.
- The live spike proved the full approval loop against TrueForge.
- The VS Code E2E ran an agent turn through TrueForge to completion.
- An independent five-lens review found 1 critical and about 20 high/medium defects. All are fixed.

## Open items (need you)
1. **Hosted model key.** Local models on this laptop can't finish the inline edit. Add an OpenAI, Anthropic or Gemini key to `.env`, run `npm run harness`, then `npm run e2e`, and rehearse Tasks A, B and C.
2. **Stopped processes.** Low memory killed TrueForge and the `qwen2.5:7b` download. Restart TrueForge with `npm run harness` when you need it.
3. **Write-up.** Fill in Team and the Scorecard timestamps after recording, then export `docs/writeup.md` to PDF.
4. **Make the repository public** before 20 Nov, 23:59 IST.
5. **Optional:** add a 128×128 `media/icon.png` for the VSIX listing.
