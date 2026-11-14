import { useSyncExternalStore } from "react";
import type { Attachment, ChatState, HostMessage, MentionItem } from "../../../src/shared/protocol.ts";

export interface Snapshot {
  chat: ChatState;
  mentions: { requestId: number; items: MentionItem[] };
  focusRequests: number;
  /** Attachments sent from the editor or terminal, not yet merged into the draft. */
  incoming: Attachment[];
  /** Text put back into the composer by "Restore". */
  restoredDraft?: { text: string; mentions: string[]; seq: number };
}

const initialChat: ChatState = {
  turns: [],
  harness: { state: "connecting", url: "" },
  models: [],
  busy: false,
  changeSets: [],
  queue: [],
};

let snapshot: Snapshot = {
  chat: initialChat,
  mentions: { requestId: 0, items: [] },
  focusRequests: 0,
  incoming: [],
};

const listeners = new Set<() => void>();

function update(next: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function handle(message: HostMessage): void {
  switch (message.type) {
    case "state":
      update({ chat: message.state });
      break;
    case "mentionResults":
      update({ mentions: { requestId: message.requestId, items: message.items } });
      break;
    case "focusInput":
      update({ focusRequests: snapshot.focusRequests + 1 });
      break;
    case "setDraft":
      update({ restoredDraft: { text: message.text, mentions: message.mentions, seq: (snapshot.restoredDraft?.seq ?? 0) + 1 }, focusRequests: snapshot.focusRequests + 1 });
      break;
    case "attach":
      update({ incoming: [...snapshot.incoming, message.attachment], focusRequests: snapshot.focusRequests + 1 });
      break;
  }
}

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  if (event.data && typeof event.data === "object" && "type" in event.data) handle(event.data);
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Hands pending attachments to the draft exactly once. */
export function takeIncoming(): Attachment[] {
  const taken = snapshot.incoming;
  if (taken.length) update({ incoming: [] });
  return taken;
}

export function useStore<T>(select: (snapshot: Snapshot) => T): T {
  return useSyncExternalStore(subscribe, () => select(snapshot));
}
