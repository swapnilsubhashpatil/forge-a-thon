import { useState } from "react";
import type { ToolStatus, ToolStep } from "../../../src/shared/protocol.ts";
import { cx, toolBaseName } from "../format.ts";
import { DiffStat, Icon, PathLink } from "./primitives.tsx";

const toolIcons: Record<string, string> = {
  read_file: "file",
  search_code: "search",
  find_symbol: "symbol-method",
  repo_map: "list-tree",
  propose_edit: "edit",
  create_file: "new-file",
  run_command: "terminal",
  explain_context: "info",
};

function StatusIcon({ status }: { status: ToolStatus }) {
  switch (status) {
    case "running":
      return <Icon name="loading" spin className="text-muted" />;
    case "awaiting-approval":
      return <Icon name="circle-large-outline" className="animate-pulse-soft text-yellow" />;
    case "done":
      return <Icon name="check" className="text-green" />;
    case "denied":
      return <Icon name="circle-slash" className="text-muted" />;
    case "error":
      return <Icon name="close" className="text-red" />;
  }
}

export function ToolRow({ step }: { step: ToolStep }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(step.output);

  return (
    <div className="text-sm">
      <div
        className={cx(
          "group flex min-h-6 items-center gap-2 rounded px-1 py-0.5",
          expandable && "cursor-pointer hover:bg-hover",
        )}
        onClick={expandable ? () => setOpen(!open) : undefined}
      >
        <Icon name={toolIcons[toolBaseName(step.name)] ?? "tools"} className="text-muted" />
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} output of ${step.title}`}
            className="shrink-0 text-fg"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(!open);
            }}
          >
            {step.title}
          </button>
        ) : (
          <span className="shrink-0 text-fg">{step.title}</span>
        )}
        {step.path && <PathLink path={step.path} className="font-mono text-xs" />}
        {step.detail && <span className="min-w-0 truncate text-muted" title={step.detail}>{step.detail}</span>}
        <span className="flex-1" />
        {step.threadTitle && (
          <span className="max-w-28 shrink-0 truncate rounded bg-purple/12 px-1.5 text-2xs text-purple" title={step.threadTitle}>
            {step.threadTitle}
          </span>
        )}
        {step.diff && <DiffStat added={step.diff.added} removed={step.diff.removed} />}
        {expandable && (
          <Icon name="chevron-down" className={cx("text-muted opacity-0 transition group-hover:opacity-100", open && "rotate-180 opacity-100")} />
        )}
        <StatusIcon status={step.status} />
      </div>
      {open && step.output && (
        <pre className="mt-1 mb-1 ml-6 max-h-60 overflow-auto rounded border border-border bg-editor px-3 py-2 font-mono text-xs whitespace-pre-wrap text-fg">
          {step.output}
        </pre>
      )}
    </div>
  );
}
