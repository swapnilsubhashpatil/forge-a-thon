# 04 M11 Messages sent while the agent works
Spec: [M11](../spec.md#m11-messages-sent-while-the-agent-works-ux-a3) · Criteria: A3 (UX) · Refs: research/claude-code-public.md, research/kilo-void-amp.md

## Do
- Composer (`webview-ui/src/components/Composer.tsx:160`): stay enabled while busy; send → `queueNote`; chips with edit / remove / "Stop and send".
- `NoteQueue` in the extension. The tool server wraps every main-thread tool result: when notes are pending, append `<user_note sent_mid_task>…</user_note>` + "If this belongs to the current task, adapt now. If it is a separate request, finish the current task first and say you will handle it next." Mark delivered with the step index.
- Main-thread only: never deliver into subagent tool calls (thread id known from rendered tool calls).
- Turn end: undelivered notes become the next turn (combined, in order).
- "Stop and send": cancel, mark the turn `superseded` (no error styling), then send.

## Acceptance
- Fake scenario: note sent during a 5-call turn appears in the next tool result; a note after the last call becomes the next turn.
- Claude Code changelog edge cases: note during wrap-up not lost; note while a subagent runs reaches the main thread only; "send later" never lands mid-turn.
- Real: Task B + mid-turn "also mask keys containing CREDENTIAL" → final diff and test cover it.
