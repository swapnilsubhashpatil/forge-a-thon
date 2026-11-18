import type { NoticeStep, NoticeTone } from "../../../src/shared/protocol.ts";
import { cx, shortModel } from "../format.ts";
import type { GlyphName } from "./Glyph.tsx";
import { Icon } from "./primitives.tsx";

const tones: Record<NoticeTone, { icon: GlyphName; border: string; text: string }> = {
  info: { icon: "info", border: "border-blue bg-blue/8", text: "text-blue" },
  success: { icon: "check-circle", border: "border-green bg-green/8", text: "text-green" },
  warning: { icon: "warning", border: "border-yellow bg-yellow/10", text: "text-yellow" },
  error: { icon: "error", border: "border-red bg-red/10", text: "text-red" },
};

function FailoverMarker({ failover }: { failover: NonNullable<NoticeStep["failover"]> }) {
  return (
    <div role="status" className="flex items-center gap-1.5 px-1 text-xs text-muted" title={`${failover.from} failed, switched to ${failover.to}`}>
      <Icon name="strike" className="text-orange" />
      <span className="font-mono text-fg line-through decoration-muted">{shortModel(failover.from)}</span>
      <Icon name="arrow-right" />
      <span className="font-mono text-fg">{shortModel(failover.to)}</span>
      <span className="min-w-0 truncate">{failover.reason}</span>
    </div>
  );
}

export function Notice({ step }: { step: NoticeStep }) {
  if (step.failover) return <FailoverMarker failover={step.failover} />;
  const tone = tones[step.tone];
  return (
    <div role={step.tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-2 rounded-r-lg border-l-2 px-3 py-2 text-sm text-fg", tone.border)}>
      <Icon name={tone.icon} className={cx("mt-0.5", tone.text)} />
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{step.text}</span>
    </div>
  );
}
