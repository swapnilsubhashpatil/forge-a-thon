# Product: Anvil

Anvil is a VS Code coding agent whose agent loop runs on **TrueForge** (TrueFoundry's open-source harness).
The extension contributes the editor experience; TrueForge owns sessions, turns, the tool loop, subagents,
compaction and approvals.

## Users
Developers working in a real repository (demo target: pallets/flask 3.1.3) who want an agent that is
transparent (shows what it read and why), safe (nothing written without per-hunk review) and resilient
(survives a failing model provider).

## Must-have capabilities (eligibility gate)
1. Inline edit on a selection with a reviewable diff (Task A).
2. Agent mode across multiple files from one instruction (Task B).
3. Streaming output with cancel that leaves the workspace consistent.
4. Context retrieval with a token budget, visible choices and reasons.
5. Model failover with a clear on-screen explanation (Task C).

## Differentiators
- "Why these files" context card: ranked candidates, roles (target/reference), reasons, budget bar.
- Approval-driven per-hunk review: TrueForge `tool.approval_required` opens an inline red/green review;
  partial accepts are applied and the rejected patch is fed back to the model.
- Client-side fallback chain with circuit breaker, first-output watchdog and health dots.
- One-click multi-file undo per change set.
- Read de-duplication and capped tool outputs keep tokens low; subagents and compaction via TrueForge.

## Out of scope
Tab completion, embeddings/vector stores, auth, hosting, Marketplace publishing, multi-root workspaces.
