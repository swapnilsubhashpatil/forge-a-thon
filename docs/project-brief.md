# TrueFoundry Forge-a-thon — Project Brief

Techfest 2026-27, IIT Bombay. Full problem statement: [problem-statement.pdf](problem-statement.pdf).

## Key dates

| Event | Deadline |
|---|---|
| Registration closes | 15 Nov 2026 |
| **Round 1 submission** | **20 Nov 2026, 23:59 IST** |
| Round 1 results | 30 Nov 2026 |
| Round 2 (finals, IIT Bombay) | 16–18 Dec 2026 |

## Goal

Build a **VS Code extension coding agent** whose agent loop runs on **TrueForge**, TrueFoundry's open-source agent harness ([github.com/truefoundry/trueforge](https://github.com/truefoundry/trueforge), `npx @truefoundry/trueforge@latest`). We choose the model.

The challenge: find the right code in a repo bigger than the context window, make multi-file changes the user didn't spell out, show every change for review before it touches disk, and keep working when the model fails.

## Eligibility gate (pass/fail)

- The extension is a TrueForge client: it creates sessions and sends turns through the TrueForge HTTP API or TypeScript SDK, then renders the streamed events.
- Editor capabilities (read file, search workspace, propose write, run command) are exposed to the agent as **MCP tools**. The agent decides what to read and change.
- TrueForge runs in local mode. Nothing is deployed.
- The model is configured in TrueForge (catalog provider or OpenAI-compatible endpoint). The extension must **never call a model provider directly** and must not hard-code one provider.
- Forks (Cline, Continue, Roo Code, opencode) are allowed for the editor side only. The upstream agent loop must be replaced. Keep the upstream LICENSE and declare the fork point (URL and commit) in the README.
- No API keys in the repo. Ship an example config file.

## Mandatory capabilities

1. **Inline edit**: select code, press a keybinding, type an instruction, get a diff in the editor with accept/reject.
2. **Agent mode**: a panel where one request drives a tool loop (read, search, write, run) that edits 3+ files nobody named.
3. **Context assembly**: `@file` and `@symbol` mentions, plus automatic retrieval with a size budget.
4. **Diff review**: per-hunk accept/reject, no silent writes, and undo for applied changes.
5. **Streaming and cancellation**: live tokens, mid-flight cancel, a non-blocking editor, and no half-applied edits after a cancel.

Out of scope: tab completion, training or hosting models, hosted backends or databases, authentication, Marketplace publishing.

## Fixed demo tasks

Repository: [pallets/flask](https://github.com/pallets/flask) at tag `3.1.3` (commit `22d92470`).

| Task | Instruction | Verification |
|---|---|---|
| A. Inline edit | In `src/flask/helpers.py`, select `get_debug_flag`: *"Treat the values 'off' and 'n' as false as well, case-insensitively, and update the docstring to list every value that is treated as false."* | `FLASK_DEBUG=off python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"` prints `False` |
| B. Agent mode | No files named: *"Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as "***". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands."* | `pytest tests/test_cli.py -q` passes, the masked JSON prints, the diff touches 3+ files, and the TrueForge session is shown |
| C. Resilience | Configure an unreachable endpoint or invalid key, then repeat Task A | The editor stays responsive, a clear message appears (or a fallback model takes over), and `git status` is clean |

## Scoring (100)

| Criterion | Points | Full marks |
|---|---|---|
| A1 Inline edit | 10 | Diff with per-hunk accept/reject |
| A2 Agent mode | 10 | Discovers and edits 3+ files unprompted |
| A3 Streaming/cancel | 10 | Immediate cancel, consistent workspace |
| B1 Context assembly | 15 | Retrieval with size budget, strategy stated, visibly at work in Task B (shows files chosen and why) |
| B2 Diff safety | 10 | Per-hunk review and working undo on screen |
| B3 Resilience | 10 | Automatic fallback to a second model, workspace unchanged |
| B4 TrueForge depth | 10 | MCP tools, tool approval drives diff review, plus a context-engineering feature (subagents, deferred tool loading, Code Mode, compaction) or skills |
| C1 Video | 10 | All three tasks complete, legible, verified |
| C2 Write-up | 15 | Architecture, context strategy, model setup, trade-offs, accurate timestamped scorecard, honest limitations |

When a submission falls between two anchors, the lower score applies. Ties break on B, then A, then submission time. Judges score behaviour, not model quality.

## Submission (all public links)

1. **Demo video**: at most 4 minutes, tasks A, B, C in order, each verified on screen, TrueForge session shown during B. Model waiting time may be cut, but not the gap between instruction and diff.
2. **Write-up PDF** (1–3 pages) with these headings in order: Team · Starting point · Architecture on TrueForge · How context is selected · Model setup · Scorecard · Tools used · Known limitations.
3. **GitHub repo**: a README that works from a clean clone (including starting TrueForge and loading the agent definition), the fork point, an example model config, the upstream LICENSE, and no secrets.

## Round 2 and prizes

- The top 15 teams are shortlisted after a 10-minute call where they walk through the code and repeat Task A live with an organiser-chosen model.
- Finals run 16–18 Dec at IIT Bombay: build agents on TrueForge and raise a PR to TrueForge. Model credits are provided.
- Prizes: ₹1,00,000 / ₹75,000 / ₹50,000, plus PPIs for TrueFoundry internships.
- Optional social media contest (₹30k first prize): posts tagged `#TrueForge #Forgeathon #<TeamName>`.
- Teams have up to 5 members, all 18 or older, one team per person.

## Open questions

- TrueForge API/SDK surface, MCP tool registration, approval flow, and available context-engineering features.
- Fork base: Continue vs Cline vs from scratch.
- Primary and fallback models.
