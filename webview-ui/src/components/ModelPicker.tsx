import { useState, type FocusEvent, type KeyboardEvent } from "react";
import type { ChatState, ModelHealth } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { showView } from "../state/store.ts";
import { post } from "../state/vscode.ts";
import { Icon, StatusGlyph } from "./primitives.tsx";

const COOLDOWN_MS = 60_000;

export function HealthGlyph({ health }: { health?: ModelHealth }) {
  if (health?.state === "healthy") return <StatusGlyph kind="ready" />;
  if (health?.state !== "cooling") return <StatusGlyph kind="unknown" />;
  const remaining = health.coolingUntil ? (health.coolingUntil - Date.now()) / COOLDOWN_MS : 1;
  return <StatusGlyph kind="cooling" fraction={Math.min(Math.max(remaining, 0), 1)} />;
}

export function useListbox(count: number, selected: number, pick: (index: number) => void) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  function toggle() {
    setActive(Math.max(0, selected));
    setOpen(!open);
  }

  function choose(index: number) {
    setOpen(false);
    pick(index);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return toggle();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + count) % count);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(active);
    }
  }

  function onBlur(event: FocusEvent) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  return { open, active, setActive, toggle, choose, onKeyDown, onBlur };
}

function optionId(index: number): string {
  return `model-option-${index}`;
}

export function modelOptions(chat: ChatState) {
  const chain = chat.models.map((entry) => entry.model);
  return { chain, primary: chain[0], models: [...new Set([...chain, ...(chat.availableModels ?? [])])] };
}

export function ModelPicker({ chat }: { chat: ChatState }) {
  const { chain, primary, models } = modelOptions(chat);
  const list = useListbox(models.length, models.indexOf(primary ?? ""), (index) => {
    if (models[index] !== primary) post({ type: "setPrimaryModel", model: models[index] });
  });
  if (models.length === 0) return <span className="truncate text-xs text-muted">No model configured</span>;

  return (
    <div className="min-w-0" onBlur={list.onBlur}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={list.open}
        aria-controls={list.open ? "model-menu" : undefined}
        aria-activedescendant={list.open ? optionId(list.active) : undefined}
        title="Model for the next message"
        onClick={list.toggle}
        onKeyDown={list.onKeyDown}
        className="btn max-w-44 min-w-0 gap-1.5 px-1.5 text-muted hover:text-fg"
      >
        <HealthGlyph health={chat.models[0]} />
        <span className="truncate">{primary ? shortModel(primary) : "Pick a model"}</span>
        <Icon name="chevron-up" size={12} />
      </button>
      {list.open && (
        <div className="popover absolute bottom-full left-0 z-20 mb-1.5 w-72 max-w-full">
          <p className="px-2 pt-1 pb-1.5 text-xs text-muted">Applies to the next message</p>
          <ul id="model-menu" role="listbox" aria-label="Models" className="max-h-60 overflow-y-auto">
            {models.map((model, index) => {
              const position = chain.indexOf(model);
              return (
                <li
                  key={model}
                  id={optionId(index)}
                  role="option"
                  aria-selected={model === primary}
                  title={chat.models[position]?.lastError ?? model}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => list.setActive(index)}
                  onClick={() => list.choose(index)}
                  className={cx("flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-xs", index === list.active && "bg-hover")}
                >
                  <HealthGlyph health={chat.models[position]} />
                  <span className="min-w-0 truncate font-medium text-fg">{shortModel(model)}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{model.split("/")[0]}</span>
                  {position > 0 && <span className="shrink-0 text-muted">fallback {position}</span>}
                  {position === 0 && <Icon name="check" className="text-fg" />}
                </li>
              );
            })}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => {
                list.toggle();
                showView("settings");
              }}
              className="btn w-full justify-start text-muted hover:text-fg"
            >
              <Icon name="settings" />
              Edit the model chain
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
