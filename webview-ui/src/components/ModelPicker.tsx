import { useState, type KeyboardEvent } from "react";
import type { ChatState, ModelHealthState } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { showView } from "../state/store.ts";
import { post } from "../state/vscode.ts";
import { Dot, Icon } from "./primitives.tsx";

const healthDot: Record<ModelHealthState, string> = {
  healthy: "bg-green",
  cooling: "bg-yellow",
  unknown: "bg-muted/50",
};

function optionId(index: number): string {
  return `model-option-${index}`;
}

export function ModelPicker({ chat }: { chat: ChatState }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chain = chat.models.map((entry) => entry.model);
  const models = [...new Set([...chain, ...(chat.availableModels ?? [])])];
  const primary = chain[0];
  if (models.length === 0) return <span className="truncate text-xs text-muted">No model configured</span>;

  function pick(model: string) {
    setOpen(false);
    if (model !== primary) post({ type: "setPrimaryModel", model });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + models.length) % models.length);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      pick(models[active]);
    }
  }

  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? "model-menu" : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        title="Model for the next message"
        onClick={() => {
          setActive(Math.max(0, models.indexOf(primary ?? "")));
          setOpen(!open);
        }}
        onKeyDown={onKeyDown}
        className="flex h-6 max-w-44 min-w-0 items-center gap-1.5 rounded px-1.5 text-xs text-fg hover:bg-hover"
      >
        <Dot className={healthDot[chat.models[0]?.state ?? "unknown"]} />
        <span className="truncate font-mono">{primary ? shortModel(primary) : "Pick a model"}</span>
        <Icon name="chevron-up" className="text-muted" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-72 max-w-[calc(100vw-24px)] rounded border border-border bg-widget p-1 shadow-lg">
          <p className="px-2 py-1 text-xs text-muted">Applies to the next message</p>
          <ul id="model-menu" role="listbox" aria-label="Models" className="max-h-60 overflow-y-auto">
            {models.map((model, index) => {
              const position = chain.indexOf(model);
              const health = chat.models[position]?.state ?? "unknown";
              return (
                <li
                  key={model}
                  id={optionId(index)}
                  role="option"
                  aria-selected={model === primary}
                  title={chat.models[position]?.lastError ?? model}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(model)}
                  className={cx("flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs", index === active && "bg-selection text-selection-fg")}
                >
                  <Dot className={healthDot[health]} />
                  <span className="min-w-0 truncate font-mono">{shortModel(model)}</span>
                  <span className="min-w-0 flex-1 truncate opacity-70">{model.split("/")[0]}</span>
                  {position === 0 && <Icon name="check" />}
                  {position > 0 && <span className="shrink-0 font-mono opacity-70">fallback #{position}</span>}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              showView("settings");
            }}
            className="mt-1 w-full rounded border-t border-border px-2 pt-1.5 pb-1 text-left text-xs text-link hover:underline"
          >
            Edit the model chain in Settings
          </button>
        </div>
      )}
    </div>
  );
}
