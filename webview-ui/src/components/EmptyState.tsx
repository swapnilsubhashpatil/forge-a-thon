import type { ReactNode } from "react";
import type { ChatState } from "../../../src/shared/protocol.ts";
import { shortModel } from "../format.ts";
import { showView } from "../state/store.ts";
import { post } from "../state/vscode.ts";
import { AnvilMark } from "./AnvilMark.tsx";
import { harnessStatus } from "./Header.tsx";
import { Icon, StatusGlyph, type StatusKind } from "./primitives.tsx";

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

function greeting(name: string | undefined): string {
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening";
  return name ? `Good ${part}, ${name}` : `Good ${part}`;
}

function Check({ status, children, action }: { status: StatusKind; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex min-h-6 items-center gap-2">
      <StatusGlyph kind={status} />
      <span className="min-w-0 flex-1 truncate text-fg">{children}</span>
      {action}
    </li>
  );
}

function FixLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn h-6 px-1.5 text-link">
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
    <div className="flex min-h-full flex-col justify-center gap-5 px-4 py-8">
      <div className="flex flex-col gap-3">
        <AnvilMark className="size-7 text-strong" accent="var(--color-orange)" />
        <div>
          <h1 className="text-lg font-semibold text-strong">{greeting(workspace?.user)}</h1>
          <p className="text-sm text-muted">Describe a change. Anvil finds the code, edits across files, and shows every diff.</p>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 rounded-lg border border-border bg-editor/40 py-1.5 pr-1.5 pl-3 text-sm" aria-label="Readiness">
        <Check status={harnessStatus[harness.state]} action={harness.state === "offline" && <FixLink label="Reconnect" onClick={() => post({ type: "reconnect" })} />}>
          TrueForge <span className="font-mono text-muted">{harness.state}</span>
        </Check>
        <Check status={primary ? "ready" : "unknown"} action={<FixLink label="Configure" onClick={() => showView("settings")} />}>
          {primary ? (
            <>
              Models <span className="font-mono text-muted">{shortModel(primary)}</span>
              {settings.chain.length > 1 && <span className="text-muted"> + {settings.chain.length - 1} fallback</span>}
            </>
          ) : (
            "Using the default model chain"
          )}
        </Check>
        <Check status={workspace ? "ready" : "unknown"}>
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
            <button type="button" onClick={() => onPick(prompt)} className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-fg hover:bg-hover">
              <span className="min-w-0 flex-1">{prompt}</span>
              <Icon name="arrow-right" className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        {hints.map(([key, label]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="kbd">{key}</kbd>
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
        <dt className="flex items-center gap-1.5 px-1">
          <Icon name="hammer" className="text-orange" />
          <Icon name="lens" className="text-blue" />
        </dt>
        <dd>Agent edits, Ask only reads; pick one in the mode menu</dd>
      </dl>
    </div>
  );
}
