import type { SubagentStep } from "../../../src/shared/protocol.ts";
import { Icon } from "./primitives.tsx";

const statusIcon = {
  running: <Icon name="pending" className="text-muted" />,
  done: <Icon name="check-circle" className="text-green" />,
  error: <Icon name="error" className="text-red" />,
};

export function SubagentRow({ step }: { step: SubagentStep }) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-lg border border-border bg-purple/5 px-2.5 text-sm">
      <Icon name="subagent" className="text-purple" />
      <span className="text-muted">Subagent</span>
      <span className="min-w-0 flex-1 truncate text-fg">{step.title}</span>
      {statusIcon[step.status]}
    </div>
  );
}
