import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AgentMode, Attachment, ChatState, MentionItem, QueuedNote } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { useStore } from "../state/store.ts";
import { post, type Draft } from "../state/vscode.ts";
import { LiveStrip } from "./LiveStrip.tsx";
import { AddContextMenu } from "./AddContextMenu.tsx";
import { AttachmentChip, IMAGE_TYPES, LiveSelectionChip, MAX_IMAGES, MentionChip, SkillChip, readImages } from "./AttachmentChip.tsx";
import type { GlyphName } from "./Glyph.tsx";
import { MentionMenu, mentionId, mentionValue, useMentionSearch } from "./MentionMenu.tsx";
import { useSkillMenu } from "./SkillMenu.tsx";
import { HealthGlyph, ModelPicker, modelOptions, useListbox } from "./ModelPicker.tsx";
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
    <li className="@container flex min-h-8 flex-wrap items-center gap-x-1.5 rounded-lg border border-border bg-raised py-1 pr-1 pl-2.5 text-xs">
      <Icon name={delivered ? "check-circle" : "clock"} className={delivered ? "text-green" : "text-muted"} />
      <span className="min-w-0 flex-1 break-words text-fg">{note.text}</span>
      <span className="shrink-0 text-muted @max-[360px]:hidden">
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

function overflowId(index: number): string {
  return `overflow-option-${index}`;
}

function OverflowMenu({ chat }: { chat: ChatState }) {
  const { chain, primary, models } = modelOptions(chat);
  const current = modes.find((entry) => entry.value === chat.mode) ?? modes[0];
  const list = useListbox(modes.length + models.length, modes.indexOf(current), (index) => {
    const model = models[index - modes.length];
    if (index < modes.length && modes[index].value !== chat.mode) post({ type: "setMode", mode: modes[index].value });
    if (model && model !== primary) post({ type: "setPrimaryModel", model });
  });
  const option = (index: number) => ({
    id: overflowId(index),
    role: "option",
    onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
    onMouseEnter: () => list.setActive(index),
    onClick: () => list.choose(index),
    className: cx("flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-xs", index === list.active && "bg-hover"),
  });

  return (
    <div className="shrink-0 @min-[340px]:hidden" onBlur={list.onBlur}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={list.open}
        aria-controls={list.open ? "overflow-menu" : undefined}
        aria-activedescendant={list.open ? overflowId(list.active) : undefined}
        aria-label={`Mode and model: ${current.label}${primary ? `, ${shortModel(primary)}` : ""}`}
        title={`${current.label}${primary ? ` · ${shortModel(primary)}` : ""}`}
        onClick={list.toggle}
        onKeyDown={list.onKeyDown}
        className="btn btn-icon"
      >
        <Icon name="more" />
      </button>
      {list.open && (
        <ul id="overflow-menu" role="listbox" aria-label="Mode and model" className="popover absolute bottom-full left-0 z-20 mb-1.5 max-h-80 w-64 max-w-full overflow-y-auto">
          <li role="presentation" className="px-2 pt-1 pb-0.5 text-xs text-muted">Mode</li>
          {modes.map(({ value, label, icon, tone }, index) => (
            <li key={value} aria-selected={value === chat.mode} {...option(index)}>
              <Icon name={icon} className={tone} />
              <span className="min-w-0 flex-1 text-sm text-fg">{label}</span>
              {value === chat.mode && <Icon name="check" className="text-fg" />}
            </li>
          ))}
          <li role="presentation" className="mt-1 border-t border-border px-2 pt-1.5 pb-0.5 text-xs text-muted">Model</li>
          {models.map((model, index) => (
            <li key={model} aria-selected={model === primary} title={model} {...option(modes.length + index)}>
              <HealthGlyph health={chat.models[chain.indexOf(model)]} />
              <span className="min-w-0 flex-1 truncate font-medium text-fg">{shortModel(model)}</span>
              {model === primary && <Icon name="check" className="text-fg" />}
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
  const [mention, setMention] = useState<MentionQuery>();
  const [activeIndex, setActiveIndex] = useState(0);
  const found = useMentionSearch(mention?.query);
  const focusRequests = useStore((snapshot) => snapshot.focusRequests);
  const skillMenu = useSkillMenu(chat.skills, draft.text, (name) => onDraftChange({ ...draft, text: "", skill: name }));

  const ready = chat.harness.state === "ready";
  const items = found ?? [];
  const menuOpen = found !== undefined;
  const mentions = [...new Set(draft.mentions)];
  const message = [draft.skill && `/${draft.skill}`, draft.text.trim()].filter(Boolean).join(" ");

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusRequests]);

  useEffect(() => setActiveIndex(0), [mention?.query]);

  function updateText(text: string, caret: number) {
    onDraftChange({ ...draft, text });
    setMention(findMentionQuery(text, caret));
  }

  function addMention(value: string, text = draft.text) {
    onDraftChange({ ...draft, text, mentions: draft.mentions.includes(value) ? draft.mentions : [...draft.mentions, value] });
    inputRef.current?.focus();
  }

  function select(item: MentionItem) {
    const input = inputRef.current;
    if (!input || !mention) return;
    addMention(mentionValue(item), draft.text.slice(0, mention.start) + draft.text.slice(input.selectionStart));
    setMention(undefined);
    requestAnimationFrame(() => input.setSelectionRange(mention.start, mention.start));
  }

  function send() {
    if (!message || !ready) return;
    post({ type: "send", text: message, mentions, attachments: draft.attachments, mode: chat.mode, includeSelection: chat.editorSelection !== undefined });
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

  const canSend = ready && message !== "";
  const hasContext = (draft.attachments?.length ?? 0) > 0 || draft.mentions.length > 0 || draft.skill || chat.editorSelection;
  const runningTurn = [...chat.turns].reverse().find((turn) => turn.status === "running" || turn.status === "paused");
  const ask = chat.mode === "ask";

  return (
    <div className="@container shrink-0 px-3 pt-2 pb-3">
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
        {hasContext && (
          <ul className="flex flex-wrap gap-1 px-2 pt-2" aria-label="Attached to this message">
            {draft.skill && <SkillChip name={draft.skill} onRemove={() => onDraftChange({ ...draft, skill: undefined })} />}
            {chat.editorSelection && <LiveSelectionChip selection={chat.editorSelection} />}
            {mentions.map((value) => (
              <MentionChip key={value} value={value} onRemove={() => onDraftChange({ ...draft, mentions: draft.mentions.filter((entry) => entry !== value) })} />
            ))}
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
        <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
          <AddContextMenu
            chat={chat}
            mentions={draft.mentions}
            onMention={(value) => addMention(value)}
            onSkill={(name) => {
              onDraftChange({ ...draft, skill: name });
              inputRef.current?.focus();
            }}
            onImage={() => fileRef.current?.click()}
          />
          <div className="hidden min-w-0 items-center gap-1.5 @min-[340px]:flex">
            <ModeMenu mode={chat.mode} />
            <ModelPicker chat={chat} />
          </div>
          <OverflowMenu chat={chat} />
          <span className="flex-1" />
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
              <span className="@max-[400px]:hidden">Steer</span>
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
              <span className="@max-[400px]:hidden">Stop</span>
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
