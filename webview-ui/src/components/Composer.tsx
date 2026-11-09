import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatState, MentionItem } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { useStore } from "../state/store.ts";
import { post, type Draft } from "../state/vscode.ts";
import { MentionMenu, mentionId } from "./MentionMenu.tsx";
import { Icon } from "./primitives.tsx";

interface MentionQuery {
  start: number;
  query: string;
}

function findMentionQuery(text: string, caret: number): MentionQuery | undefined {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  if (!match) return undefined;
  return { start: caret - match[2].length - 1, query: match[2] };
}

function mentionValue(item: MentionItem): string {
  return item.kind === "file" ? item.path : `${item.path}#${item.label}`;
}

function mentionToken(value: string): string {
  return value.slice(value.indexOf("#") + 1);
}

function usedMentions(draft: Draft): string[] {
  return [...new Set(draft.mentions)].filter((value) => draft.text.includes(`@${mentionToken(value)}`));
}

function OfflineHint({ chat }: { chat: ChatState }) {
  const offline = chat.harness.state === "offline";
  return (
    <div className="mb-2 flex items-center gap-2 rounded border border-border bg-editor/60 px-2 py-1.5 text-xs">
      <Icon name={offline ? "debug-disconnect" : "loading"} spin={!offline} className={offline ? "text-red" : "text-muted"} />
      <span className="min-w-0 flex-1 text-muted">
        {offline
          ? chat.harness.message ?? "TrueForge is not reachable. Sending is paused until it reconnects."
          : chat.harness.state === "starting"
            ? "Starting TrueForge…"
            : "Connecting to TrueForge…"}
      </span>
      {offline && (
        <button
          type="button"
          onClick={() => post({ type: "reconnect" })}
          className="shrink-0 rounded bg-secondary px-2 py-0.5 text-secondary-fg hover:bg-secondary-hover"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

interface ComposerProps {
  chat: ChatState;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
}

export function Composer({ chat, draft, onDraftChange }: ComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestCounter = useRef(0);
  const [mention, setMention] = useState<MentionQuery>();
  const [requestId, setRequestId] = useState(-1);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useStore((snapshot) => snapshot.mentions);
  const focusRequests = useStore((snapshot) => snapshot.focusRequests);

  const ready = chat.harness.state === "ready";
  const items = mention && results.requestId === requestId ? results.items : [];
  const menuOpen = mention !== undefined && results.requestId === requestId;

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusRequests]);

  useEffect(() => {
    if (mention === undefined) return;
    const timer = setTimeout(() => {
      const id = ++requestCounter.current;
      setRequestId(id);
      setActiveIndex(0);
      post({ type: "searchMentions", requestId: id, query: mention.query });
    }, 80);
    return () => clearTimeout(timer);
  }, [mention?.query, mention === undefined]);

  function updateText(text: string, caret: number) {
    onDraftChange({ ...draft, text });
    setMention(findMentionQuery(text, caret));
  }

  function select(item: MentionItem) {
    const input = inputRef.current;
    if (!input || !mention) return;
    const value = mentionValue(item);
    const inserted = `@${mentionToken(value)} `;
    const caret = input.selectionStart;
    const text = draft.text.slice(0, mention.start) + inserted + draft.text.slice(caret);
    onDraftChange({ text, mentions: [...draft.mentions, value] });
    setMention(undefined);
    const nextCaret = mention.start + inserted.length;
    requestAnimationFrame(() => input.setSelectionRange(nextCaret, nextCaret));
  }

  function send() {
    const text = draft.text.trim();
    if (!text || chat.busy || !ready) return;
    post({ type: "send", text, mentions: usedMentions(draft) });
    onDraftChange({ text: "", mentions: [] });
    setMention(undefined);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (menuOpen && items.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((index) => (index + step + items.length) % items.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        select(items[Math.min(activeIndex, items.length - 1)]);
        return;
      }
    }
    if (event.key === "Escape") {
      if (mention) {
        event.preventDefault();
        setMention(undefined);
      } else if (chat.busy) {
        event.preventDefault();
        post({ type: "cancel" });
      }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function insertAt() {
    const input = inputRef.current;
    if (!input) return;
    const caret = input.selectionStart;
    const before = draft.text.slice(0, caret);
    const prefix = before === "" || /\s$/.test(before) ? "@" : " @";
    const text = before + prefix + draft.text.slice(caret);
    updateText(text, caret + prefix.length);
    input.focus();
    requestAnimationFrame(() => input.setSelectionRange(caret + prefix.length, caret + prefix.length));
  }

  const canSend = ready && !chat.busy && draft.text.trim() !== "";

  return (
    <div className="shrink-0 border-t border-border px-3 pt-2 pb-2">
      {!ready && <OfflineHint chat={chat} />}
      <div className="relative rounded border border-input-border bg-input focus-within:border-focus">
        {menuOpen && <MentionMenu items={items} activeIndex={activeIndex} onSelect={select} onHover={setActiveIndex} />}
        <textarea
          ref={inputRef}
          value={draft.text}
          rows={1}
          aria-label="Message Anvil"
          role="combobox"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? "mention-menu" : undefined}
          aria-activedescendant={menuOpen && items.length > 0 ? mentionId(activeIndex) : undefined}
          aria-autocomplete="list"
          placeholder={chat.busy ? "Anvil is working — Esc to stop" : "Describe a change — @ to add files or symbols"}
          onChange={(event) => updateText(event.target.value, event.target.selectionStart)}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(undefined)}
          className="composer-input block w-full resize-none bg-transparent px-2.5 pt-2 text-base text-input-fg outline-none placeholder:text-muted"
        />
        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          <button
            type="button"
            aria-label="Mention a file or symbol"
            title="Mention a file or symbol"
            onClick={insertAt}
            className="grid size-6 place-items-center rounded text-muted hover:bg-hover hover:text-fg"
          >
            <Icon name="mention" />
          </button>
          <span className="flex-1" />
          {chat.busy ? (
            <button
              type="button"
              aria-label="Stop"
              title="Stop (Esc)"
              onClick={() => post({ type: "cancel" })}
              className="flex h-6 items-center gap-1 rounded bg-secondary px-2 text-xs text-secondary-fg hover:bg-secondary-hover"
            >
              <Icon name="debug-stop" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              title="Send (Enter)"
              disabled={!canSend}
              onClick={send}
              className={cx("grid size-6 place-items-center rounded bg-accent text-accent-fg", canSend && "hover:bg-accent-hover")}
            >
              <Icon name="arrow-up" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 px-0.5 text-2xs text-muted">
        <span className="min-w-0 truncate" title={chat.activeModel}>
          {chat.activeModel ? shortModel(chat.activeModel) : "No model selected"}
        </span>
        <span className="flex-1" />
        <span className="shrink-0">Enter to send · Shift+Enter for newline</span>
      </div>
    </div>
  );
}
