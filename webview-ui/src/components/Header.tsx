import type { ChatState, HarnessState } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import { post } from "../state/vscode.ts";
import { AnvilMark } from "./AnvilMark.tsx";
import { healthOf } from "./ModelChain.tsx";
import { Dot, Icon, IconButton } from "./primitives.tsx";

const harnessDot: Record<HarnessState, { className: string; label: string; pulse?: boolean }> = {
  connecting: { className: "bg-yellow", label: "Connecting to TrueForge", pulse: true },
  starting: { className: "bg-yellow", label: "Starting TrueForge", pulse: true },
  ready: { className: "bg-green", label: "TrueForge ready" },
  offline: { className: "bg-red", label: "TrueForge offline" },
};

interface HeaderProps {
  chat: ChatState;
  chainOpen: boolean;
  onToggleChain: () => void;
}

export function Header({ chat, chainOpen, onToggleChain }: HeaderProps) {
  const harness = harnessDot[chat.harness.state];
  const harnessTitle = [harness.label, chat.harness.url, chat.harness.message].filter(Boolean).join(" — ");
  const fellBack = Boolean(chat.activeModel && chat.models[0] && chat.models[0].model !== chat.activeModel);
  const activeHealth = healthOf(chat.models, chat.activeModel);

  return (
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
      <AnvilMark className="size-4 shrink-0 text-fg" />
      <span className="text-sm font-semibold text-fg">Anvil</span>
      <span role="status" aria-label={harnessTitle} title={harnessTitle} className="grid size-4 place-items-center">
        <Dot className={harness.className} pulse={harness.pulse} />
      </span>
      {chat.sessionId && (
        <span className="truncate font-mono text-2xs text-muted" title={`Session ${chat.sessionId}`}>
          {chat.sessionId.slice(-8)}
        </span>
      )}
      <span className="flex-1" />
      <button
        type="button"
        aria-expanded={chainOpen}
        aria-label="Model fallback chain"
        title={chat.activeModel ? `Active model: ${chat.activeModel}` : "Model fallback chain"}
        onClick={onToggleChain}
        className={cx(
          "flex h-6 min-w-0 items-center gap-1.5 rounded border px-1.5 text-xs hover:bg-hover",
          fellBack ? "border-yellow/60 bg-yellow/10 text-fg" : "border-border text-fg",
          chainOpen && "bg-hover",
        )}
      >
        {fellBack ? <Icon name="arrow-swap" className="text-yellow" /> : <Dot className={activeHealth === "healthy" ? "bg-green" : "bg-muted/50"} />}
        <span className="truncate">{chat.activeModel ? shortModel(chat.activeModel) : "No model"}</span>
        <Icon name={chainOpen ? "chevron-up" : "chevron-down"} className="text-muted" />
      </button>
      <IconButton icon="add" label="New session" onClick={() => post({ type: "newSession" })} />
      <IconButton
        icon="link-external"
        label="Open session in TrueForge"
        disabled={!chat.sessionId}
        onClick={() => post({ type: "openSessionInHarness" })}
      />
      <IconButton icon="settings-gear" label="Configure models" onClick={() => post({ type: "configureModels" })} />
    </header>
  );
}
