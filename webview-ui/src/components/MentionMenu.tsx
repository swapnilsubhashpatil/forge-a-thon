import type { MentionItem } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { Icon, PathText } from "./primitives.tsx";

interface MentionMenuProps {
  items: MentionItem[];
  activeIndex: number;
  onSelect: (item: MentionItem) => void;
  onHover: (index: number) => void;
}

export function mentionId(index: number): string {
  return `mention-option-${index}`;
}

export function MentionMenu({ items, activeIndex, onSelect, onHover }: MentionMenuProps) {
  return (
    <ul
      id="mention-menu"
      role="listbox"
      aria-label="Mentions"
      className="popover absolute right-0 bottom-full left-0 z-10 mb-1.5 max-h-60 overflow-y-auto"
    >
      {items.length === 0 ? (
        <li className="px-2 py-1 text-sm text-muted">No matches</li>
      ) : (
        items.map((item, index) => (
          <li
            key={`${item.kind}:${item.path}:${item.label}:${item.line ?? ""}`}
            id={mentionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(item)}
            className={cx(
              "flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-sm",
              index === activeIndex && "bg-hover",
            )}
          >
            <Icon name={item.kind === "file" ? "file" : "symbol"} className={item.kind === "file" ? "text-muted" : "text-purple"} />
            {item.kind === "file" ? (
              <PathText path={item.path} className="font-mono text-xs" />
            ) : (
              <>
                <span className="shrink-0 font-mono text-xs">{item.label}</span>
                <span className="min-w-0 truncate text-xs text-muted">
                  {item.detail ?? item.path}
                  {item.line !== undefined && `:${item.line}`}
                </span>
              </>
            )}
          </li>
        ))
      )}
    </ul>
  );
}
