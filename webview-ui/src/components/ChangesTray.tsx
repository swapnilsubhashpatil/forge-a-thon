import { useState } from "react";
import type { ChangeSetSummary, PendingReview } from "../../../src/shared/protocol.ts";
import { post } from "../state/vscode.ts";
import { DiffStat, Icon, PathLink } from "./primitives.tsx";

const rowButton = "btn px-1.5";

function ReviewRow({ review }: { review: PendingReview }) {
  return (
    <li className="flex min-h-6 items-center gap-2 pl-5">
      <PathLink path={review.path} className="font-mono text-xs" />
      <span className="shrink-0 font-mono text-xs text-yellow">
        {review.hunks} {review.hunks === 1 ? "change" : "changes"} to review
      </span>
      <span className="flex-1" />
      <DiffStat added={review.added} removed={review.removed} />
    </li>
  );
}

function EditGroup({ set }: { set: ChangeSetSummary }) {
  return (
    <div className="mt-1">
      <div className="flex items-center gap-2 pl-5 text-xs">
        <span className="min-w-0 flex-1 truncate text-muted">{set.label}</span>
        <button type="button" onClick={() => post({ type: "undo", changeSetId: set.id })} className={rowButton} title="Undo these edits">
          <Icon name="undo" />
          Undo
        </button>
      </div>
      <ul>
        {set.files.map((file) => (
          <li key={file.path} className="flex min-h-6 items-center gap-2 pl-5">
            <PathLink path={file.path} className="font-mono text-xs" />
            <span className="flex-1" />
            <DiffStat added={file.added} removed={file.removed} />
            <button type="button" onClick={() => post({ type: "openDiff", path: file.path })} className="btn btn-icon" title="Open diff" aria-label={`Open diff of ${file.path}`}>
              <Icon name="diff" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChangesTray({ changeSets, reviews }: { changeSets: ChangeSetSummary[]; reviews: PendingReview[] }) {
  const [open, setOpen] = useState(false);
  const active = changeSets.filter((set) => !set.undone && !set.kept);
  if (active.length === 0 && reviews.length === 0) return null;

  const files = [...active.flatMap((set) => set.files), ...reviews];
  const fileCount = new Set(files.map((file) => file.path)).size;
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  return (
    <section className="mx-3 mt-2 shrink-0 rounded-xl border border-border bg-raised shadow-md" aria-label="Edits">
      <div className="flex h-9 items-center gap-1.5 px-1.5 text-sm">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="btn min-w-0 flex-1 justify-start gap-2 px-1.5 font-normal">
          <Icon name={open ? "chevron-down" : "chevron-right"} className="text-muted" />
          <span className="truncate font-medium text-fg">
            {fileCount} {fileCount === 1 ? "file" : "files"} edited
          </span>
          <DiffStat added={added} removed={removed} />
          {reviews.length > 0 && <span className="truncate text-xs text-yellow">{reviews.length} waiting for review</span>}
        </button>
        <button type="button" onClick={() => post({ type: "keepAll" })} className={rowButton} title="Keep every edit" aria-label="Keep all">
          <Icon name="keep" className="text-green" />
          <span className="max-[400px]:hidden">Keep all</span>
        </button>
        <button type="button" onClick={() => post({ type: "discardAll" })} className={rowButton} title="Discard every edit" aria-label="Discard all">
          <Icon name="discard" className="text-red" />
          <span className="max-[400px]:hidden">Discard all</span>
        </button>
      </div>
      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-border px-1.5 pt-1 pb-1.5">
          {reviews.length > 0 && (
            <ul aria-label="Waiting for review">
              {reviews.map((review) => (
                <ReviewRow key={review.path} review={review} />
              ))}
            </ul>
          )}
          {active.map((set) => (
            <EditGroup key={set.id} set={set} />
          ))}
        </div>
      )}
    </section>
  );
}
