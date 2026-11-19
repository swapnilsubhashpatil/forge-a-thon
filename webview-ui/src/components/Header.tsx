import type { ChatState, HarnessState } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { showView, type View } from "../state/store.ts";
import { AnvilMark } from "./AnvilMark.tsx";
import { Dot, Icon } from "./primitives.tsx";
import type { GlyphName } from "./Glyph.tsx";

const harnessDot: Record<HarnessState, { className: string; label: string }> = {
  connecting: { className: "bg-yellow", label: "connecting" },
  starting: { className: "bg-yellow", label: "starting" },
  ready: { className: "bg-green", label: "ready" },
  offline: { className: "bg-red", label: "offline" },
};

function ViewButton({ view, current, icon, label }: { view: View; current: View; icon: GlyphName; label: string }) {
  const active = view === current;
  return (
    <button
      type="button"
      aria-pressed={active}
      title={active ? "Back to chat" : label}
      onClick={() => showView(active ? "chat" : view)}
      className={cx("flex h-6 items-center gap-1 rounded px-1.5 text-xs hover:bg-hover", active ? "bg-hover text-fg" : "text-muted")}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}

export function Header({ chat, view }: { chat: ChatState; view: View }) {
  const harness = harnessDot[chat.harness.state];
  const harnessTitle = [`TrueForge ${harness.label}`, chat.harness.url, chat.harness.message].filter(Boolean).join(" · ");

  return (
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
      <button type="button" onClick={() => showView("chat")} className="flex items-center gap-1.5 rounded px-1" title="Chat">
        <AnvilMark className="size-4 text-orange" />
        <span className="text-sm font-semibold text-fg">Anvil</span>
      </button>
      <span role="status" title={harnessTitle} className="flex items-center gap-1.5 font-mono text-xs text-muted">
        <Dot className={harness.className} />
        {harness.label}
      </span>
      <span className="flex-1" />
      <ViewButton view="history" current={view} icon="history" label="History" />
      <ViewButton view="settings" current={view} icon="settings" label="Settings" />
    </header>
  );
}
