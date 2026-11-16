import { useSyncExternalStore } from "react";
import type { ChatState, HostMessage, MentionItem } from "../../../src/shared/protocol.ts";

export interface Snapshot {
  chat: ChatState;
  mentions: { requestId: number; items: MentionItem[] };
  focusRequests: number;
}

const initialChat: ChatState = {
  turns: [],
  harness: { state: "connecting", url: "" },
  models: [],
  busy: false,
  changeSets: [],
};

let snapshot: Snapshot = {
  chat: initialChat,
  mentions: { requestId: 0, items: [] },
  focusRequests: 0,
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
  }
}

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  if (event.data && typeof event.data === "object" && "type" in event.data) handle(event.data);
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore<T>(select: (snapshot: Snapshot) => T): T {
  return useSyncExternalStore(subscribe, () => select(snapshot));
}
