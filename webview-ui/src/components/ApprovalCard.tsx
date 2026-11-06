import type { ApprovalStep } from "../../../src/shared/protocol.ts";
import { toolBaseName } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon } from "./primitives.tsx";

const editorReviewed = new Set(["propose_edit", "create_file"]);

function Resolved({ step }: { step: ApprovalStep }) {
  const allowed = step.status === "allowed";
  return (
    <div className="flex items-center gap-2 px-1 text-sm text-muted">
      <Icon name={allowed ? "pass" : "circle-slash"} className={allowed ? "text-green" : "text-red"} />
      <span>{allowed ? "Allowed" : "Denied"}</span>
      <span className="min-w-0 truncate">{step.title}</span>
    </div>
  );
}

export function ApprovalCard({ step }: { step: ApprovalStep }) {
  if (step.status !== "pending") return <Resolved step={step} />;

  if (editorReviewed.has(toolBaseName(step.toolName))) {
    return (
      <div className="flex items-center gap-2 rounded border border-blue/40 bg-blue/8 px-3 py-2 text-sm" role="status">
        <Icon name="diff" className="text-blue" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-fg">{step.title}</div>
          <div className="text-xs text-muted">Reviewing in editor — accept or reject each change there.</div>
        </div>
        <Icon name="loading" spin className="text-muted" />
      </div>
    );
  }

  const command = toolBaseName(step.toolName) === "run_command";
  return (
    <div className="overflow-hidden rounded border border-yellow/50 bg-yellow/6" role="group" aria-label="Approval required">
      <div className="flex items-center gap-2 px-3 pt-2 text-sm">
        <Icon name="shield" className="text-yellow" />
        <span className="flex-1 text-fg">{step.title}</span>
        <span className="text-2xs tracking-wide text-muted uppercase">Needs approval</span>
      </div>
      <div className="px-3 py-2">
        {command ? (
          <pre className="overflow-x-auto rounded border border-border bg-editor px-2 py-1.5 font-mono text-xs text-fg">
            <span className="text-muted select-none">$ </span>
            {step.detail}
          </pre>
        ) : (
          <p className="text-sm whitespace-pre-wrap text-fg">{step.detail}</p>
        )}
      </div>
      <div className="flex justify-end gap-2 px-3 pb-2">
        <button
          type="button"
          className="rounded bg-secondary px-3 py-1 text-sm text-secondary-fg hover:bg-secondary-hover"
          onClick={() => post({ type: "approve", toolCallId: step.toolCallId, allow: false })}
        >
          Deny
        </button>
        <button
          type="button"
          className="rounded bg-accent px-3 py-1 text-sm text-accent-fg hover:bg-accent-hover"
          onClick={() => post({ type: "approve", toolCallId: step.toolCallId, allow: true })}
        >
          Allow
        </button>
      </div>
    </div>
  );
}
