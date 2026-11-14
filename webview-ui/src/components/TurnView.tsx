import { memo, useState } from "react";
import type { ChangeSetSummary, PlanItem, Step, Turn } from "../../../src/shared/protocol.ts";
import { post } from "../state/vscode.ts";
import { cx, formatDuration, formatTokens, shortModel } from "../format.ts";
import { ApprovalCard } from "./ApprovalCard.tsx";
import { ContextCard } from "./ContextCard.tsx";
import { Markdown } from "./Markdown.tsx";
import { Notice } from "./Notice.tsx";
import { Reasoning } from "./Reasoning.tsx";
import { SubagentRow } from "./SubagentRow.tsx";
import { ToolRow } from "./ToolRow.tsx";
import { Icon } from "./primitives.tsx";

function StepView({ step, live }: { step: Step; live: boolean }) {
  switch (step.kind) {
    case "text":
      return <Markdown text={step.text} streaming={live} />;
    case "reasoning":
      return <Reasoning step={step} active={live} />;
    case "tool":
      return <ToolRow step={step} />;
    case "approval":
      return <ApprovalCard step={step} />;
    case "subagent":
      return <SubagentRow step={step} />;
    case "notice":
      return <Notice step={step} />;
  }
}

function isCompact(step: Step): boolean {
  return step.kind === "tool" || (step.kind === "approval" && step.status !== "pending");
}

function gapBefore(step: Step, previous: Step | undefined): string {
  if (!previous) return "mt-3";
  return isCompact(step) && isCompact(previous) ? "mt-0.5" : "mt-3";
}

function RestoreMenu({ turn, disabled }: { turn: Turn; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const restore = (withCode: boolean) => {
    setOpen(false);
    post({ type: "restore", turnId: turn.id, withCode });
  };
  return (
    <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      {open ? (
        <>
          <button type="button" onClick={() => restore(false)} className="rounded bg-secondary px-1.5 py-0.5 text-2xs text-secondary-fg hover:bg-secondary-hover" title="Rewind the conversation to before this message and put it back in the input. Code stays as it is.">
            Restore message
          </button>
          <button type="button" onClick={() => restore(true)} className="rounded bg-secondary px-1.5 py-0.5 text-2xs text-secondary-fg hover:bg-secondary-hover" title="Also undo the code changes of this turn and every later turn. Files you edited since are skipped.">
            Restore message and code
          </button>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-5 place-items-center rounded text-muted hover:bg-hover">
            <Icon name="close" />
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          title={disabled ? "Stop the running turn to restore" : "Restore to this message"}
          className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-2xs text-secondary-fg hover:bg-secondary-hover disabled:opacity-50"
        >
          <Icon name="discard" />
          Restore
        </button>
      )}
    </div>
  );
}

function Prompt({ turn, busy }: { turn: Turn; busy: boolean }) {
  return (
    <div className="group relative rounded border border-border bg-input/60 px-3 py-2">
      {!turn.reverted && !turn.followUp && turn.status !== "running" && turn.status !== "paused" && <RestoreMenu turn={turn} disabled={busy} />}
      {turn.reverted && (
        <span className="mb-1 flex items-center gap-1 text-2xs text-muted">
          <Icon name="history" />
          Reverted: no longer part of the agent's history
        </span>
      )}
      <p className="text-base whitespace-pre-wrap text-fg">{turn.prompt}</p>
      {turn.mentions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {turn.mentions.map((mention) => (
            <span key={mention} className="rounded-sm bg-badge/40 px-1.5 font-mono text-2xs text-fg">
              @{mention}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Working({ paused }: { paused: boolean }) {
  return (
    <div className="mt-3 flex items-center gap-2 px-1 text-sm text-muted">
      <Icon name={paused ? "watch" : "loading"} spin={!paused} />
      <span className="animate-pulse-soft">{paused ? "Waiting for your review…" : "Working…"}</span>
    </div>
  );
}

const planIcons: Record<PlanItem["status"], { icon: string; tone: string }> = {
  pending: { icon: "circle-large-outline", tone: "text-muted" },
  in_progress: { icon: "arrow-circle-right", tone: "text-blue" },
  completed: { icon: "pass-filled", tone: "text-green" },
  blocked: { icon: "error", tone: "text-yellow" },
  cancelled: { icon: "circle-slash", tone: "text-muted" },
};

function PlanChecklist({ plan }: { plan: PlanItem[] }) {
  const done = plan.filter((item) => item.status === "completed").length;
  return (
    <section className="rounded border border-border bg-editor/40 px-2 py-1.5" aria-label="Agent plan">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <Icon name="checklist" />
        <span className="text-fg">Plan</span>
        <span className="tabular-nums">
          {done}/{plan.length}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {plan.map((item) => (
          <li key={item.step} className={cx("flex items-start gap-1.5 text-xs", item.status === "cancelled" && "line-through opacity-60")}>
            <Icon name={planIcons[item.status].icon} className={cx("mt-0.5 shrink-0", planIcons[item.status].tone)} />
            <span className={item.status === "in_progress" ? "text-fg" : "text-muted"}>{item.step}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TurnChanges({ changeSet, turnId }: { changeSet: ChangeSetSummary; turnId: string }) {
  const added = changeSet.files.reduce((sum, file) => sum + file.added, 0);
  const removed = changeSet.files.reduce((sum, file) => sum + file.removed, 0);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
      <Icon name="diff" />
      <span>
        {changeSet.files.length} {changeSet.files.length === 1 ? "file" : "files"} <span className="text-added">+{added}</span> <span className="text-removed">−{removed}</span>
      </span>
      <span className="min-w-0 truncate" title={changeSet.files.map((file) => file.path).join("\n")}>
        {changeSet.files.map((file) => file.path.split("/").pop()).join(", ")}
      </span>
      {changeSet.undone ? (
        <span className="rounded bg-secondary px-1.5 text-secondary-fg">undone</span>
      ) : (
        <button type="button" onClick={() => post({ type: "undoTurn", turnId })} className="rounded bg-secondary px-1.5 text-secondary-fg hover:bg-secondary-hover" title="Undo this turn's code changes only; the conversation stays">
          Undo these changes
        </button>
      )}
    </div>
  );
}

function Footer({ turn }: { turn: Turn }) {
  const { input, output, cached } = turn.usage;
  const parts = [
    shortModel(turn.model),
    turn.endedAt ? formatDuration(turn.endedAt - turn.startedAt) : undefined,
    `${formatTokens(input)} in · ${formatTokens(output)} out${cached ? ` · ${formatTokens(cached)} cached` : ""}`,
  ].filter(Boolean);

  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-muted">
      {turn.status === "cancelled" && (
        <span className="flex shrink-0 items-center gap-1 rounded bg-secondary px-1.5 text-secondary-fg">
          <Icon name="debug-stop" />
          Cancelled
        </span>
      )}
      {turn.finish && (
        <span
          title={`${turn.finish.summary}\n${turn.finish.verification}`}
          className={cx(
            "flex shrink-0 items-center gap-1 rounded px-1.5",
            turn.finish.verified ? "bg-green/14 text-green" : "bg-yellow/14 text-yellow",
          )}
        >
          <Icon name={turn.finish.verified ? "pass" : "warning"} />
          {turn.finish.verified ? `Verified: ${turn.finish.command ?? turn.finish.verification}` : `Not verified: ${turn.finish.verification}`}
        </span>
      )}
      {turn.status === "superseded" && (
        <span className="flex shrink-0 items-center gap-1 rounded bg-secondary px-1.5 text-secondary-fg" title="Stopped so your new message could be sent">
          <Icon name="arrow-right" />
          Superseded by your message
        </span>
      )}
      {turn.status === "error" && (
        <span className="flex shrink-0 items-center gap-1 rounded bg-red/14 px-1.5 text-red">
          <Icon name="error" />
          Failed
        </span>
      )}
      <span className="truncate" title={turn.model}>{parts.join(" · ")}</span>
    </div>
  );
}

function showsWorking(turn: Turn): boolean {
  if (turn.status === "paused") return !turn.steps.some((step) => step.kind === "approval" && step.status === "pending");
  if (turn.steps.some((step) => step.kind === "tool" && step.status === "awaiting-approval")) return true;
  if (turn.status !== "running") return false;
  const last = turn.steps.at(-1);
  if (!last) return true;
  if (last.kind === "text" || last.kind === "reasoning") return false;
  return !(last.kind === "tool" && last.status === "running");
}

export const TurnView = memo(function TurnView({ turn, latest, busy, changeSet }: { turn: Turn; latest: boolean; busy: boolean; changeSet?: ChangeSetSummary }) {
  const running = turn.status === "running";
  const live = running || turn.status === "paused";
  const last = turn.steps.at(-1);

  return (
    <article className={cx("flex flex-col px-3 py-4", !live && "turn-finished", turn.reverted && "opacity-50")}>
      <Prompt turn={turn} busy={busy} />
      {turn.context && (
        <div className="mt-3">
          <ContextCard report={turn.context} defaultOpen={latest} />
        </div>
      )}
      {turn.plan && turn.plan.length > 0 && (
        <div className="mt-3">
          <PlanChecklist plan={turn.plan} />
        </div>
      )}
      {turn.steps.map((step, index) => (
        <div key={step.id} className={gapBefore(step, turn.steps[index - 1])}>
          <StepView step={step} live={running && step === last} />
        </div>
      ))}
      {showsWorking(turn) && <Working paused={turn.status === "paused" || turn.steps.some((step) => step.kind === "tool" && step.status === "awaiting-approval")} />}
      {!live && <Footer turn={turn} />}
      {!live && changeSet && changeSet.files.length > 0 && <TurnChanges changeSet={changeSet} turnId={turn.id} />}
    </article>
  );
});
