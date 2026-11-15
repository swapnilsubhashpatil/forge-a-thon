import { useState } from "react";
import type { ContextFile, ContextReport, FileRole } from "../../../src/shared/protocol.ts";
import { cacheHitRatio, SCORECARD_TOP_K, scoreContext } from "../../../src/context/scorecard.ts";
import { cx, formatTokens } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, PathLink, PathText } from "./primitives.tsx";

const roleStyles: Record<FileRole, string> = {
  target: "bg-green/14 text-green",
  reference: "bg-blue/14 text-blue",
  mentioned: "bg-purple/14 text-purple",
};

function UsageMarks({ read, edited }: { read: boolean; edited: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-2xs">
      <span title={read ? "Read by the agent" : "Not read yet"} className={read ? "text-blue" : "text-muted opacity-40"}>
        <Icon name="eye" />
      </span>
      <span title={edited ? "Edited (accepted hunks)" : "Not edited"} className={edited ? "text-green" : "text-muted opacity-40"}>
        <Icon name="edit" />
      </span>
    </span>
  );
}

function FileRow({ file, read, edited }: { file: ContextFile; read: boolean; edited: boolean }) {
  return (
    <li>
      <button
        type="button"
        title={`Open ${file.path} · relevance ${file.score.toFixed(2)}`}
        onClick={() => post({ type: "openFile", path: file.path })}
        className="flex w-full flex-col gap-1 rounded px-2 py-1 text-left hover:bg-hover"
      >
        <span className="flex w-full items-center gap-2">
          <UsageMarks read={read} edited={edited} />
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

function Scorecard({ report }: { report: ContextReport }) {
  const score = scoreContext(report);
  const unpredicted = report.edited.filter((path) => !report.files.some((file) => file.path === path));
  return (
    <div className="mt-1 flex flex-col gap-1 border-t border-border px-2 pt-1.5 text-xs" aria-label="Prediction scorecard">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
        <span>
          predicted <span className="text-fg tabular-nums">{report.files.length}</span>
        </span>
        <span>
          read <span className="text-fg tabular-nums">{report.read.length}</span>
        </span>
        <span>
          edited <span className="text-fg tabular-nums">{report.edited.length}</span>
        </span>
        {score.edited > 0 && (
          <span
            title={`Edited files that were among Anvil's top ${SCORECARD_TOP_K} predictions`}
            className={cx("rounded px-1.5 font-medium", score.hits === score.edited ? "bg-green/14 text-green" : "bg-yellow/14 text-yellow")}
          >
            edited in top-{SCORECARD_TOP_K} predicted: {score.hits}/{score.edited}
          </span>
        )}
      </div>
      {unpredicted.length > 0 && (
        <div className="text-muted">
          edited but not predicted:{" "}
          {unpredicted.map((path) => (
            <PathLink key={path} path={path} className="mr-2 font-mono" />
          ))}
        </div>
      )}
    </div>
  );
}

function ContextGauge({ live }: { live: NonNullable<ContextReport["live"]> }) {
  const ratio = live.threshold > 0 ? live.inputTokens / live.threshold : 0;
  const cache = cacheHitRatio(live.inputTokens, live.cacheReadTokens);
  return (
    <div className="flex items-center gap-2 px-2 pt-1 text-xs text-muted" aria-label="Live context usage">
      <span className="shrink-0">window</span>
      <progress
        className={cx("budget-bar flex-1", ratio > 0.8 && "near-limit")}
        max={live.threshold}
        value={Math.min(live.inputTokens, live.threshold)}
        aria-label="Input tokens before compaction"
      />
      <span className="shrink-0 tabular-nums" title="Input tokens of the latest model call / compaction trigger">
        {formatTokens(live.inputTokens)} / {formatTokens(live.threshold)}
      </span>
      <span className="shrink-0 tabular-nums" title="Share of input served from the provider's prompt cache">
        cache {cache === undefined ? "n/a" : `${Math.round(cache * 100)}%`}
      </span>
      {live.compactions > 0 && <span className="shrink-0">compacted ×{live.compactions}</span>}
    </div>
  );
}

export function ContextCard({ report, defaultOpen }: { report: ContextReport; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ratio = report.budgetTokens > 0 ? report.usedTokens / report.budgetTokens : 0;
  const score = scoreContext(report);

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
          {score.edited > 0 && (
            <span className="text-xs text-muted tabular-nums" title={`Edited files among the top ${SCORECARD_TOP_K} predicted`}>
              hit {score.hits}/{score.edited}
            </span>
          )}
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
          {(report.attachments?.length ?? 0) > 0 && (
            <div className="mb-1 border-b border-border px-2 pb-1.5">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted">
                <Icon name="pinned" />
                <span>attached by you (sent first)</span>
              </div>
              <ul className="flex flex-wrap gap-1">
                {report.attachments!.map((attachment) => (
                  <li key={attachment.label} className="flex items-center gap-1 rounded-sm bg-purple/14 px-1.5 font-mono text-2xs text-purple">
                    <Icon name={attachment.kind === "terminal" ? "terminal" : "code"} />
                    {attachment.label}
                    <span className="text-muted">~{formatTokens(attachment.tokens)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul>
            {report.files.map((file) => (
              <FileRow key={file.path} file={file} read={report.read.includes(file.path)} edited={report.edited.includes(file.path)} />
            ))}
          </ul>
          <Scorecard report={report} />
          {report.live && <ContextGauge live={report.live} />}
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
          {(report.rules?.length ?? 0) > 0 && (
            <p className="mt-1.5 flex items-center gap-1 px-2 text-xs text-muted">
              <Icon name="book" />
              <span>project rules from</span>
              <span className="font-mono text-fg">{report.rules!.join(", ")}</span>
            </p>
          )}
          {report.verify && (
            <p className="mt-1.5 flex items-center gap-1 px-2 text-xs text-muted">
              <Icon name="beaker" />
              <span>verify with</span>
              <code className="rounded bg-code px-1 font-mono text-fg">{report.verify}</code>
            </p>
          )}
          <p className="mt-1.5 px-2 text-xs text-muted">{report.strategy}</p>
        </div>
      )}
    </section>
  );
}
