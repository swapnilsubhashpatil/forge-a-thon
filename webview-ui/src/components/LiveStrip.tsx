import { useEffect, useState } from "react";
import type { Turn } from "../../../src/shared/protocol.ts";
import { runStats } from "../../../src/shared/sessionStats.ts";
import { formatDuration, shortModel } from "../format.ts";
import { Icon } from "./primitives.tsx";

export function LiveStrip({ turn }: { turn: Turn }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const stats = runStats(turn, now);
  const waiting = stats.current === "Waiting for your review";

  return (
    <div className="mb-1.5 overflow-hidden rounded border border-border bg-editor/60 text-xs" role="status" aria-live="polite">
      <div className="flex items-center gap-2 px-2 py-1">
        <Icon name={waiting ? "clock" : "hammer"} className={waiting ? "text-yellow" : "text-orange"} />
        <span className="min-w-0 flex-1 truncate text-fg" title={stats.current}>
          {stats.current}
        </span>
        <span className="shrink-0 font-mono tabular-nums text-muted" title="Elapsed">
          {formatDuration(stats.elapsedMs)}
        </span>
        <span className="shrink-0 font-mono tabular-nums text-muted" title="Tool calls so far">
          {stats.toolCalls} tools
        </span>
        {stats.tokensPerSecond !== undefined && (
          <span className="shrink-0 font-mono tabular-nums text-muted" title="Output tokens per second over completed model calls">
            {Math.round(stats.tokensPerSecond)} tok/s
          </span>
        )}
        {turn.model && (
          <span className="shrink-0 truncate font-mono text-muted" title={turn.model}>
            {shortModel(turn.model)}
          </span>
        )}
      </div>
      {!waiting && <div className="slide-bar" />}
    </div>
  );
}
