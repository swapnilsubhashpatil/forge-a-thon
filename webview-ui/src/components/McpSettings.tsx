import { useState, type ReactNode } from "react";
import type { McpServerInfo } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, IconButton, inputClass, StatusGlyph, Switch, type StatusKind } from "./primitives.tsx";

const statusKind: Record<McpServerInfo["status"], StatusKind> = {
  ok: "ready",
  error: "offline",
  unknown: "unknown",
  testing: "pending",
};

function ServerCard({ server }: { server: McpServerInfo }) {
  const [confirming, setConfirming] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const tools = server.tools ?? [];
  const testing = server.status === "testing";

  return (
    <li className="rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <StatusGlyph kind={statusKind[server.status]} />
        <span className={cx("min-w-0 flex-1 truncate font-mono text-xs font-medium", server.enabled ? "text-fg" : "text-muted")}>{server.name}</span>
        <Switch
          on={server.enabled}
          label={`${server.enabled ? "Turn off" : "Turn on"} ${server.name}`}
          title={server.enabled ? "On: the agent can use its tools" : "Off: hidden from the agent"}
          onChange={(enabled) => post({ type: "toggleMcpServer", name: server.name, enabled })}
        />
      </div>
      <p className="mt-0.5 truncate font-mono text-xs text-muted" title={server.url}>
        {server.url}
      </p>
      {server.description && <p className="mt-0.5 text-xs text-muted">{server.description}</p>}
      {server.status === "error" && server.error && <p className="mt-1 text-xs break-words text-red">{server.error}</p>}
      <div className="mt-1.5 flex items-center gap-1">
        {server.status === "ok" && tools.length > 0 ? (
          <button type="button" aria-expanded={showTools} onClick={() => setShowTools(!showTools)} className="btn -ml-2 text-muted hover:text-fg">
            <Icon name={showTools ? "chevron-down" : "chevron-right"} size={12} />
            {tools.length} {tools.length === 1 ? "tool" : "tools"}
          </button>
        ) : (
          <span className="text-xs text-muted">{testing ? "Testing…" : server.status === "ok" ? "No tools" : server.status === "error" ? "Not reachable" : "Not tested yet"}</span>
        )}
        <span className="flex-1" />
        {confirming ? (
          <>
            <button type="button" onClick={() => post({ type: "removeMcpServer", name: server.name })} className="btn btn-secondary text-red">
              Remove
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={testing} onClick={() => post({ type: "testMcpServer", name: server.name })} className="btn">
              <Icon name="flask" />
              Test
            </button>
            <IconButton icon="trash" label={`Remove ${server.name}`} onClick={() => setConfirming(true)} />
          </>
        )}
      </div>
      {showTools && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {tools.map((tool) => (
            <li key={tool} className="rounded-sm bg-badge/30 px-1.5 font-mono text-xs text-fg">
              {tool}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface Draft {
  name: string;
  url: string;
  description: string;
  headerName: string;
  headerValue: string;
}

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validate(draft: Draft, taken: string[]): Partial<Record<"name" | "url", string>> {
  const name = !draft.name
    ? "Required"
    : !/^[a-z0-9][a-z0-9-]*$/.test(draft.name)
      ? "Lowercase letters, digits and dashes"
      : taken.includes(draft.name)
        ? "A server with this name exists"
        : undefined;
  const url = !draft.url ? "Required" : !isHttpUrl(draft.url) ? "Enter an http:// or https:// URL" : undefined;
  return { name, url };
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
      {error && <span className="text-xs text-red">{error}</span>}
    </label>
  );
}

function AddServerForm({ taken, onDone }: { taken: string[]; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>({ name: "", url: "", description: "", headerName: "Authorization", headerValue: "" });
  const [submitted, setSubmitted] = useState(false);
  const errors = validate({ ...draft, name: draft.name.trim(), url: draft.url.trim() }, taken);
  const shown = (key: "name" | "url") => (submitted || draft[key] ? errors[key] : undefined);
  const set = (key: keyof Draft) => (event: { target: { value: string } }) => setDraft({ ...draft, [key]: event.target.value });

  const add = () => {
    setSubmitted(true);
    if (errors.name || errors.url) return;
    const auth = draft.headerValue.trim() && draft.headerName.trim();
    post({
      type: "addMcpServer",
      name: draft.name.trim(),
      url: draft.url.trim(),
      description: draft.description.trim() || undefined,
      headerName: auth ? draft.headerName.trim() : undefined,
      headerValue: auth ? draft.headerValue.trim() : undefined,
    });
    onDone();
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
      className="mt-2 flex flex-col gap-2.5 rounded-lg border border-border p-2.5"
    >
      <Field label="Name" error={shown("name")}>
        <input autoFocus value={draft.name} onChange={set("name")} placeholder="linear" aria-invalid={!!shown("name")} className={cx(inputClass, "font-mono")} />
      </Field>
      <Field label="URL" error={shown("url")}>
        <input value={draft.url} onChange={set("url")} placeholder="https://mcp.example.com/mcp" aria-invalid={!!shown("url")} className={cx(inputClass, "font-mono")} />
      </Field>
      <Field label="Description (optional)">
        <input value={draft.description} onChange={set("description")} placeholder="What the agent can do with it" className={inputClass} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Field label="Auth header (optional)">
          <input value={draft.headerName} onChange={set("headerName")} className={cx(inputClass, "font-mono")} />
        </Field>
        <Field label="Value">
          <input type="password" autoComplete="off" value={draft.headerValue} onChange={set("headerValue")} placeholder="Bearer …" className={cx(inputClass, "font-mono")} />
        </Field>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 text-xs text-muted">Anvil tests it right after adding.</span>
        <button type="button" onClick={onDone} className="btn">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </div>
    </form>
  );
}

export function McpSettings({ servers }: { servers: McpServerInfo[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      {servers.length === 0 ? (
        <p className="text-xs text-muted">No servers yet. Add one with its URL; it is tested as soon as it is saved.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {servers.map((server) => (
            <ServerCard key={server.name} server={server} />
          ))}
        </ul>
      )}
      {adding ? (
        <AddServerForm taken={servers.map((server) => server.name)} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn mt-2 w-full justify-start border border-dashed border-border text-muted hover:text-fg">
          <Icon name="plus" />
          Add server
        </button>
      )}
    </>
  );
}
