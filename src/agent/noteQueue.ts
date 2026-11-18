import type { QueuedNote } from "../shared/protocol.ts";

/**
 * Messages the user sends while a turn runs. TrueForge cancels a running turn on a new user message, so Anvil
 * holds them and appends them to the next main-thread tool result instead (Claude Code delivers queued messages
 * "as soon as those tool calls finish, within the same turn"). The model decides whether a note changes the
 * current task or is a separate request.
 */
export const NOTE_INSTRUCTION =
  "The user sent this while you were working. If it belongs to the current task, adapt now. " +
  "If it is a separate request, finish the current task first and say you will handle it next.";

export function formatNotes(notes: QueuedNote[]): string {
  const body = notes.map((note) => `<user_note sent_mid_task>\n${note.text}\n</user_note>`).join("\n");
  return `\n\n${body}\n${NOTE_INSTRUCTION}`;
}

/** Marks every queued note delivered at `step` and returns them (oldest first). */
export function deliverQueued(queue: QueuedNote[], step: number, turnId: string): QueuedNote[] {
  const pending = queue.filter((note) => note.status === "queued");
  for (const note of pending) {
    note.status = "delivered";
    note.deliveredAtStep = step;
    note.turnId = turnId;
  }
  return pending;
}

/** Removes undelivered notes and joins them into one follow-up prompt, preserving order. */
export function takeLeftovers(queue: QueuedNote[]): { text: string; mentions: string[] } | undefined {
  const leftovers = queue.filter((note) => note.status === "queued");
  if (!leftovers.length) return undefined;
  for (const note of leftovers) queue.splice(queue.indexOf(note), 1);
  return {
    text: leftovers.map((note) => note.text).join("\n\n"),
    mentions: [...new Set(leftovers.flatMap((note) => note.mentions))],
  };
}

/** Key for matching a tool call announced in the event stream with the MCP request that executes it. */
export function callSignature(name: string, args: Record<string, unknown>): string {
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sorted(v)]));
    }
    return value;
  };
  return `${name}:${JSON.stringify(sorted(args))}`;
}
