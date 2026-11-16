import type { NoticeStep, NoticeTone } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { Icon } from "./primitives.tsx";

const tones: Record<NoticeTone, { icon: string; className: string }> = {
  info: { icon: "info", className: "border-blue bg-blue/8 [&_.codicon]:text-blue" },
  success: { icon: "pass", className: "border-green bg-green/8 [&_.codicon]:text-green" },
  warning: { icon: "arrow-swap", className: "border-yellow bg-yellow/10 [&_.codicon]:text-yellow" },
  error: { icon: "error", className: "border-red bg-red/10 [&_.codicon]:text-red" },
};

export function Notice({ step }: { step: NoticeStep }) {
  const tone = tones[step.tone];
  return (
    <div
      role={step.tone === "error" ? "alert" : "status"}
      className={cx("flex items-start gap-2 rounded border-l-2 px-3 py-2 text-sm text-fg", tone.className)}
    >
      <Icon name={tone.icon} className="mt-0.5" />
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{step.text}</span>
    </div>
  );
}
