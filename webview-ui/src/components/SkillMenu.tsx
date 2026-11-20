import { useEffect, useState, type KeyboardEvent } from "react";
import type { SkillSummary } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { showView } from "../state/store.ts";
import { Icon } from "./primitives.tsx";

function skillId(index: number): string {
  return `skill-option-${index}`;
}

export function useSkillMenu(skills: SkillSummary[], text: string, onPick: (name: string) => void) {
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string>();
  const query = /^\/([\w-]*)$/.exec(text)?.[1]?.toLowerCase();
  const items = query === undefined
    ? []
    : skills
        .filter((skill) => skill.enabled && skill.name.includes(query))
        .sort((a, b) => Number(!a.name.startsWith(query)) - Number(!b.name.startsWith(query)));
  const open = query !== undefined && dismissed !== text;
  const current = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => setActive(0), [query]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!open) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(text);
      return true;
    }
    if (!items.length) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + items.length) % items.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      onPick(items[current].name);
      return true;
    }
    return false;
  }

  const menu = open && (
    <ul id="skill-menu" role="listbox" aria-label="Skills" className="popover absolute right-0 bottom-full left-0 z-10 mb-1.5 max-h-60 overflow-y-auto">
      {items.length === 0 ? (
        <li className="flex items-center gap-2 px-2 py-1 text-xs text-muted">
          <span className="min-w-0 flex-1">{skills.some((skill) => skill.enabled) ? "No skill matches." : "No skills yet."}</span>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => showView("settings")} className="btn btn-secondary">
            Manage skills
          </button>
        </li>
      ) : (
        items.map((skill, index) => (
          <li
            key={skill.name}
            id={skillId(index)}
            role="option"
            aria-selected={index === current}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => onPick(skill.name)}
            className={cx("flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-sm", index === current && "bg-hover")}
          >
            <Icon name="book" className="text-purple" />
            <span className="shrink-0 font-mono text-xs text-fg">/{skill.name}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{skill.description}</span>
            <span className="shrink-0 text-xs text-muted">{skill.source}</span>
          </li>
        ))
      )}
    </ul>
  );

  return { open, menu, onKeyDown, activeId: open && items.length ? skillId(current) : undefined };
}
