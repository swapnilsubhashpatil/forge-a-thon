import { useState } from "react";
import type { ChangeSetSummary } from "../../../src/shared/protocol.ts";
import { post } from "../state/vscode.ts";
import { DiffStat, Icon, PathLink } from "./primitives.tsx";

export function ChangesBar({ changeSets }: { changeSets: ChangeSetSummary[] }) {
  const [open, setOpen] = useState(false);
  const active = changeSets.filter((set) => !set.undone);
  if (active.length === 0) return null;

  const files = active.flatMap((set) => set.files);
  const fileCount = new Set(files.map((file) => file.path)).size;
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  return (
    <section className="border-t border-border bg-editor/50" aria-label="Applied changes">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-7 w-full items-center gap-2 px-3 text-sm hover:bg-hover"
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} className="text-muted" />
        <span className="text-fg">
          {fileCount} {fileCount === 1 ? "file" : "files"} changed
        </span>
        <DiffStat added={added} removed={removed} />
        <span className="flex-1" />
        <span className="text-xs text-muted">
          {active.length} {active.length === 1 ? "change set" : "change sets"}
        </span>
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto px-3 pb-2">
          {active.map((set) => (
            <div key={set.id} className="mt-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-muted">{set.label}</span>
                <button
                  type="button"
                  onClick={() => post({ type: "undo", changeSetId: set.id })}
                  className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-fg hover:bg-hover"
                  aria-label={`Undo ${set.label}`}
                >
                  <Icon name="discard" />
                  Undo
                </button>
              </div>
              <ul>
                {set.files.map((file) => (
                  <li key={file.path} className="flex items-center gap-2 py-0.5 pl-2">
                    <PathLink path={file.path} className="font-mono text-xs" />
                    <span className="flex-1" />
                    <DiffStat added={file.added} removed={file.removed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
