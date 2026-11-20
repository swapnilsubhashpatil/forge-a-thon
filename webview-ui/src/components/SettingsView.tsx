import { useState, type ReactNode } from "react";
import type { AnvilSettings, ChatState, ReviewMode } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { loadSettingsTab, post, saveSettingsTab } from "../state/vscode.ts";
import { harnessStatus } from "./Header.tsx";
import { isHttpUrl, McpSettings } from "./McpSettings.tsx";
import { useListbox } from "./ModelPicker.tsx";
import { Icon, IconButton, inputClass, Segmented, StatusGlyph, Switch } from "./primitives.tsx";
import { ProvidersSettings } from "./ProvidersSettings.tsx";
import { SkillsSettings } from "./SkillsSettings.tsx";

const efforts = (["default", "none", "low", "medium", "high"] as const).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

const profiles: Array<{ value: AnvilSettings["promptProfile"]; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "full", label: "Full" },
  { value: "compact", label: "Compact" },
];

const reviewModes: Array<{ value: ReviewMode; label: string; hint: string }> = [
  { value: "review", label: "Review each edit", hint: "Every edit waits in the editor until you accept or reject it." },
  { value: "applyThenReview", label: "Apply, review later", hint: "Edits land at once; keep or undo them from the edits tray." },
];

function save(patch: Partial<AnvilSettings>) {
  post({ type: "updateSettings", patch });
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={cx("text-sm font-semibold text-fg", !hint && "mb-2")}>{title}</h3>
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

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-xs text-fg">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function NumberInput({ value, min = 1, step = 1, label, onCommit }: { value: number; min?: number; step?: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const next = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(next) && next >= min;
  const commit = () => valid && next !== value && onCommit(next);
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <input
        type="number"
        min={min}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(String(value));
        }}
        onBlur={commit}
        aria-label={label}
        aria-invalid={!valid}
        className={cx(inputClass, "w-24 font-mono", !valid && "border-red")}
      />
      {!valid && <span className="text-xs text-red">Whole number, {min} or more</span>}
    </div>
  );
}

function UrlInput({ value }: { value: string }) {
  const [draft, setDraft] = useState(value);
  const valid = isHttpUrl(draft.trim());
  const commit = () => valid && draft.trim() !== value && save({ harnessUrl: draft.trim() });
  return (
    <div className="flex flex-col gap-1">
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(value);
        }}
        onBlur={commit}
        aria-label="TrueForge URL"
        aria-invalid={!valid}
        className={cx(inputClass, "font-mono", !valid && "border-red")}
      />
      {!valid && <span className="text-xs text-red">Enter an http:// or https:// URL</span>}
    </div>
  );
}

const tabs = [
  { id: "general", label: "General", description: "How Anvil reaches TrueForge and how it works with the editor." },
  { id: "models", label: "Models", description: "Which providers and models answer, in what order, and how hard they think." },
  { id: "agent", label: "Agent", description: "How edits land, which commands run unasked, and how far the agent goes on its own." },
  { id: "skills", label: "Skills", description: "Instructions the agent loads when a request matches, or when you type /name." },
  { id: "mcp", label: "MCP", description: "Remote MCP servers over HTTP. Enabled servers are available to the agent; edits and destructive tools still ask for approval." },
] as const;

type Tab = (typeof tabs)[number]["id"];

function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="@container sticky top-0 z-10 border-b border-border bg-bg px-3 py-2">
      <div role="tablist" aria-label="Settings sections" className="hidden rounded-lg border border-border bg-editor/40 p-0.5 text-xs @[20rem]:flex">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onChange(id)}
            className={cx("h-6 min-w-0 flex-1 rounded-md font-medium", tab === id ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg")}
          >
            {label}
          </button>
        ))}
      </div>
      <select value={tab} onChange={(event) => onChange(event.target.value as Tab)} aria-label="Settings section" className="h-7 w-full rounded-md border border-input-border bg-input px-1.5 text-xs text-input-fg outline-none focus:border-focus @[20rem]:hidden">
        {tabs.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </nav>
  );
}

const harnessLabel: Record<ChatState["harness"]["state"], string> = {
  connecting: "Connecting",
  starting: "Starting",
  ready: "Connected",
  offline: "Offline",
};

function GeneralPage({ chat }: { chat: ChatState }) {
  const { settings, harness } = chat;
  return (
    <>
      <Section title="Connection">
        <UrlInput key={settings.harnessUrl} value={settings.harnessUrl} />
        <div role="status" className="mt-2 flex items-center gap-1.5 text-xs">
          <StatusGlyph kind={harnessStatus[harness.state]} />
          <span className="text-fg">{harnessLabel[harness.state]}</span>
          <span className="min-w-0 flex-1 truncate text-muted" title={harness.message}>
            {harness.message}
          </span>
          <button type="button" onClick={() => post({ type: "reconnect" })} className="btn btn-secondary">
            <Icon name="retry" />
            Reconnect
          </button>
        </div>
        <Row label="Start TrueForge automatically" hint="Start a local server with npx when none is reachable.">
          <Switch on={settings.harnessAutoStart} label="Start TrueForge automatically" onChange={(on) => save({ harnessAutoStart: on })} />
        </Row>
      </Section>
      <Section title="Editor">
        <Row label="Selection toolbar" hint="Edit, Ask and Add to chat above selected code.">
          <Switch on={settings.selectionToolbar} label="Selection toolbar" onChange={(on) => save({ selectionToolbar: on })} />
        </Row>
        <Row label="Attach selection to chat automatically" hint="The current selection rides along with your next message.">
          <Switch on={settings.selectionAutoAttach} label="Attach selection to chat automatically" onChange={(on) => save({ selectionAutoAttach: on })} />
        </Row>
      </Section>
    </>
  );
}

function ModelsPage({ chat }: { chat: ChatState }) {
  const settings = chat.settings;
  return (
    <>
      <Section title="Providers">
        <ProvidersSettings providers={chat.providers} catalog={chat.catalog} chain={settings.chain} error={chat.providerError} />
      </Section>
      <Section title="Model chain" hint="The first healthy model runs each message; the rest take over when it fails.">
        <ModelChainEditor chain={settings.chain} available={chat.availableModels ?? []} />
      </Section>
      <Section title="Reasoning effort">
        <Segmented label="Reasoning effort" options={efforts} value={settings.reasoningEffort} onChange={(reasoningEffort) => save({ reasoningEffort })} />
      </Section>
    </>
  );
}

function AgentPage({ settings }: { settings: AnvilSettings }) {
  return (
    <>
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
      <Section title="Limits">
        <Row label="Steps per turn" hint="Tool calls the agent makes before it stops and checks in.">
          <NumberInput key={settings.iterationLimit} value={settings.iterationLimit} label="Steps per turn" onCommit={(iterationLimit) => save({ iterationLimit })} />
        </Row>
        <Row label="Command timeout" hint="Seconds before a running command is stopped.">
          <NumberInput key={settings.commandTimeoutSeconds} value={settings.commandTimeoutSeconds} label="Command timeout in seconds" onCommit={(commandTimeoutSeconds) => save({ commandTimeoutSeconds })} />
        </Row>
        <Row label="Failover after" hint="Seconds to wait for a model's first reply before the next one takes over.">
          <NumberInput key={settings.failoverSeconds} value={settings.failoverSeconds} label="Failover after seconds" onCommit={(failoverSeconds) => save({ failoverSeconds })} />
        </Row>
        <Row label="Context budget" hint="Tokens of code Anvil packs before the agent starts.">
          <NumberInput key={settings.budgetTokens} value={settings.budgetTokens} min={1000} step={1000} label="Context budget in tokens" onCommit={(budgetTokens) => save({ budgetTokens })} />
        </Row>
      </Section>
      <Section title="Instructions" hint="Compact suits small local models.">
        <Segmented label="Prompt profile" options={profiles} value={settings.promptProfile} onChange={(promptProfile) => save({ promptProfile })} />
      </Section>
    </>
  );
}

export function SettingsView({ chat }: { chat: ChatState }) {
  const [tab, setTab] = useState<Tab>(() => tabs.find(({ id }) => id === loadSettingsTab())?.id ?? tabs[0].id);
  const page = tabs.find(({ id }) => id === tab)!;
  const choose = (next: Tab) => {
    setTab(next);
    saveSettingsTab(next);
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <TabBar tab={tab} onChange={choose} />
      <div role="tabpanel" aria-label={page.label} className="flex flex-col gap-5 px-3 pt-3 pb-6">
        <header>
          <h2 className="text-base font-semibold text-fg">{page.label}</h2>
          <p className="text-xs text-muted">{page.description}</p>
        </header>
        {tab === "general" && <GeneralPage chat={chat} />}
        {tab === "models" && <ModelsPage chat={chat} />}
        {tab === "agent" && <AgentPage settings={chat.settings} />}
        {tab === "skills" && <SkillsSettings skills={chat.skills} />}
        {tab === "mcp" && <McpSettings servers={chat.mcpServers} />}
      </div>
    </div>
  );
}
