import { useEffect, useState } from "react";
import type { ModelHealth } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Dot, Icon } from "./primitives.tsx";

const healthDot: Record<ModelHealth["state"], string> = {
  healthy: "bg-green",
  cooling: "bg-yellow",
  unknown: "bg-muted/50",
};

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function healthLabel(health: ModelHealth, now: number): string {
  if (health.state !== "cooling") return health.state;
  const seconds = Math.max(0, Math.ceil(((health.coolingUntil ?? now) - now) / 1000));
  return `cooling · ${seconds}s`;
}

export function healthOf(models: ModelHealth[], model: string | undefined): ModelHealth["state"] {
  return models.find((entry) => entry.model === model)?.state ?? "unknown";
}

export function ModelChain({ models, activeModel }: { models: ModelHealth[]; activeModel?: string }) {
  const now = useNow(models.some((model) => model.state === "cooling"));

  return (
    <section className="border-b border-border bg-editor/50 px-3 py-2" aria-label="Model fallback chain">
      <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
        <Icon name="arrow-swap" />
        <span className="flex-1">Fallback chain — the first healthy model runs each turn</span>
        <button type="button" className="text-link hover:underline" onClick={() => post({ type: "configureModels" })}>
          Configure…
        </button>
      </div>
      {models.length === 0 ? (
        <p className="py-1 text-sm text-muted">No models configured.</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {models.map((health, index) => {
            const active = health.model === activeModel;
            return (
              <li
                key={health.model}
                title={health.lastError}
                className={cx("flex items-center gap-2 rounded px-2 py-1 text-sm", active && "bg-hover")}
              >
                <span className="w-3 shrink-0 text-right text-xs text-muted tabular-nums">{index + 1}</span>
                <Dot className={healthDot[health.state]} />
                <span className={cx("min-w-0 flex-1 truncate font-mono text-xs", active ? "text-fg" : "text-muted")}>
                  {health.model}
                </span>
                {active && <span className="shrink-0 rounded bg-badge px-1.5 text-2xs text-badge-fg">active</span>}
                <span
                  className={cx("shrink-0 text-xs tabular-nums", health.state === "cooling" ? "text-yellow" : "text-muted")}
                >
                  {healthLabel(health, now)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
