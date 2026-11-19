import { useState, type ReactNode } from "react";
import type { AnvilSettings, ChatState, ReviewMode } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, IconButton } from "./primitives.tsx";

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
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
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
            <li key={model} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-hover">
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
        <select
          aria-label="Add a model"
          value=""
          onChange={(event) => save({ chain: [...chain, event.target.value] })}
          className="mt-2 h-7 w-full rounded border border-input-border bg-input px-1 text-xs text-input-fg"
        >
          <option value="">Add a model…</option>
          {addable.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      )}
    </>
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
          <li key={prefix} className="flex items-center gap-1 rounded border border-border bg-badge/30 py-0.5 pr-0.5 pl-1.5 font-mono text-xs text-fg">
            {prefix}
            <button
              type="button"
              aria-label={`Remove ${prefix}`}
              onClick={() => save({ autoApprove: prefixes.filter((entry) => entry !== prefix) })}
              className="grid size-4 place-items-center rounded text-muted hover:bg-hover hover:text-fg"
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
        className="h-7 w-full rounded border border-input-border bg-input px-2 font-mono text-xs text-input-fg outline-none placeholder:text-muted focus:border-focus"
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
      className="h-7 w-32 rounded border border-input-border bg-input px-2 font-mono text-xs text-input-fg outline-none focus:border-focus"
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
        <div role="radiogroup" aria-label="Reasoning effort" className="flex rounded border border-border p-px text-xs">
          {efforts.map((effort) => (
            <button
              key={effort}
              type="button"
              role="radio"
              aria-checked={settings.reasoningEffort === effort}
              onClick={() => save({ reasoningEffort: effort })}
              className={cx("flex-1 rounded-sm py-1 capitalize", settings.reasoningEffort === effort ? "bg-selection text-selection-fg" : "text-muted hover:text-fg")}
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
              className={cx("rounded border px-2 py-1.5 text-left", settings.reviewMode === value ? "border-focus bg-hover" : "border-border hover:bg-hover")}
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
