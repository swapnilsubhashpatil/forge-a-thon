import type { SubagentStep } from "../../../src/shared/protocol.ts";
import { Icon } from "./primitives.tsx";

const statusIcon = {
  running: <Icon name="loading" spin className="text-muted" />,
  done: <Icon name="check" className="text-green" />,
  error: <Icon name="error" className="text-red" />,
};

export function SubagentRow({ step }: { step: SubagentStep }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-purple/5 px-2 py-1 text-sm">
      <Icon name="type-hierarchy-sub" className="text-purple" />
      <span className="text-muted">Subagent</span>
      <span className="text-muted">·</span>
      <span className="min-w-0 flex-1 truncate text-fg">{step.title}</span>
      {statusIcon[step.status]}
    </div>
  );
}
