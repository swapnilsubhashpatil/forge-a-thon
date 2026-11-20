import { useState } from "react";
import type { ContextFile, ContextReport, FileRole } from "../../../src/shared/protocol.ts";
import { SCORECARD_TOP_K, scoreContext } from "../../../src/context/scorecard.ts";
import { cx, formatTokens, splitPath } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, PathLink, PathText, StatusGlyph } from "./primitives.tsx";

const roleTint: Record<FileRole, string> = {
  target: "border-orange/40 bg-orange/10 text-orange",
  reference: "border-blue/40 bg-blue/10 text-blue",
  mentioned: "border-border bg-raised text-fg",
};

const groups: Array<{ role: FileRole; title: string }> = [
  { role: "target", title: "Will edit" },
  { role: "reference", title: "For reference" },
  { role: "mentioned", title: "You mentioned" },
];

const PREVIEW = 3;

function FileChip({ file }: { file: ContextFile }) {
  return (
    <span title={`${file.path}: ${file.reasons.join("; ")}`} className={cx("flex h-5 max-w-32 min-w-0 shrink items-center rounded border px-1.5 font-mono text-xs", roleTint[file.role])}>
      <span className="truncate">{splitPath(file.path).base}</span>
    </span>
  );
}

function Meter({ used, budget }: { used: number; budget: number }) {
  const ratio = budget > 0 ? Math.min(1, used / budget) : 0;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 @max-[300px]:hidden" title={`${used} of ${budget} context tokens`}>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-fg/10">
        <span className={cx("block h-full rounded-full", ratio > 0.9 ? "bg-yellow" : "bg-blue")} style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="font-mono text-xs text-muted tabular-nums">
        {formatTokens(used)}/{formatTokens(budget)}
      </span>
    </span>
  );
}

function FileRow({ file, read, edited }: { file: ContextFile; read: boolean; edited: boolean }) {
  return (
    <li>
      <button
        type="button"
        title={`Open ${file.path}\n${file.reasons.join("\n")}`}
        onClick={() => post({ type: "openFile", path: file.path })}
        className="flex min-h-6 w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-hover"
      >
        <PathText path={file.path} className="shrink-0 font-mono text-xs" />
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{file.reasons.join(" · ")}</span>
        <Icon name="eye" size={12} className={read ? "text-blue" : "text-muted opacity-30"} />
        <Icon name="edit" size={12} className={edited ? "text-green" : "text-muted opacity-30"} />
        <span className="w-9 shrink-0 text-right font-mono text-xs text-muted tabular-nums">{formatTokens(file.tokens)}</span>
      </button>
    </li>
  );
}

function Outcome({ report }: { report: ContextReport }) {
  const score = scoreContext(report);
  if (score.edited === 0) return null;
  const unpicked = report.edited.filter((path) => !report.files.some((file) => file.path === path));
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 px-1.5 text-xs text-muted" title={`Edited files among Anvil's top ${SCORECARD_TOP_K} picks`}>
      <Icon name="check-circle" size={12} className={score.hits === score.edited ? "text-green" : "text-yellow"} />
      <span>
        Anvil picked {score.hits} of the {score.edited} {score.edited === 1 ? "file" : "files"} it edited
      </span>
      {unpicked.map((path) => (
        <PathLink key={path} path={path} className="font-mono" />
      ))}
    </p>
  );
}

function Details({ report }: { report: ContextReport }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 px-1.5 pt-2 pb-2.5">
      {groups.map(({ role, title }) => {
        const files = report.files.filter((file) => file.role === role);
        if (!files.length) return null;
        return (
          <section key={role} aria-label={title}>
            <h4 className="px-1.5 pb-0.5 text-xs font-medium text-muted">{title}</h4>
            <ul>
              {files.map((file) => (
                <FileRow key={file.path} file={file} read={report.read.includes(file.path)} edited={report.edited.includes(file.path)} />
              ))}
            </ul>
          </section>
        );
      })}
      {(report.attachments?.length ?? 0) > 0 && (
        <section aria-label="You attached">
          <h4 className="px-1.5 pb-0.5 text-xs font-medium text-muted">You attached</h4>
          <ul className="flex flex-wrap gap-1 px-1.5">
            {report.attachments!.map((attachment) => (
              <li key={attachment.label} className="flex h-5 items-center gap-1 rounded border border-border bg-raised px-1.5 font-mono text-xs">
                <Icon name={attachment.kind === "terminal" ? "terminal" : attachment.kind === "image" ? "image" : "code"} size={12} className="text-muted" />
                {attachment.label}
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.fetched.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 px-1.5 text-xs text-muted">
          <span>Also read:</span>
          {report.fetched.map((path) => (
            <PathLink key={path} path={path} className="font-mono" />
          ))}
        </p>
      )}
      {report.verify && (
        <p className="flex items-center gap-1.5 px-1.5 text-xs text-muted">
          <span>Verify with</span>
          <code className="rounded bg-code px-1 font-mono text-fg">{report.verify}</code>
        </p>
      )}
      <Outcome report={report} />
      <p className="px-1.5 text-xs text-muted">{report.strategy}</p>
    </div>
  );
}

export function ContextFooter({ report }: { report?: ContextReport }) {
  const [open, setOpen] = useState(false);
  if (!report) {
    return (
      <div className="flex h-8 items-center gap-2 border-t border-border/60 bg-editor/50 px-3 text-xs text-muted">
        <StatusGlyph kind="pending" />
        Choosing context…
      </div>
    );
  }
  const ranked = [...report.files].sort((a, b) => b.score - a.score);
  const extras = [...(report.skills ?? []).map((name) => `/${name}`), ...(report.rules ?? [])];
  return (
    <div className="@container border-t border-border/60 bg-editor/50">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Context: ${report.files.length} files, ${formatTokens(report.usedTokens)} of ${formatTokens(report.budgetTokens)} tokens`}
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full min-w-0 items-center gap-1.5 px-3 text-left hover:bg-hover"
      >
        <Icon name="layers" size={13} className="shrink-0 text-muted" />
        {ranked.slice(0, PREVIEW).map((file) => (
          <FileChip key={file.path} file={file} />
        ))}
        {ranked.length > PREVIEW && <span className="shrink-0 text-xs text-muted">+{ranked.length - PREVIEW}</span>}
        {extras.map((label) => (
          <span key={label} className="hidden h-5 shrink-0 items-center rounded border border-purple/40 bg-purple/10 px-1.5 font-mono text-xs text-purple @min-[420px]:flex">
            {label}
          </span>
        ))}
        <Meter used={report.usedTokens} budget={report.budgetTokens} />
        <Icon name={open ? "chevron-up" : "chevron-down"} size={12} className="shrink-0 text-muted" />
      </button>
      {open && <Details report={report} />}
    </div>
  );
}
