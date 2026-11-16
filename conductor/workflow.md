# Workflow

## Branches
- `main`: stable, demo-ready. Updated only by merging `development` at milestones.
- `development`: integration branch. Every commit builds (`npm run build`) and type-checks (`npm run typecheck`).

## Commits
Conventional Commits (`feat`, `fix`, `docs`, `chore`, `test`, `perf`, `refactor`) with a scope matching the
module (`context`, `edits`, `agent`, `tools`, `harness`, `webview`, `docs`). No AI attribution trailers.

## Code standards
- No comments in code; names carry intent. Small modules with one responsibility.
- Relative imports use explicit `.ts` extensions; pure modules (`context/`, `edits/editMatcher.ts`,
  `edits/hunks.ts`, `agent/resilience.ts`, `agent/toolCallView.ts`) never import `vscode`.
- Host owns state; the webview renders snapshots and sends intents.
- Every tool handler returns an error string instead of throwing (a crashing MCP server can stall TrueForge, issue #878).

## Verification per change
1. `npm run typecheck` and `npm run build`.
2. `npm test` (unit tests for pure logic).
3. For agent-flow changes: `npm run e2e` (VS Code + TrueForge + local model on a Flask clone).
4. Update `conductor/tracks.md` and the track plan checkboxes; record decisions in `conductor/decisions.md`.

## Definition of done (hackathon)
Tasks A, B, C pass on camera with on-screen verification; README setup works from a clean clone;
write-up headings match the brief; video ≤ 4 minutes.
