import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AgentMode, Attachment, ChatState, MentionItem, QueuedNote } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { useStore } from "../state/store.ts";
import { post, type Draft } from "../state/vscode.ts";
import { LiveStrip } from "./LiveStrip.tsx";
import { AttachmentChip, IMAGE_TYPES, LiveSelectionChip, MAX_IMAGES, readImages } from "./AttachmentChip.tsx";
import type { GlyphName } from "./Glyph.tsx";
import { MentionMenu, mentionId } from "./MentionMenu.tsx";
import { useSkillMenu } from "./SkillMenu.tsx";
import { ModelPicker, useListbox } from "./ModelPicker.tsx";
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
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-raised py-1 pr-1 pl-2.5 text-xs">
      <Icon name={offline ? "offline" : "clock"} className={offline ? "text-red" : "text-muted"} />
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
          className="btn btn-secondary"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

function NoteChip({ note, busy }: { note: QueuedNote; busy: boolean }) {
  const delivered = note.status === "delivered";
  return (
    <li className="flex min-h-8 flex-wrap items-center gap-x-1.5 rounded-lg border border-border bg-raised py-1 pr-1 pl-2.5 text-xs">
      <Icon name={delivered ? "check-circle" : "clock"} className={delivered ? "text-green" : "text-muted"} />
      <span className="min-w-0 flex-1 break-words text-fg">{note.text}</span>
      <span className="shrink-0 text-muted max-[400px]:hidden">
        {delivered ? `delivered at step ${note.deliveredAtStep}` : busy ? "queued for next step" : "queued"}
      </span>
      {!delivered && (
        <>
          <button
            type="button"
            title="Stop the current run and send this now"
            onClick={() => post({ type: "stopAndSend", id: note.id })}
            className="btn btn-secondary"
          >
            {busy ? "Stop and send" : "Send"}
          </button>
          <button
            type="button"
            aria-label="Remove queued message"
            title="Remove"
            onClick={() => post({ type: "removeNote", id: note.id })}
            className="btn btn-icon"
          >
            <Icon name="close" />
          </button>
        </>
      )}
    </li>
  );
}

const modes: Array<{ value: AgentMode; label: string; icon: GlyphName; hint: string; tone: string }> = [
  { value: "agent", label: "Agent", icon: "hammer", hint: "Reads, edits and runs commands", tone: "text-orange" },
  { value: "ask", label: "Ask", icon: "lens", hint: "Reads the code and answers, no edits", tone: "text-blue" },
];

function modeId(index: number): string {
  return `mode-option-${index}`;
}

function ModeMenu({ mode }: { mode: AgentMode }) {
  const selected = modes.findIndex((entry) => entry.value === mode);
  const current = modes[selected];
  const list = useListbox(modes.length, selected, (index) => {
    if (modes[index].value !== mode) post({ type: "setMode", mode: modes[index].value });
  });

  return (
    <div className="shrink-0" onBlur={list.onBlur}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={list.open}
        aria-controls={list.open ? "mode-menu" : undefined}
        aria-activedescendant={list.open ? modeId(list.active) : undefined}
        aria-label={`Mode: ${current.label}`}
        title={`${current.label}: ${current.hint}`}
        onClick={list.toggle}
        onKeyDown={list.onKeyDown}
        className="btn gap-1.5 px-1.5"
      >
        <Icon name={current.icon} className={current.tone} />
        {current.label}
        <Icon name="chevron-up" size={12} className="text-muted" />
      </button>
      {list.open && (
        <ul id="mode-menu" role="listbox" aria-label="Mode" className="popover absolute bottom-full left-0 z-20 mb-1.5 w-64 max-w-full">
          {modes.map(({ value, label, icon, hint, tone }, index) => (
            <li
              key={value}
              id={modeId(index)}
              role="option"
              aria-selected={value === mode}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => list.setActive(index)}
              onClick={() => list.choose(index)}
              className={cx("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5", index === list.active && "bg-hover")}
            >
              <Icon name={icon} size={16} className={tone} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{label}</span>
                <span className="block truncate text-xs text-muted">{hint}</span>
              </span>
              {value === mode && <Icon name="check" className="text-fg" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ComposerProps {
  chat: ChatState;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  onAttach: (attachments: Attachment[]) => void;
}

export function Composer({ chat, draft, onDraftChange, onAttach }: ComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string>();
  const requestCounter = useRef(0);
  const [mention, setMention] = useState<MentionQuery>();
  const [requestId, setRequestId] = useState(-1);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useStore((snapshot) => snapshot.mentions);
  const focusRequests = useStore((snapshot) => snapshot.focusRequests);
  const skillMenu = useSkillMenu(chat.skills, draft.text, (name) => onDraftChange({ ...draft, text: `/${name} ` }));

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
    if (!text || !ready) return;
    post({ type: "send", text, mentions: usedMentions(draft), attachments: draft.attachments, mode: chat.mode, includeSelection: chat.editorSelection !== undefined });
    onDraftChange({ text: "", mentions: [], attachments: [] });
    setMention(undefined);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || skillMenu.onKeyDown(event)) return;
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

  async function addImages(files: File[]) {
    const room = MAX_IMAGES - (draft.attachments ?? []).filter((entry) => entry.kind === "image").length;
    const { images, error } = await readImages(files, room);
    setImageError(error);
    if (images.length) onAttach(images);
  }

  function removeAttachment(id: string) {
    onDraftChange({ ...draft, attachments: draft.attachments?.filter((entry) => entry.id !== id) });
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

  const canSend = ready && draft.text.trim() !== "";
  const runningTurn = [...chat.turns].reverse().find((turn) => turn.status === "running" || turn.status === "paused");
  const ask = chat.mode === "ask";

  return (
    <div className="shrink-0 px-3 pt-2 pb-3">
      {!ready && <OfflineHint chat={chat} />}
      {chat.busy && runningTurn && <LiveStrip turn={runningTurn} />}
      {chat.queue.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1" aria-label="Messages sent while Anvil works">
          {chat.queue.map((note) => (
            <NoteChip key={note.id} note={note} busy={chat.busy} />
          ))}
        </ul>
      )}
      <div
        onDragOver={(event) => event.dataTransfer.types.includes("Files") && event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void addImages([...event.dataTransfer.files]);
        }}
        className={cx(
          "relative rounded-xl border bg-input shadow-md transition-colors",
          ask ? "border-blue/30 focus-within:border-blue/70" : "border-orange/30 focus-within:border-orange/70",
        )}
      >
        {((draft.attachments?.length ?? 0) > 0 || chat.editorSelection) && (
          <ul className="flex flex-wrap gap-1 px-2 pt-2" aria-label="Attached to this message">
            {chat.editorSelection && <LiveSelectionChip selection={chat.editorSelection} />}
            {(draft.attachments ?? []).map((attachment) => (
              <AttachmentChip key={attachment.id} attachment={attachment} onRemove={() => removeAttachment(attachment.id)} />
            ))}
          </ul>
        )}
        {imageError && (
          <p role="alert" className="px-2.5 pt-1.5 text-xs text-red">
            {imageError}
          </p>
        )}
        {menuOpen && <MentionMenu items={items} activeIndex={activeIndex} onSelect={select} onHover={setActiveIndex} />}
        {skillMenu.menu}
        <textarea
          ref={inputRef}
          value={draft.text}
          rows={1}
          aria-label="Message Anvil"
          role="combobox"
          aria-expanded={menuOpen || skillMenu.open}
          aria-controls={menuOpen ? "mention-menu" : skillMenu.open ? "skill-menu" : undefined}
          aria-activedescendant={menuOpen && items.length > 0 ? mentionId(activeIndex) : skillMenu.activeId}
          aria-autocomplete="list"
          placeholder={
            chat.busy
              ? "Anvil is working. Steer it with a note, or Esc to stop"
              : ask
                ? "Ask about the code, @ for files, / for skills"
                : "Describe a change, @ for files, / for skills"
          }
          onChange={(event) => updateText(event.target.value, event.target.selectionStart)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const files = [...event.clipboardData.files];
            if (!files.some((file) => IMAGE_TYPES.includes(file.type))) return;
            event.preventDefault();
            void addImages(files);
          }}
          onBlur={() => setMention(undefined)}
          className="composer-input block w-full resize-none bg-transparent px-3 pt-2.5 text-base text-input-fg outline-none placeholder:text-muted"
        />
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(event) => {
            void addImages([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-1.5 px-1.5 pb-1.5">
          <ModeMenu mode={chat.mode} />
          <ModelPicker chat={chat} />
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Mention a file or symbol"
            title="Mention a file or symbol"
            onClick={insertAt}
            className="btn btn-icon"
          >
            <Icon name="at" />
          </button>
          <button
            type="button"
            aria-label="Attach an image"
            title="Attach an image (or paste or drop one)"
            onClick={() => fileRef.current?.click()}
            className="btn btn-icon"
          >
            <Icon name="image" />
          </button>
          {chat.busy && (
            <button
              type="button"
              aria-label="Steer"
              title="Send a note the agent reads at its next step"
              disabled={!canSend}
              onClick={send}
              className="btn btn-secondary"
            >
              <Icon name="steer" />
              <span className="max-[400px]:hidden">Steer</span>
            </button>
          )}
          {chat.busy ? (
            <button
              type="button"
              aria-label="Stop"
              title="Stop (Esc)"
              onClick={() => post({ type: "cancel" })}
              className="btn btn-secondary"
            >
              <Icon name="stop" />
              <span className="max-[400px]:hidden">Stop</span>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              title="Send (Enter)"
              disabled={!canSend}
              onClick={send}
              className="btn btn-icon btn-primary"
            >
              <Icon name="up" bold />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
