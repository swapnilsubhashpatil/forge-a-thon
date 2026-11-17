import type { ReasoningStep } from "../../../src/shared/protocol.ts";
import { Icon } from "./primitives.tsx";

export function Reasoning({ step, active }: { step: ReasoningStep; active: boolean }) {
  return (
    <details className="group text-sm text-muted">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded py-0.5 hover:text-fg [&::-webkit-details-marker]:hidden">
        <Icon name="chevron-right" className="transition-transform group-open:rotate-90" />
        <span>{active ? "Thinking…" : "Thinking"}</span>
      </summary>
      <div className="mt-1 ml-[7px] border-l border-border pl-3 whitespace-pre-wrap">{step.text}</div>
    </details>
  );
}
