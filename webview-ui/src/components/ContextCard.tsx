import { useState } from "react";
import type { ContextFile, ContextReport, FileRole } from "../../../src/shared/protocol.ts";
import { cx, formatTokens } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, PathLink, PathText } from "./primitives.tsx";

const roleStyles: Record<FileRole, string> = {
  target: "bg-green/14 text-green",
  reference: "bg-blue/14 text-blue",
  mentioned: "bg-purple/14 text-purple",
};

function FileRow({ file }: { file: ContextFile }) {
  return (
    <li>
      <button
        type="button"
        title={`Open ${file.path} · relevance ${file.score.toFixed(2)}`}
        onClick={() => post({ type: "openFile", path: file.path })}
        className="flex w-full flex-col gap-1 rounded px-2 py-1 text-left hover:bg-hover"
      >
        <span className="flex w-full items-center gap-2">
          <PathText path={file.path} className="font-mono text-xs" />
          <span className={cx("shrink-0 rounded px-1.5 text-2xs font-medium", roleStyles[file.role])}>{file.role}</span>
          <span className="flex-1" />
          <span className="shrink-0 text-xs text-muted tabular-nums">{formatTokens(file.tokens)}</span>
        </span>
        {file.reasons.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {file.reasons.map((reason) => (
              <span key={reason} className="rounded-sm border border-border px-1.5 text-2xs text-muted">
                {reason}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

export function ContextCard({ report, defaultOpen }: { report: ContextReport; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ratio = report.budgetTokens > 0 ? report.usedTokens / report.budgetTokens : 0;

  return (
    <section className="rounded border border-border bg-editor/40" aria-label="Context selection">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full flex-col gap-1.5 rounded-t px-2 pt-1.5 pb-2 text-left hover:bg-hover"
      >
        <span className="flex w-full items-center gap-2 text-sm">
          <Icon name={open ? "chevron-down" : "chevron-right"} className="text-muted" />
          <Icon name="layers" className="text-blue" />
          <span className="text-fg">Context</span>
          <span className="text-muted">·</span>
          <span className="text-muted tabular-nums">
            {formatTokens(report.usedTokens)} / {formatTokens(report.budgetTokens)} tokens
          </span>
          <span className="flex-1" />
          <span className="text-xs text-muted">
            {report.files.length} {report.files.length === 1 ? "file" : "files"}
          </span>
        </span>
        <progress
          className={cx("budget-bar", ratio > 0.9 && "near-limit")}
          max={report.budgetTokens}
          value={report.usedTokens}
          aria-label="Context budget used"
        />
      </button>
      {open && (
        <div className="px-1 pb-2">
          <ul>
            {report.files.map((file) => (
              <FileRow key={file.path} file={file} />
            ))}
          </ul>
          {report.fetched.length > 0 && (
            <div className="mt-1 border-t border-border px-2 pt-1.5">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted">
                <Icon name="add" />
                <span>fetched by agent</span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {report.fetched.map((path) => (
                  <li key={path}>
                    <PathLink path={path} className="font-mono text-xs" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-1.5 px-2 text-xs text-muted">{report.strategy}</p>
        </div>
      )}
    </section>
  );
}
