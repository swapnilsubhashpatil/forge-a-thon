import { useState } from "react";
import type { ChatState } from "../../../src/shared/protocol.ts";
import { formatUsd, sessionTotals } from "../../../src/shared/sessionStats.ts";
import { cx, formatDuration, formatTokens, shortModel } from "../format.ts";
import { Icon } from "./primitives.tsx";

/**
 * Always-visible transparency strip: how full the context window is before TrueForge compacts, prompt-cache reuse,
 * TrueForge's cost estimate and token totals for the conversation. Click for a per-turn breakdown.
 */
export function SessionStrip({ chat }: { chat: ChatState }) {
  const [open, setOpen] = useState(false);
  const totals = sessionTotals(chat.turns);
  if (!chat.turns.length) return null;
  const context = totals.context;
  const ratio = context && context.threshold > 0 ? context.inputTokens / context.threshold : 0;
  const tone = ratio > 0.8 ? "near-limit" : undefined;

  return (
    <section className="shrink-0 border-b border-border bg-editor/30 text-xs" aria-label="Session usage">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 text-left text-muted hover:bg-hover"
      >
        {context ? (
          <span className="flex min-w-36 flex-1 items-center gap-1.5" title="Input tokens of the latest model call vs the point where TrueForge compacts the conversation">
            <Icon name="dashboard" />
            <progress className={cx("budget-bar w-full max-w-40", tone)} max={context.threshold} value={Math.min(context.inputTokens, context.threshold)} />
            <span className="shrink-0 tabular-nums text-fg">
              {formatTokens(context.inputTokens)}/{formatTokens(context.threshold)}
            </span>
            <span className="shrink-0">ctx</span>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {totals.compactions > 0 && <span title="Times TrueForge summarised earlier steps to stay within the window">compacted ×{totals.compactions}</span>}
        <span className="tabular-nums" title="Share of input tokens served from the provider's prompt cache">
          cache {totals.cacheHit === undefined ? "n/a" : `${Math.round(totals.cacheHit * 100)}%`}
        </span>
        <span className="tabular-nums" title="Tokens sent to and received from the model in this conversation">
          {formatTokens(totals.input)}↑ {formatTokens(totals.output)}↓
        </span>
        <span
          className="tabular-nums text-fg"
          title={totals.costUsd === undefined ? "No cost reported (local or unpriced model)" : `TrueForge cost estimate${totals.costPartial ? "; some turns had no price, so this is a lower bound" : ""}`}
        >
          {totals.costUsd === undefined ? "cost n/a" : `≈${formatUsd(totals.costUsd)}${totals.costPartial ? "+" : ""}`}
        </span>
        <span className="tabular-nums">
          {totals.turns} {totals.turns === 1 ? "turn" : "turns"}
        </span>
        <Icon name={open ? "chevron-up" : "chevron-down"} />
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto border-t border-border px-2 py-1">
          <table className="w-full text-left text-2xs">
            <thead className="text-muted">
              <tr>
                <th className="py-0.5 font-normal">turn</th>
                <th className="font-normal">model</th>
                <th className="text-right font-normal">in</th>
                <th className="text-right font-normal">out</th>
                <th className="text-right font-normal">cache</th>
                <th className="text-right font-normal">cost</th>
                <th className="text-right font-normal">time</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-fg">
              {chat.turns.map((turn, i) => {
                const input = turn.usage.input + (turn.liveUsage?.input ?? 0);
                const cached = turn.usage.cached + (turn.liveUsage?.cached ?? 0);
                return (
                  <tr key={turn.id} className={cx(turn.reverted && "line-through opacity-50")}>
                    <td className="max-w-32 truncate py-0.5 pr-2" title={turn.prompt}>
                      {i + 1}. {turn.followUp ? "follow-up" : turn.prompt}
                    </td>
                    <td className="pr-2 text-muted">{turn.model ? shortModel(turn.model) : "–"}</td>
                    <td className="text-right">{formatTokens(input)}</td>
                    <td className="text-right">{formatTokens(turn.usage.output + (turn.liveUsage?.output ?? 0))}</td>
                    <td className="text-right">{input ? `${Math.round((cached / input) * 100)}%` : "–"}</td>
                    <td className="text-right">{turn.usage.costUsd === undefined ? "–" : formatUsd(turn.usage.costUsd)}</td>
                    <td className="text-right">{turn.endedAt ? formatDuration(turn.endedAt - turn.startedAt) : "…"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
