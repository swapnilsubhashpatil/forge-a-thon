import { useState } from "react";
import type { ChangeSetSummary, PendingReview } from "../../../src/shared/protocol.ts";
import { post } from "../state/vscode.ts";
import { DiffStat, Icon, PathLink } from "./primitives.tsx";

const rowButton = "flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-fg hover:bg-hover";

function ReviewRow({ review }: { review: PendingReview }) {
  return (
    <li className="flex items-center gap-2 py-0.5 pl-2">
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
    <div className="mt-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="min-w-0 flex-1 truncate text-muted">{set.label}</span>
        <button type="button" onClick={() => post({ type: "undo", changeSetId: set.id })} className={rowButton} title="Undo these edits">
          <Icon name="undo" />
          Undo
        </button>
      </div>
      <ul>
        {set.files.map((file) => (
          <li key={file.path} className="flex items-center gap-2 py-0.5 pl-2">
            <PathLink path={file.path} className="font-mono text-xs" />
            <span className="flex-1" />
            <DiffStat added={file.added} removed={file.removed} />
            <button type="button" onClick={() => post({ type: "openDiff", path: file.path })} className={rowButton} title="Open diff" aria-label={`Open diff of ${file.path}`}>
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
    <section className="shrink-0 border-t border-border bg-editor/50" aria-label="Edits">
      <div className="flex h-7 items-center gap-2 px-2 text-sm">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 hover:bg-hover">
          <Icon name={open ? "chevron-down" : "chevron-right"} className="text-muted" />
          <span className="text-fg">
            {fileCount} {fileCount === 1 ? "file" : "files"} edited
          </span>
          <DiffStat added={added} removed={removed} />
          {reviews.length > 0 && <span className="truncate text-xs text-yellow">{reviews.length} waiting for review</span>}
        </button>
        <button type="button" onClick={() => post({ type: "keepAll" })} className={rowButton} title="Keep every edit">
          <Icon name="keep" className="text-green" />
          Keep all
        </button>
        <button type="button" onClick={() => post({ type: "discardAll" })} className={rowButton} title="Discard every edit">
          <Icon name="discard" className="text-red" />
          Discard all
        </button>
      </div>
      {open && (
        <div className="max-h-56 overflow-y-auto px-3 pb-2">
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
