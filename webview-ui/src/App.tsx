import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Attachment, ChatState } from "../../src/shared/protocol.ts";
import { ChangesTray } from "./components/ChangesTray.tsx";
import { Composer } from "./components/Composer.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { Header } from "./components/Header.tsx";
import { HistoryView } from "./components/HistoryView.tsx";
import { SessionStrip } from "./components/SessionStrip.tsx";
import { SettingsView } from "./components/SettingsView.tsx";
import { TurnView } from "./components/TurnView.tsx";
import { cx } from "./format.ts";
import { takeIncoming, useStore } from "./state/store.ts";
import { loadDraft, post, saveDraft, type Draft } from "./state/vscode.ts";

function useStickToBottom(content: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [content]);

  function onScroll() {
    const element = ref.current;
    if (element) pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
  }

  return { ref, onScroll };
}

function ChatView({ chat, hidden }: { chat: ChatState; hidden: boolean }) {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const scroller = useStickToBottom(chat.turns);

  const restored = useStore((snapshot) => snapshot.restoredDraft);
  useEffect(() => {
    if (restored) changeDraft({ text: restored.text, mentions: restored.mentions, attachments: [] });
  }, [restored?.seq]);

  const incoming = useStore((snapshot) => snapshot.incoming);
  useEffect(() => attach(takeIncoming()), [incoming]);

  function changeDraft(next: Draft) {
    setDraft(next);
    saveDraft(next);
  }

  function attach(attachments: Attachment[]) {
    if (!attachments.length) return;
    setDraft((current) => {
      const next = { ...current, attachments: [...(current.attachments ?? []), ...attachments] };
      saveDraft(next);
      return next;
    });
  }

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col", hidden && "hidden")}>
      <SessionStrip chat={chat} />
      <main ref={scroller.ref} onScroll={scroller.onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {chat.turns.length === 0 ? (
          <EmptyState chat={chat} onPick={(text) => changeDraft({ text, mentions: [] })} />
        ) : (
          chat.turns.map((turn, index) => (
            <TurnView
              key={turn.id}
              turn={turn}
              latest={index === chat.turns.length - 1}
              busy={chat.busy}
              changeSet={chat.changeSets.find((set) => set.id === turn.changeSetId)}
            />
          ))
        )}
      </main>
      <ChangesTray changeSets={chat.changeSets} reviews={chat.pendingReviews} />
      <Composer chat={chat} draft={draft} onDraftChange={changeDraft} onAttach={attach} />
    </div>
  );
}

export function App() {
  const chat = useStore((snapshot) => snapshot.chat);
  const view = useStore((snapshot) => snapshot.view);

  useEffect(() => post({ type: "ready" }), []);

  return (
    <div className="flex h-full flex-col">
      <Header chat={chat} view={view} />
      {view === "history" && <HistoryView chat={chat} />}
      {view === "settings" && <SettingsView chat={chat} />}
      <ChatView chat={chat} hidden={view !== "chat"} />
    </div>
  );
}
