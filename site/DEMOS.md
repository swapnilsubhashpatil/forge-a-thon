# Demo plan

Every feature worth showing gets a short motion demo, built in code from a recreation of VS Code and the Anvil panel.
One timeline drives both the website player and, later, the exported videos.

## How the demos are built

| Piece | File |
|---|---|
| Timeline, camera keys, cursor path, captions | `src/demo/script.ts` |
| Recreated VS Code window and Anvil panel, drawn from `t` only | `src/demo/Scene.tsx` |
| Code shown in the editor | `src/demo/code.tsx` |
| Player: clock, camera, cursor, captions, chapter tabs, mobile framing | `src/demo/Player.tsx` |
| Easing, camera and cursor maths | `src/demo/anim.ts` |

Rules (from the demo-video skill's direction playbook):

- Every frame is a pure function of `t`. No CSS animation, timers or randomness in the scene.
- The camera eases into a shot (about 1.2 to 1.9 s) and holds still. Pull back between scenes.
- One idea on screen at a time; the rest greys out while the camera is in.
- The cursor arrives just before a click, then moves away from what opens.
- Captions: a 2 to 5 word title and one plain sentence under 110 characters. No feature names a visitor has not met.
- The loop's last frame equals its first.
- Check stills before shipping: open any page with `?t=<seconds>` to freeze the film at that moment.

## Chapters

| # | Chapter | Shows | Caption | Where | Status |
|---|---|---|---|---|---|
| 1 | Edit in place | Select `get_debug_flag`, toolbar, Edit, inline box, two hunks, Accept all | Edit right where you are. | Hero, docs: Inline edit | Built |
| 2 | Hand off a task | Prompt, context footer, read/search/edit/run rows, Verified, edits tray, Keep all | Hand off the whole task. | Hero, docs: What is Anvil, Agent mode | Built |
| 3 | Survive outages | Ask mode question, primary fails, strike marker, fallback answers | Never stuck on one model. | Hero, docs: Models and failover | Built |
| 4 | Undo anything | Hover a message, Revert, choose Conversation and code, confirm, files restored | Rewind anything. | Docs: Review and undo | Planned |
| 5 | Context you can see | Click the context footer, groups open, reasons per file, budget meter | See what it read. | Docs: Context | Planned |
| 6 | Steer while it works | Type a note mid-run, Steer, note delivered at the next step | Change course mid-task. | Docs: Agent mode | Planned |
| 7 | Skills | Settings, New skill, then `/release-notes` in the input, Used skill row | Teach it your way. | Docs: Skills | Planned |
| 8 | MCP servers | Settings, MCP, Add server, Test shows tool count, agent uses a tool | Plug in more tools. | Docs: MCP servers | Planned |
| 9 | Providers | Settings, Models, Add provider, pick models, add to chain | Bring any model. | Docs: Models and failover | Planned |
| 10 | Keep both | Inline edit, Keep both on one hunk, Open diff side by side | Keep both versions. | Docs: Inline edit | Planned |

To add a chapter: append it to `chapters` and `at` in `script.ts`, add its camera and cursor keys, draw its states in
`Scene.tsx`, then embed it with `<Demo chapter="id" />` on its docs page.

## Video export

The same `script.ts` and `Scene.tsx` can be rendered to MP4 with the demo-video skill's Remotion template: replace the
browser clock with `useCurrentFrame() / fps` and keep everything else. Targets:

- 16:10 desktop loop for the README and social posts.
- 9:16 portrait cut with its own camera track (about 1.5 times the desktop zoom).
- The 4 minute submission video: chapters 1 to 3 as the spine, then live footage of Task B and the TrueForge session.
