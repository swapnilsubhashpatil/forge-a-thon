import { useState } from "react";
import type { ChatState } from "../../../src/shared/protocol.ts";
import { formatUsd, sessionTotals } from "../../../src/shared/sessionStats.ts";
import { cx, formatDuration, formatTokens, shortModel } from "../format.ts";

export function SessionStrip({ chat }: { chat: ChatState }) {
  const [open, setOpen] = useState(false);
  if (!chat.turns.length) return null;
  const totals = sessionTotals(chat.turns);
  const context = totals.context;
  const ratio = context && context.threshold > 0 ? context.inputTokens / context.threshold : 0;
  const cost = totals.costUsd === undefined ? undefined : `${formatUsd(totals.costUsd)}${totals.costPartial ? "+" : ""}`;

  return (
    <section className="shrink-0 border-b border-border text-xs" aria-label="Conversation usage">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="Usage for this conversation"
        className="flex w-full items-center gap-2 px-2 py-0.5 text-left text-muted hover:bg-hover"
      >
        <progress
          className={cx("budget-bar flex-1", ratio > 0.8 && "near-limit")}
          max={1}
          value={Math.min(ratio, 1)}
          aria-label="Context window used"
        />
        <span className="shrink-0 font-mono tabular-nums">{context ? `${Math.round(ratio * 100)}% context` : `${formatTokens(totals.input)} tokens`}</span>
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-border px-2 py-1.5">
          <dl className="mb-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {context && (
              <>
                <dt className="text-muted">Context window</dt>
                <dd className="font-mono tabular-nums">
                  {formatTokens(context.inputTokens)} of {formatTokens(context.threshold)} before older steps are summarised
                </dd>
              </>
            )}
            {totals.compactions > 0 && (
              <>
                <dt className="text-muted">Summarised</dt>
                <dd className="font-mono tabular-nums">{totals.compactions} times</dd>
              </>
            )}
            <dt className="text-muted">Tokens</dt>
            <dd className="font-mono tabular-nums">
              {formatTokens(totals.input)} sent · {formatTokens(totals.output)} received
            </dd>
            <dt className="text-muted">Reused from cache</dt>
            <dd className="font-mono tabular-nums">{totals.cacheHit === undefined ? "none" : `${Math.round(totals.cacheHit * 100)}%`}</dd>
            <dt className="text-muted">Cost</dt>
            <dd className="font-mono tabular-nums">{cost ?? "not reported"}</dd>
          </dl>
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-0.5 font-normal">message</th>
                <th className="font-normal">model</th>
                <th className="text-right font-normal">sent</th>
                <th className="text-right font-normal">received</th>
                <th className="text-right font-normal">cost</th>
                <th className="text-right font-normal">time</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-fg">
              {chat.turns.map((turn, index) => (
                <tr key={turn.id} className={cx(turn.reverted && "line-through opacity-50")}>
                  <td className="max-w-32 truncate py-0.5 pr-2 font-sans" title={turn.prompt}>
                    {index + 1}. {turn.followUp ? "follow-up" : turn.prompt}
                  </td>
                  <td className="pr-2 text-muted">{turn.model ? shortModel(turn.model) : "–"}</td>
                  <td className="text-right">{formatTokens(turn.usage.input + (turn.liveUsage?.input ?? 0))}</td>
                  <td className="text-right">{formatTokens(turn.usage.output + (turn.liveUsage?.output ?? 0))}</td>
                  <td className="text-right">{turn.usage.costUsd === undefined ? "–" : formatUsd(turn.usage.costUsd)}</td>
                  <td className="text-right">{turn.endedAt ? formatDuration(turn.endedAt - turn.startedAt) : "…"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
