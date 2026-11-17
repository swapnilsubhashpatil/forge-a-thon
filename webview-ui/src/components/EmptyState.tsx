import type { ReactNode } from "react";
import type { ChatState } from "../../../src/shared/protocol.ts";
import { shortModel } from "../format.ts";
import { showView } from "../state/store.ts";
import { post } from "../state/vscode.ts";
import { AnvilMark } from "./AnvilMark.tsx";
import { Icon } from "./primitives.tsx";

const mac = navigator.userAgent.includes("Mac");

function keys(combo: string): string {
  return mac ? combo.replace("Ctrl+Alt+", "⌘⌥") : combo;
}

const hints: Array<[string, string]> = [
  [keys("Ctrl+Alt+K"), "edit the selection inline"],
  [keys("Ctrl+Alt+L"), "add the selection to the chat"],
  [keys("Ctrl+Alt+Q"), "ask about the selection"],
  ["@", "mention a file or symbol"],
];

function Check({ ok, children, action }: { ok: boolean; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon name={ok ? "check-circle" : "warning"} className={ok ? "text-green" : "text-yellow"} />
      <span className="min-w-0 flex-1 truncate text-fg">{children}</span>
      {action}
    </li>
  );
}

function FixLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-link hover:underline">
      {label}
    </button>
  );
}

function prompts(name: string | undefined): string[] {
  const subject = name ?? "this project";
  return [`Explain how ${subject} is structured`, `Find where errors are handled in ${subject} and summarise the approach`];
}

export function EmptyState({ chat, onPick }: { chat: ChatState; onPick: (prompt: string) => void }) {
  const { harness, settings, workspace } = chat;
  const primary = settings.chain[0];

  return (
    <div className="flex min-h-full flex-col justify-center gap-5 px-5 py-8">
      <div className="flex items-center gap-3">
        <AnvilMark className="size-8 text-orange" />
        <div>
          <h1 className="text-lg font-semibold text-fg">Anvil</h1>
          <p className="text-sm text-muted">Describe a change. Anvil finds the code, edits across files, and shows every diff.</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 rounded border border-border bg-editor/40 px-3 py-2 text-sm" aria-label="Readiness">
        <Check ok={harness.state === "ready"} action={harness.state === "offline" && <FixLink label="Reconnect" onClick={() => post({ type: "reconnect" })} />}>
          TrueForge <span className="font-mono text-muted">{harness.state}</span>
        </Check>
        <Check ok={Boolean(primary)} action={<FixLink label="Configure" onClick={() => showView("settings")} />}>
          {primary ? (
            <>
              Models <span className="font-mono text-muted">{shortModel(primary)}</span>
              {settings.chain.length > 1 && <span className="text-muted"> + {settings.chain.length - 1} fallback</span>}
            </>
          ) : (
            "Using the default model chain"
          )}
        </Check>
        <Check ok={Boolean(workspace)}>
          {workspace ? (
            <>
              {workspace.name} <span className="font-mono text-muted">{workspace.files} files indexed</span>
            </>
          ) : (
            "No folder open"
          )}
        </Check>
      </ul>
      <ul className="flex flex-col gap-1.5">
        {prompts(workspace?.name).map((prompt) => (
          <li key={prompt}>
            <button type="button" onClick={() => onPick(prompt)} className="w-full rounded border border-border px-3 py-1.5 text-left text-sm text-fg hover:border-orange hover:bg-hover">
              {prompt}
            </button>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs text-muted">
        {hints.map(([key, label]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="rounded-sm border border-border px-1 font-mono text-fg">{key}</kbd>
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
        <dt className="flex items-center gap-1 text-fg">
          <Icon name="hammer" className="text-orange" />/<Icon name="lens" className="text-blue" />
        </dt>
        <dd>Agent edits, Ask only reads; switch below the input</dd>
      </dl>
    </div>
  );
}
