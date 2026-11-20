import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import type { ChatState } from "../../../src/shared/protocol.ts";
import { cx, splitPath } from "../format.ts";
import { post } from "../state/vscode.ts";
import { mentionParts } from "./AttachmentChip.tsx";
import type { GlyphName } from "./Glyph.tsx";
import { mentionValue, useMentionSearch } from "./MentionMenu.tsx";
import { Icon } from "./primitives.tsx";

interface Option {
  key: string;
  icon: GlyphName;
  tone?: string;
  label: string;
  detail?: string;
  group?: string;
  disabled?: boolean;
  query?: string;
  run?: () => void;
}

interface AddContextMenuProps {
  chat: ChatState;
  mentions: string[];
  onMention: (value: string) => void;
  onSkill: (name: string) => void;
  onImage: () => void;
}

function optionId(index: number): string {
  return `add-option-${index}`;
}

function mentionOption(value: string, group: string): Option {
  const { label, detail, symbol } = mentionParts(value);
  return { key: `${group}:${value}`, group, icon: symbol ? "symbol" : "file", tone: symbol ? "text-purple" : undefined, label, detail };
}

export function AddContextMenu({ chat, mentions, onMention, onSkill, onImage }: AddContextMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const skillsOnly = query.startsWith("/");
  const term = query.replace(/^[@/]/, "").toLowerCase();
  const found = useMentionSearch(open && query && !skillsOnly ? term : undefined);

  const skills: Option[] = chat.skills
    .filter((skill) => skill.enabled && skill.name.includes(term))
    .map((skill) => ({ key: `skill:${skill.name}`, group: "Skills", icon: "book", tone: "text-purple", label: `/${skill.name}`, detail: skill.description, run: () => onSkill(skill.name) }));
  const files: Option[] = (found ?? []).map((item) => {
    const value = mentionValue(item);
    const line = item.line === undefined ? "" : `:${item.line}`;
    const option = mentionOption(value, "Files and symbols");
    return { ...option, detail: item.kind === "file" ? option.detail : `${splitPath(item.path).base}${line}`, run: () => onMention(value) };
  });
  const recent: Option[] = [...new Set(chat.turns.flatMap((turn) => turn.mentions).reverse())]
    .filter((value) => !mentions.includes(value))
    .slice(0, 3)
    .map((value) => ({ ...mentionOption(value, "Recent"), run: () => onMention(value) }));
  const start: Option[] = [
    { key: "files", icon: "file", label: "Files and symbols…", query: "@" },
    { key: "image", icon: "image", label: "Image…", run: onImage },
    { key: "selection", icon: "code", label: "Current selection", detail: chat.editorSelection?.label, disabled: !chat.editorSelection, run: () => post({ type: "pinSelection" }) },
    { key: "skills", icon: "book", label: "Skills…", query: "/" },
  ];
  const options = !query ? [...start, ...recent] : skillsOnly ? skills : query.startsWith("@") ? files : [...files, ...skills];
  const current = Math.min(active, Math.max(0, options.length - 1));

  function search(next: string) {
    setQuery(next);
    setActive(0);
  }

  function close() {
    setOpen(false);
    search("");
  }

  function pick(option: Option) {
    if (option.disabled) return;
    if (option.query !== undefined) return search(option.query);
    close();
    option.run?.();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      buttonRef.current?.focus();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + options.length) % options.length);
    } else if (event.key === "Enter" && options.length) {
      event.preventDefault();
      pick(options[current]);
    }
  }

  return (
    <div className="shrink-0" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && close()}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Add context"
        title="Add context: files, symbols, images, selection, skills"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="btn btn-icon"
      >
        <Icon name="plus" />
      </button>
      {open && (
        <div className="popover absolute bottom-full left-0 z-20 mb-1.5 w-80 max-w-full">
          <label className="flex h-7 items-center gap-2 border-b border-border px-2 pb-1">
            <Icon name="search" className="text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => search(event.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-label="Search files, symbols, skills"
              aria-expanded
              aria-controls="add-menu"
              aria-activedescendant={options.length ? optionId(current) : undefined}
              aria-autocomplete="list"
              placeholder="Search files, symbols, skills"
              className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
            />
          </label>
          <ul id="add-menu" role="listbox" aria-label="Add context" className="mt-1 max-h-64 overflow-y-auto">
            {options.length === 0 && (
              <li className="px-2 py-1 text-xs text-muted">{found === undefined && !skillsOnly ? "Searching…" : "No matches"}</li>
            )}
            {options.map((option, index) => (
              <Fragment key={option.key}>
                {option.group && option.group !== options[index - 1]?.group && (
                  <li role="presentation" className="px-2 pt-1.5 pb-0.5 text-xs text-muted">
                    {option.group}
                  </li>
                )}
                <li
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === current}
                  aria-disabled={option.disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(option)}
                  className={cx(
                    "flex h-7 items-center gap-2 rounded-md px-2 text-sm",
                    index === current && "bg-hover",
                    option.disabled ? "opacity-50" : "cursor-pointer",
                  )}
                >
                  <Icon name={option.icon} className={option.tone ?? "text-muted"} />
                  <span className={cx("max-w-[60%] shrink-0 truncate text-fg", option.group && "font-mono text-xs")}>{option.label}</span>
                  {option.detail && <span className="min-w-0 flex-1 truncate text-xs text-muted">{option.detail}</span>}
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
