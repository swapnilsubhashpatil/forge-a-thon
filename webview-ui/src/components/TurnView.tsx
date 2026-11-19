import { memo, useState } from "react";
import type { ChangeSetSummary, PlanItem, RevertScope, Step, Turn } from "../../../src/shared/protocol.ts";
import { post } from "../state/vscode.ts";
import { cx, formatDuration, formatTokens, shortModel } from "../format.ts";
import { formatUsd } from "../../../src/shared/sessionStats.ts";
import { ApprovalCard } from "./ApprovalCard.tsx";
import { ContextCard } from "./ContextCard.tsx";
import { Markdown } from "./Markdown.tsx";
import { Notice } from "./Notice.tsx";
import { Reasoning } from "./Reasoning.tsx";
import { SubagentRow } from "./SubagentRow.tsx";
import { ToolRow } from "./ToolRow.tsx";
import type { GlyphName } from "./Glyph.tsx";
import { Icon } from "./primitives.tsx";

function StepView({ step, live }: { step: Step; live: boolean }) {
  switch (step.kind) {
    case "text":
      return <Markdown text={step.text} />;
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

const revertScopes: Array<{ scope: RevertScope; label: string; hint: string }> = [
  { scope: "conversation", label: "Conversation only", hint: "Rewind the chat to before this message and put it back in the input. Files stay as they are." },
  { scope: "code", label: "Code only", hint: "Undo file edits made from this message onward. The chat stays." },
  { scope: "both", label: "Conversation and code", hint: "Rewind the chat and undo file edits made from this message onward." },
];

const menuButton = "rounded px-1.5 py-0.5 text-xs text-fg hover:bg-hover";

function RevertMenu({ turnId, busy }: { turnId: string; busy: boolean }) {
  const [stage, setStage] = useState<"closed" | "open" | RevertScope>("closed");
  const current = busy ? "closed" : stage;
  const run = (scope: RevertScope) => {
    setStage("closed");
    post({ type: "restore", turnId, scope });
  };

  if (current === "closed") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setStage("open")}
        title={busy ? "Stop the running turn to revert" : "Revert to before this message"}
        className="flex items-center gap-1 rounded px-1 text-xs text-muted opacity-70 hover:bg-hover hover:opacity-100"
      >
        <Icon name="undo" />
        Revert
      </button>
    );
  }

  if (current === "open") {
    return (
      <div role="menu" aria-label="Revert" className="flex flex-wrap items-center justify-end gap-0.5">
        {revertScopes.map(({ scope, label, hint }) => (
          <button key={scope} type="button" role="menuitem" title={hint} onClick={() => (scope === "conversation" ? run(scope) : setStage(scope))} className={menuButton}>
            {label}
          </button>
        ))}
        <button type="button" aria-label="Close" onClick={() => setStage("closed")} className="grid size-5 place-items-center rounded text-muted hover:bg-hover">
          <Icon name="close" />
        </button>
      </div>
    );
  }

  return (
    <div role="alertdialog" aria-label="Confirm revert" className="flex flex-wrap items-center justify-end gap-1 text-xs">
      <span className="text-muted">Undo file edits from this message on?</span>
      <button type="button" autoFocus onClick={() => run(current)} className="rounded bg-accent px-1.5 py-0.5 text-accent-fg hover:bg-accent-hover">
        Revert
      </button>
      <button type="button" onClick={() => setStage("closed")} className={menuButton}>
        Cancel
      </button>
    </div>
  );
}

function Prompt({ turn, busy }: { turn: Turn; busy: boolean }) {
  return (
    <div className="rounded border border-border bg-input/60 px-3 py-2">
      <div className="mb-0.5 flex items-start gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted">
          {turn.reverted ? (
            <>
              <Icon name="history" />
              Reverted: no longer part of the agent's history
            </>
          ) : (
            turn.followUp && "Follow-up from Anvil"
          )}
        </span>
        {!turn.reverted && <RevertMenu turnId={turn.id} busy={busy} />}
      </div>
      <p className="text-base whitespace-pre-wrap text-fg">{turn.prompt}</p>
      {turn.mentions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {turn.mentions.map((mention) => (
            <span key={mention} className="rounded-sm bg-badge/40 px-1.5 font-mono text-xs text-fg">
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
      <Icon name={paused ? "clock" : "hammer"} className={paused ? "text-yellow" : "text-orange"} />
      <span>{paused ? "Waiting for your review…" : "Working…"}</span>
    </div>
  );
}

const planIcons: Record<PlanItem["status"], { icon: GlyphName; tone: string }> = {
  pending: { icon: "circle", tone: "text-muted" },
  in_progress: { icon: "arrow-right", tone: "text-orange" },
  completed: { icon: "check-circle", tone: "text-green" },
  blocked: { icon: "error", tone: "text-yellow" },
  cancelled: { icon: "skip", tone: "text-muted" },
};

function PlanChecklist({ plan }: { plan: PlanItem[] }) {
  const done = plan.filter((item) => item.status === "completed").length;
  return (
    <section className="rounded border border-border bg-editor/40 px-2 py-1.5" aria-label="Agent plan">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <Icon name="plan" />
        <span className="text-fg">Plan</span>
        <span className="font-mono tabular-nums">
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

function TurnChanges({ changeSet }: { changeSet: ChangeSetSummary }) {
  const added = changeSet.files.reduce((sum, file) => sum + file.added, 0);
  const removed = changeSet.files.reduce((sum, file) => sum + file.removed, 0);
  const state = changeSet.undone ? "undone" : changeSet.kept ? "kept" : undefined;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
      <Icon name="diff" />
      <span className="font-mono tabular-nums">
        {changeSet.files.length} {changeSet.files.length === 1 ? "file" : "files"} <span className="text-added">+{added}</span> <span className="text-removed">−{removed}</span>
      </span>
      <span className="min-w-0 truncate" title={changeSet.files.map((file) => file.path).join("\n")}>
        {changeSet.files.map((file) => file.path.split("/").pop()).join(", ")}
      </span>
      {state && <span className="rounded bg-secondary px-1.5 text-secondary-fg">{state}</span>}
    </div>
  );
}

function Resume({ turnId }: { turnId: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={() => post({ type: "continue" })} className="flex items-center gap-1 rounded bg-secondary px-1.5 text-secondary-fg hover:bg-secondary-hover" title="Pick up where the agent stopped">
        <Icon name="play" />
        Continue
      </button>
      <button type="button" onClick={() => post({ type: "retry", turnId })} className="flex items-center gap-1 rounded bg-secondary px-1.5 text-secondary-fg hover:bg-secondary-hover" title="Run this message again">
        <Icon name="retry" />
        Retry
      </button>
    </span>
  );
}

function Footer({ turn, resumable }: { turn: Turn; resumable: boolean }) {
  const { input, output, cached } = turn.usage;
  const parts = [
    shortModel(turn.model),
    turn.endedAt ? formatDuration(turn.endedAt - turn.startedAt) : undefined,
    `${turn.steps.filter((step) => step.kind === "tool").length} tools`,
    `${formatTokens(input)} in · ${formatTokens(output)} out${cached ? ` · ${formatTokens(cached)} cached` : ""}`,
    turn.usage.costUsd !== undefined ? `≈${formatUsd(turn.usage.costUsd)}` : undefined,
  ].filter(Boolean);

  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-muted">
      {turn.status === "cancelled" && (
        <span className="flex shrink-0 items-center gap-1 rounded bg-secondary px-1.5 text-secondary-fg">
          <Icon name="stop" />
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
          <Icon name={turn.finish.verified ? "check-circle" : "warning"} />
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
      {resumable && <Resume turnId={turn.id} />}
      <span className="truncate font-mono" title={turn.model}>{parts.join(" · ")}</span>
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
  const resumable = latest && !busy && (turn.status === "cancelled" || turn.status === "error");

  return (
    <article className={cx("relative flex flex-col py-4 pr-3 pl-8", !live && "turn-finished", turn.reverted && "opacity-50")}>
      <span aria-hidden="true" className="absolute top-0 bottom-0 left-[18.5px] w-px bg-border" />
      <Icon name="notch" className={cx("absolute top-[27px] left-3", turn.reverted ? "text-muted" : "text-orange")} />
      <Prompt turn={turn} busy={busy} />
      {turn.context && (
        <div className="mt-3">
          <ContextCard report={turn.context} />
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
      {!live && <Footer turn={turn} resumable={resumable} />}
      {!live && changeSet && changeSet.files.length > 0 && <TurnChanges changeSet={changeSet} />}
    </article>
  );
});
