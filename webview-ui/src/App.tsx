import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChangesBar } from "./components/ChangesBar.tsx";
import { Composer } from "./components/Composer.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { Header } from "./components/Header.tsx";
import { ModelChain } from "./components/ModelChain.tsx";
import { TurnView } from "./components/TurnView.tsx";
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

export function App() {
  const chat = useStore((snapshot) => snapshot.chat);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [chainOpen, setChainOpen] = useState(false);
  const scroller = useStickToBottom(chat.turns);

  useEffect(() => post({ type: "ready" }), []);

  const incoming = useStore((snapshot) => snapshot.incoming);
  useEffect(() => {
    const attachments = takeIncoming();
    if (!attachments.length) return;
    setDraft((current) => {
      const next = { ...current, attachments: [...(current.attachments ?? []), ...attachments] };
      saveDraft(next);
      return next;
    });
  }, [incoming]);

  function changeDraft(next: Draft) {
    setDraft(next);
    saveDraft(next);
  }

  return (
    <div className="flex h-full flex-col">
      <Header chat={chat} chainOpen={chainOpen} onToggleChain={() => setChainOpen(!chainOpen)} />
      {chainOpen && <ModelChain models={chat.models} activeModel={chat.activeModel} />}
      <main ref={scroller.ref} onScroll={scroller.onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {chat.turns.length === 0 ? (
          <EmptyState onPick={(text) => changeDraft({ text, mentions: [] })} />
        ) : (
          chat.turns.map((turn, index) => (
            <TurnView key={turn.id} turn={turn} latest={index === chat.turns.length - 1} />
          ))
        )}
      </main>
      <ChangesBar changeSets={chat.changeSets} />
      <Composer chat={chat} draft={draft} onDraftChange={changeDraft} />
    </div>
  );
}
