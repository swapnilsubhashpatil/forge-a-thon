import type { ChatState, HarnessState } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { showView, type View } from "../state/store.ts";
import { AnvilMark } from "./AnvilMark.tsx";
import { Icon, StatusGlyph, type StatusKind } from "./primitives.tsx";
import type { GlyphName } from "./Glyph.tsx";

export const harnessStatus: Record<HarnessState, StatusKind> = {
  connecting: "pending",
  starting: "pending",
  ready: "ready",
  offline: "offline",
};

function ViewButton({ view, current, icon, label }: { view: View; current: View; icon: GlyphName; label: string }) {
  const active = view === current;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={active ? "Back to chat" : label}
      onClick={() => showView(active ? "chat" : view)}
      className={cx("btn px-1.5", active ? "bg-hover text-fg" : "text-muted")}
    >
      <Icon name={icon} />
      <span className="max-[340px]:hidden">{label}</span>
    </button>
  );
}

export function Header({ chat, view }: { chat: ChatState; view: View }) {
  const state = chat.harness.state;
  const harnessTitle = [`TrueForge ${state}`, chat.harness.url, chat.harness.message].filter(Boolean).join(" · ");

  return (
    <header className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-2">
      <button type="button" onClick={() => showView("chat")} className="btn gap-1.5 px-1 text-sm font-semibold" title="Chat">
        <AnvilMark className="size-4 text-strong" accent="var(--color-orange)" />
        Anvil
      </button>
      <span role="status" title={harnessTitle} className="flex items-center gap-1.5 text-xs text-muted">
        <StatusGlyph kind={harnessStatus[state]} />
        {state}
      </span>
      <span className="flex-1" />
      <ViewButton view="history" current={view} icon="history" label="History" />
      <ViewButton view="settings" current={view} icon="settings" label="Settings" />
    </header>
  );
}
