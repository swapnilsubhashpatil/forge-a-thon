import type { QueuedNote } from "../shared/protocol.ts";

export const NOTE_INSTRUCTION =
  "The user sent this while you were working. If it belongs to the current task, adapt now. " +
  "If it is a separate request, finish the current task first and say you will handle it next.";

export function formatNotes(notes: QueuedNote[]): string {
  const body = notes.map((note) => `<user_note sent_mid_task>\n${note.text}\n</user_note>`).join("\n");
  return `\n\n${body}\n${NOTE_INSTRUCTION}`;
}

export function deliverQueued(queue: QueuedNote[], step: number, turnId: string): QueuedNote[] {
  const pending = queue.filter((note) => note.status === "queued");
  for (const note of pending) {
    note.status = "delivered";
    note.deliveredAtStep = step;
    note.turnId = turnId;
  }
  return pending;
}

export function takeLeftovers(queue: QueuedNote[]): { text: string; mentions: string[] } | undefined {
  const leftovers = queue.filter((note) => note.status === "queued");
  if (!leftovers.length) return undefined;
  for (const note of leftovers) queue.splice(queue.indexOf(note), 1);
  return {
    text: leftovers.map((note) => note.text).join("\n\n"),
    mentions: [...new Set(leftovers.flatMap((note) => note.mentions))],
  };
}

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
