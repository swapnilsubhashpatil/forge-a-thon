import type { ApprovalStep } from "../../../src/shared/protocol.ts";
import { toolBaseName } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, PathLink } from "./primitives.tsx";

const editorReviewed = new Set(["propose_edit", "create_file"]);

function Resolved({ step }: { step: ApprovalStep }) {
  const allowed = step.status === "allowed";
  return (
    <div className="flex items-center gap-2 px-1 text-sm text-muted">
      <Icon name={allowed ? "check-circle" : "skip"} className={allowed ? "text-green" : "text-red"} />
      <span>{allowed ? "Allowed" : "Denied"}</span>
      <span className="min-w-0 truncate">{step.title}</span>
    </div>
  );
}

function targetPath(detail: string): string | undefined {
  try {
    const path = (JSON.parse(detail) as { path?: unknown }).path;
    return typeof path === "string" ? path : undefined;
  } catch {
    return undefined;
  }
}

export function ApprovalCard({ step }: { step: ApprovalStep }) {
  if (step.status !== "pending") return <Resolved step={step} />;

  if (editorReviewed.has(toolBaseName(step.toolName))) {
    return (
      <div className="flex items-center gap-2 rounded border border-blue/40 bg-blue/8 px-3 py-2 text-sm" role="status">
        <Icon name="diff" className="text-blue" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-fg">{step.title}</div>
          <div className="text-xs text-muted">Reviewing in the editor. Accept or reject each change there.</div>
        </div>
        <Icon name="clock" className="text-muted" />
      </div>
    );
  }

  const command = toolBaseName(step.toolName) === "run_command";
  const path = command ? undefined : targetPath(step.detail);
  const approve = (allow: boolean, forSession?: boolean) => post({ type: "approve", toolCallId: step.toolCallId, allow, forSession });

  return (
    <div className="overflow-hidden rounded border border-yellow/50 bg-yellow/6" role="group" aria-label="Approval required">
      <div className="flex items-center gap-2 px-3 pt-2 text-sm">
        <Icon name="shield" className="text-yellow" />
        <span className="flex-1 text-fg">{step.title}</span>
        <span className="text-xs text-muted">Needs approval</span>
      </div>
      <div className="px-3 py-2">
        {path && <PathLink path={path} className="mb-1 font-mono text-xs" />}
        {command ? (
          <pre className="overflow-x-auto rounded border border-border bg-editor px-2 py-1.5 font-mono text-xs text-fg">
            <span className="text-muted select-none">$ </span>
            {step.detail}
          </pre>
        ) : (
          <p className="font-mono text-xs whitespace-pre-wrap text-fg">{step.detail}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 px-3 pb-2">
        <button type="button" className="rounded bg-secondary px-3 py-1 text-sm text-secondary-fg hover:bg-secondary-hover" onClick={() => approve(false)}>
          Deny
        </button>
        {command && (
          <button
            type="button"
            title="Allow commands like this without asking again in this session"
            className="rounded bg-secondary px-3 py-1 text-sm text-secondary-fg hover:bg-secondary-hover"
            onClick={() => approve(true, true)}
          >
            Allow for this session
          </button>
        )}
        <button type="button" autoFocus className="rounded bg-accent px-3 py-1 text-sm text-accent-fg hover:bg-accent-hover" onClick={() => approve(true)}>
          Allow
        </button>
      </div>
    </div>
  );
}
