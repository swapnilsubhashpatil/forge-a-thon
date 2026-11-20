import { useState, type ReactNode } from "react";
import type { AnvilSettings, ChatState, ReviewMode } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { post } from "../state/vscode.ts";
import { useListbox } from "./ModelPicker.tsx";
import { Icon, IconButton } from "./primitives.tsx";
import { SkillsSettings } from "./SkillsSettings.tsx";

const efforts: AnvilSettings["reasoningEffort"][] = ["default", "none", "low", "medium", "high"];

const reviewModes: Array<{ value: ReviewMode; label: string; hint: string }> = [
  { value: "review", label: "Review each edit", hint: "Every edit waits in the editor until you accept or reject it." },
  { value: "applyThenReview", label: "Apply, review later", hint: "Edits land at once; keep or undo them from the edits tray." },
];

function save(patch: Partial<AnvilSettings>) {
  post({ type: "updateSettings", patch });
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-3 py-3">
      <h2 className={cx("text-sm font-semibold text-fg", !hint && "mb-2")}>{title}</h2>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {children}
    </section>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

function ModelChainEditor({ chain, available }: { chain: string[]; available: string[] }) {
  const addable = available.filter((model) => !chain.includes(model));
  return (
    <>
      {chain.length === 0 ? (
        <p className="text-xs text-muted">Using TrueForge's default chain.</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {chain.map((model, index) => (
            <li key={model} className="flex items-center gap-1.5 rounded-md px-1 hover:bg-hover">
              <span className="w-4 shrink-0 text-right font-mono text-xs text-muted">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg" title={model}>
                {shortModel(model)} <span className="text-muted">{model.split("/")[0]}</span>
              </span>
              <IconButton icon="up" label={`Move ${model} up`} disabled={index === 0} onClick={() => save({ chain: move(chain, index, index - 1) })} />
              <IconButton icon="down" label={`Move ${model} down`} disabled={index === chain.length - 1} onClick={() => save({ chain: move(chain, index, index + 1) })} />
              <IconButton icon="close" label={`Remove ${model}`} onClick={() => save({ chain: chain.filter((entry) => entry !== model) })} />
            </li>
          ))}
        </ol>
      )}
      {addable.length > 0 && (
        <AddModelMenu models={addable} onAdd={(model) => save({ chain: [...chain, model] })} />
      )}
    </>
  );
}

function AddModelMenu({ models, onAdd }: { models: string[]; onAdd: (model: string) => void }) {
  const list = useListbox(models.length, -1, (index) => onAdd(models[index]));
  return (
    <div className="relative mt-2" onBlur={list.onBlur}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={list.open}
        aria-activedescendant={list.open ? `add-model-${list.active}` : undefined}
        onClick={list.toggle}
        onKeyDown={list.onKeyDown}
        className="btn w-full justify-start border border-dashed border-border text-muted hover:text-fg"
      >
        <Icon name="plus" />
        Add a model
      </button>
      {list.open && (
        <ul role="listbox" aria-label="Models to add" className="popover absolute top-full left-0 z-20 mt-1.5 max-h-60 w-full overflow-y-auto">
          {models.map((model, index) => (
            <li
              key={model}
              id={`add-model-${index}`}
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => list.setActive(index)}
              onClick={() => list.choose(index)}
              className={cx("flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-xs", index === list.active && "bg-hover")}
            >
              <span className="min-w-0 truncate font-medium text-fg">{shortModel(model)}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{model.split("/")[0]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrefixEditor({ prefixes }: { prefixes: string[] }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const prefix = draft.trim();
    if (prefix && !prefixes.includes(prefix)) save({ autoApprove: [...prefixes, prefix] });
    setDraft("");
  };
  return (
    <>
      <ul className="mb-2 flex flex-wrap gap-1">
        {prefixes.map((prefix) => (
          <li key={prefix} className="flex items-center gap-0.5 rounded-md border border-border bg-badge/30 pl-2 font-mono text-xs text-fg">
            {prefix}
            <button
              type="button"
              aria-label={`Remove ${prefix}`}
              onClick={() => save({ autoApprove: prefixes.filter((entry) => entry !== prefix) })}
              className="btn btn-icon"
            >
              <Icon name="close" size={12} />
            </button>
          </li>
        ))}
        {prefixes.length === 0 && <li className="text-xs text-muted">None. Every command asks first.</li>}
      </ul>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && add()}
        onBlur={add}
        placeholder="e.g. npm test"
        aria-label="Add a command prefix"
        className="h-7 w-full rounded-md border border-input-border bg-input px-2 font-mono text-xs text-input-fg outline-none placeholder:text-muted focus:border-focus"
      />
    </>
  );
}

function BudgetInput({ value }: { value: number }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const next = Number(draft);
    if (Number.isInteger(next) && next > 0 && next !== value) save({ budgetTokens: next });
    else setDraft(String(value));
  };
  return (
    <input
      type="number"
      min={1000}
      step={1000}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      onBlur={commit}
      aria-label="Context budget in tokens"
      className="h-7 w-32 rounded-md border border-input-border bg-input px-2 font-mono text-xs text-input-fg outline-none focus:border-focus"
    />
  );
}

export function SettingsView({ chat }: { chat: ChatState }) {
  const settings = chat.settings;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Section title="Model chain" hint="The first healthy model runs each message; the rest take over when it fails.">
        <ModelChainEditor chain={settings.chain} available={chat.availableModels ?? []} />
      </Section>
      <Section title="Reasoning effort">
        <div role="radiogroup" aria-label="Reasoning effort" className="flex rounded-lg border border-border bg-editor/40 p-0.5 text-xs">
          {efforts.map((effort) => (
            <button
              key={effort}
              type="button"
              role="radio"
              aria-checked={settings.reasoningEffort === effort}
              onClick={() => save({ reasoningEffort: effort })}
              className={cx("h-6 min-w-0 flex-1 rounded-md font-medium capitalize", settings.reasoningEffort === effort ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg")}
            >
              {effort}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Edits">
        <div role="radiogroup" aria-label="Review mode" className="flex flex-col gap-1">
          {reviewModes.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={settings.reviewMode === value}
              onClick={() => save({ reviewMode: value })}
              className={cx("rounded-lg border px-3 py-2 text-left", settings.reviewMode === value ? "border-focus bg-hover" : "border-border hover:bg-hover")}
            >
              <span className="block text-sm text-fg">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Commands that run without asking" hint="A command starting with one of these runs without an approval prompt.">
        <PrefixEditor prefixes={settings.autoApprove} />
      </Section>
      <Section title="Context budget" hint="Tokens of code Anvil packs before the agent starts.">
        <BudgetInput key={settings.budgetTokens} value={settings.budgetTokens} />
      </Section>
      <Section title="Skills" hint="Instructions the agent loads when a request matches, or when you type /name.">
        <SkillsSettings skills={chat.skills} />
      </Section>
      <Section title="MCP servers" hint="Tool servers TrueForge has connected.">
        {chat.mcpServers.length === 0 ? (
          <p className="text-xs text-muted">None.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {chat.mcpServers.map((server) => (
              <li key={server} className="flex items-center gap-1.5 font-mono text-xs text-fg">
                <Icon name="plug" className="text-muted" />
                {server}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
