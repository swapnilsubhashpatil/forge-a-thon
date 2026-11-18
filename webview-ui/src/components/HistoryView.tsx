import { useState } from "react";
import type { ChatState, ConversationSummary } from "../../../src/shared/protocol.ts";
import { cx, relativeTime, shortModel } from "../format.ts";
import { showView } from "../state/store.ts";
import { post } from "../state/vscode.ts";
import { Icon } from "./primitives.tsx";

function HistoryRow({ entry, current }: { entry: ConversationSummary; current: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const details = [relativeTime(entry.updatedAt), entry.model && shortModel(entry.model), `${entry.edits} ${entry.edits === 1 ? "edit" : "edits"}`].filter(Boolean);

  return (
    <li className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-hover", current && "bg-hover")}>
      <button
        type="button"
        onClick={() => {
          if (!current) post({ type: "openHistory", id: entry.id });
          showView("chat");
        }}
        className="flex min-w-0 flex-1 flex-col text-left"
      >
        <span className="flex items-center gap-1.5">
          {current && <Icon name="notch" size={10} className="text-orange" />}
          <span className="truncate text-sm text-fg">{entry.title}</span>
        </span>
        <span className="truncate text-xs text-muted">{details.join(" · ")}</span>
      </button>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs">
          <button type="button" autoFocus onClick={() => post({ type: "deleteHistory", id: entry.id })} className="btn bg-red/20 hover:bg-red/30">
            Delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="btn">
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${entry.title}`}
          title="Delete"
          onClick={() => setConfirming(true)}
          className="btn btn-icon"
        >
          <Icon name="trash" />
        </button>
      )}
    </li>
  );
}

export function HistoryView({ chat }: { chat: ChatState }) {
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const entries = chat.history.filter((entry) => entry.title.toLowerCase().includes(query));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-input-border bg-input px-2 focus-within:border-focus">
          <Icon name="search" className="text-muted" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter conversations"
            aria-label="Filter conversations"
            className="h-7 min-w-0 flex-1 bg-transparent text-sm text-input-fg outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            post({ type: "newSession" });
            showView("chat");
          }}
          className="btn btn-primary h-7"
        >
          <Icon name="plus" />
          New chat
        </button>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pb-2" aria-label="Conversations">
        {entries.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} current={entry.id === chat.conversationId} />
        ))}
        {entries.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{query ? "No conversations match." : "No saved conversations yet."}</li>}
      </ul>
    </div>
  );
}
