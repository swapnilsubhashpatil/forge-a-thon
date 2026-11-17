import { useSyncExternalStore } from "react";
import type { Attachment, ChatState, HostMessage, MentionItem } from "../../../src/shared/protocol.ts";

export type View = "chat" | "history" | "settings";

export interface Snapshot {
  chat: ChatState;
  view: View;
  mentions: { requestId: number; items: MentionItem[] };
  focusRequests: number;
  incoming: Attachment[];
  restoredDraft?: { text: string; mentions: string[]; seq: number };
}

const initialChat: ChatState = {
  mode: "agent",
  history: [],
  pendingReviews: [],
  settings: { chain: [], reasoningEffort: "default", reviewMode: "review", autoApprove: [], budgetTokens: 0 },
  mcpServers: [],
  turns: [],
  harness: { state: "connecting", url: "" },
  models: [],
  busy: false,
  changeSets: [],
  queue: [],
};

let snapshot: Snapshot = {
  chat: initialChat,
  view: "chat",
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
      update({ view: "chat", focusRequests: snapshot.focusRequests + 1 });
      break;
    case "setDraft":
      update({
        view: "chat",
        restoredDraft: { text: message.text, mentions: message.mentions, seq: (snapshot.restoredDraft?.seq ?? 0) + 1 },
        focusRequests: snapshot.focusRequests + 1,
      });
      break;
    case "attach":
      update({ view: "chat", incoming: [...snapshot.incoming, message.attachment], focusRequests: snapshot.focusRequests + 1 });
      break;
    case "showView":
      update({ view: message.view });
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

export function showView(view: View): void {
  update({ view });
}

export function takeIncoming(): Attachment[] {
  const taken = snapshot.incoming;
  if (taken.length) update({ incoming: [] });
  return taken;
}

export function useStore<T>(select: (snapshot: Snapshot) => T): T {
  return useSyncExternalStore(subscribe, () => select(snapshot));
}
