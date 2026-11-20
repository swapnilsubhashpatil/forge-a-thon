import { useEffect, useState } from "react";
import type { CatalogProvider, ProviderSummary } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { post } from "../state/vscode.ts";
import { isHttpUrl } from "./McpSettings.tsx";
import { useListbox } from "./ModelPicker.tsx";
import { Field, Icon, IconButton, inputClass, ListToolbar } from "./primitives.tsx";

const CUSTOM = "custom";

function AddModelIds({ onAdd }: { onAdd: (ids: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const ids = draft.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length) onAdd(ids);
    setDraft("");
  };
  return (
    <div className="flex items-center gap-1">
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && add()}
        placeholder="Model ids, comma separated"
        aria-label="Model ids to add"
        className={cx(inputClass, "font-mono")}
      />
      <button type="button" disabled={!draft.trim()} onClick={add} className="btn btn-secondary">
        Add
      </button>
    </div>
  );
}

function AddCatalogModels({ models, onAdd }: { models: CatalogProvider["models"]; onAdd: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const query = filter.trim().toLowerCase();
  const shown = models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(query));
  const close = () => {
    setOpen(false);
    setFilter("");
    setSelected([]);
  };
  return (
    <div
      className="relative"
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && close()}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <button
        type="button"
        disabled={models.length === 0}
        title={models.length === 0 ? "Every catalog model is already added" : undefined}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="btn w-full justify-start border border-dashed border-border text-muted hover:text-fg"
      >
        <Icon name="plus" />
        Add models
      </button>
      {open && (
        <div className="popover absolute top-full left-0 z-20 mt-1.5 flex w-full flex-col gap-1.5 p-1.5">
          <input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter models" aria-label="Filter models" className={inputClass} />
          <ModelChecklist models={shown} selected={selected} onChange={setSelected} />
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              onAdd(selected);
              close();
            }}
            className="btn btn-primary self-end"
          >
            Add {selected.length || ""}
          </button>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider, chain, catalog }: { provider: ProviderSummary; chain: string[]; catalog: CatalogProvider["models"] }) {
  const [confirming, setConfirming] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const count = provider.models.length;
  const setModels = (ids: string[]) => post({ type: "setProviderModels", name: provider.name, models: ids });
  return (
    <li className="rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 truncate font-mono text-xs font-medium text-fg">{provider.name}</span>
        <span className="shrink-0 rounded-sm bg-badge/30 px-1 text-[10px] text-muted">{provider.type}</span>
      </div>
      {provider.baseUrl && (
        <p className="mt-0.5 truncate font-mono text-xs text-muted" title={provider.baseUrl}>
          {provider.baseUrl}
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-1">
        <button type="button" disabled={count === 0} aria-expanded={showModels} onClick={() => setShowModels(!showModels)} className="btn -ml-2 text-muted hover:text-fg">
          <Icon name={showModels ? "chevron-down" : "chevron-right"} size={12} />
          {count} {count === 1 ? "model" : "models"}
        </button>
        <span className="flex-1" />
        {confirming ? (
          <>
            <button type="button" onClick={() => post({ type: "removeProvider", name: provider.name })} className="btn btn-secondary text-red">
              Remove
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn">
              Cancel
            </button>
          </>
        ) : (
          <IconButton icon="trash" label={`Remove ${provider.name}`} onClick={() => setConfirming(true)} />
        )}
      </div>
      {showModels && (
        <div className="mt-1 flex flex-col gap-1">
          {provider.type === CUSTOM ? (
            <AddModelIds onAdd={(ids) => setModels([...provider.modelIds, ...ids])} />
          ) : (
            <AddCatalogModels models={catalog.filter((model) => !provider.modelIds.includes(model.id))} onAdd={(ids) => setModels([...provider.modelIds, ...ids])} />
          )}
          <ul className="flex flex-col gap-0.5">
            {provider.models.map((model, index) => (
              <li key={model} className="flex h-6 items-center gap-1.5 rounded-md px-1 hover:bg-hover">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg" title={model}>
                  {shortModel(model)}
                </span>
                {chain.includes(model) ? (
                  <span className="text-xs text-muted">In chain</span>
                ) : (
                  <button type="button" onClick={() => post({ type: "updateSettings", patch: { chain: [...chain, model] } })} className="btn h-5 px-1.5 text-muted hover:text-fg">
                    <Icon name="plus" size={12} />
                    Add to chain
                  </button>
                )}
                <IconButton
                  icon="close"
                  label={`Remove ${shortModel(model)} from ${provider.name}`}
                  title={count === 1 ? "A provider needs at least one model. Remove the provider instead." : `Remove ${shortModel(model)}`}
                  disabled={count === 1}
                  onClick={() => setModels(provider.modelIds.filter((_, at) => at !== index))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function TypeSelect({ types, value, onChange }: { types: string[]; value: string; onChange: (type: string) => void }) {
  const label = (type: string) => (type === CUSTOM ? "Custom (OpenAI compatible)" : type);
  const list = useListbox(types.length, types.indexOf(value), (index) => onChange(types[index]));
  return (
    <div className="relative" onBlur={list.onBlur}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={list.open}
        aria-label="Provider type"
        aria-activedescendant={list.open ? `provider-type-${list.active}` : undefined}
        onClick={list.toggle}
        onKeyDown={list.onKeyDown}
        className={cx(inputClass, "flex items-center justify-between text-left")}
      >
        {label(value)}
        <Icon name="chevron-down" size={12} className="text-muted" />
      </button>
      {list.open && (
        <ul role="listbox" aria-label="Provider types" className="popover absolute top-full left-0 z-20 mt-1.5 max-h-60 w-full overflow-y-auto">
          {types.map((type, index) => (
            <li
              key={type}
              id={`provider-type-${index}`}
              role="option"
              aria-selected={type === value}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => list.setActive(index)}
              onClick={() => list.choose(index)}
              className={cx("flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-fg", index === list.active && "bg-hover")}
            >
              <span className="min-w-0 flex-1 truncate">{label(type)}</span>
              {type === value && <Icon name="check" size={12} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModelChecklist({ models, selected, onChange }: { models: CatalogProvider["models"]; selected: string[]; onChange: (ids: string[]) => void }) {
  const all = selected.length === models.length;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
  return (
    <div className="rounded-md border border-input-border">
      <label className="flex h-7 items-center gap-2 border-b border-border px-2 text-xs text-fg">
        <input type="checkbox" checked={all} onChange={() => onChange(all ? [] : models.map((model) => model.id))} className="accent-focus" />
        Select all
        <span className="flex-1 text-right text-muted">
          {selected.length} of {models.length}
        </span>
      </label>
      <ul className="max-h-48 overflow-y-auto py-0.5">
        {models.map((model) => (
          <li key={model.id}>
            <label className="flex h-6 items-center gap-2 px-2 text-xs hover:bg-hover">
              <input type="checkbox" checked={selected.includes(model.id)} onChange={() => toggle(model.id)} className="accent-focus" />
              <span className="min-w-0 truncate text-fg">{model.name}</span>
              <span className="min-w-0 flex-1 truncate text-right font-mono text-muted">{model.id}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddProviderForm({ catalog, taken, sent, onSend, onDone }: { catalog: CatalogProvider[]; taken: string[]; sent?: string; onSend: (name: string) => void; onDone: () => void }) {
  const catalogTypes = catalog.map((entry) => entry.type).filter((type) => type !== CUSTOM);
  const [type, setType] = useState(catalogTypes[0] ?? CUSTOM);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelIds, setModelIds] = useState("");
  const [selected, setSelected] = useState(() => catalog.find((entry) => entry.type === type)?.models.map((model) => model.id) ?? []);
  const [submitted, setSubmitted] = useState(false);
  const custom = type === CUSTOM;
  const models = catalog.find((entry) => entry.type === type)?.models ?? [];
  const finalName = custom ? name.trim() : type;
  const customModels = modelIds.split(",").map((id) => id.trim()).filter(Boolean);

  const errors = {
    name: !finalName ? "Required" : !/^[a-z0-9][a-z0-9-]*$/.test(finalName) ? "Lowercase letters, digits and dashes" : taken.includes(finalName) ? (custom ? "A provider with this name exists" : "Already added") : undefined,
    apiKey: !custom && !apiKey.trim() ? "Required" : undefined,
    baseUrl: custom && !isHttpUrl(baseUrl.trim()) ? "Enter an http:// or https:// URL" : undefined,
    models: (custom ? customModels.length : selected.length) === 0 ? "Pick at least one model" : undefined,
  };
  const shown = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  const chooseType = (next: string) => {
    setType(next);
    setSelected(catalog.find((entry) => entry.type === next)?.models.map((model) => model.id) ?? []);
  };

  const add = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    post({
      type: "addProvider",
      providerType: type,
      name: finalName,
      apiKey: apiKey.trim() || undefined,
      baseUrl: custom ? baseUrl.trim() : undefined,
      models: custom ? customModels : selected,
    });
    onSend(finalName);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
      className="flex flex-col gap-2.5 rounded-lg border border-border p-2.5"
    >
      <Field label="Type" error={custom ? undefined : shown("name")}>
        <TypeSelect types={[...catalogTypes, CUSTOM]} value={type} onChange={chooseType} />
      </Field>
      {custom && (
        <>
          <Field label="Name" error={shown("name")}>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="local-llm" aria-invalid={!!shown("name")} className={cx(inputClass, "font-mono")} />
          </Field>
          <Field label="Base URL" error={shown("baseUrl")}>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:11434/v1" aria-invalid={!!shown("baseUrl")} className={cx(inputClass, "font-mono")} />
          </Field>
        </>
      )}
      <Field label={custom ? "API key (optional)" : "API key"} error={shown("apiKey")}>
        <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} aria-invalid={!!shown("apiKey")} className={cx(inputClass, "font-mono")} />
      </Field>
      {custom ? (
        <Field label="Model ids, comma separated" error={shown("models")}>
          <input value={modelIds} onChange={(event) => setModelIds(event.target.value)} placeholder="qwen3-8b, llama3.2" aria-invalid={!!shown("models")} className={cx(inputClass, "font-mono")} />
        </Field>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Models</span>
          <ModelChecklist models={models} selected={selected} onChange={setSelected} />
          {shown("models") && <span className="text-xs text-red">{shown("models")}</span>}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 text-xs text-muted">{sent ? "Adding…" : "Saved in TrueForge, not in VS Code."}</span>
        <button type="button" onClick={onDone} className="btn">
          Cancel
        </button>
        <button type="submit" disabled={!!sent} className="btn btn-primary">
          Add
        </button>
      </div>
    </form>
  );
}

export function ProvidersSettings({ providers, catalog, chain, error }: { providers: ProviderSummary[]; catalog: CatalogProvider[]; chain: string[]; error?: string }) {
  const [adding, setAdding] = useState(false);
  const [sent, setSent] = useState<string>();
  const close = () => {
    setAdding(false);
    setSent(undefined);
  };
  useEffect(() => {
    if (sent && providers.some((provider) => provider.name === sent)) close();
    if (sent && error) setSent(undefined);
  }, [providers, error, sent]);

  return (
    <div className="flex flex-col gap-2">
      <ListToolbar summary="Providers live in TrueForge; keys are stored there, never in VS Code settings.">
        <IconButton icon="retry" label="Refresh providers" onClick={() => post({ type: "refreshProviders" })} />
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-secondary">
            <Icon name="plus" />
            Add provider
          </button>
        )}
      </ListToolbar>
      {error && <p className="text-xs break-words text-red">{error}</p>}
      {adding && <AddProviderForm catalog={catalog} taken={providers.map((provider) => provider.name)} sent={sent} onSend={setSent} onDone={close} />}
      {providers.length === 0 ? (
        <p className="text-xs text-muted">No providers yet. Add one with its API key, or point a custom provider at any OpenAI compatible server.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.name} provider={provider} chain={chain} catalog={catalog.find((entry) => entry.type === provider.type)?.models ?? []} />
          ))}
        </ul>
      )}
    </div>
  );
}
