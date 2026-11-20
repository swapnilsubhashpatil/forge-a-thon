import { memo, useState, type KeyboardEvent } from "react";
import type { ChangeSetSummary, PlanItem, RevertScope, Step, Turn } from "../../../src/shared/protocol.ts";
import { post } from "../state/vscode.ts";
import { cx, formatDuration, formatTokens, shortModel } from "../format.ts";
import { formatUsd } from "../../../src/shared/sessionStats.ts";
import { ApprovalCard } from "./ApprovalCard.tsx";
import { ContextFooter } from "./ContextCard.tsx";
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

const revertScopes: Array<{ scope: RevertScope; label: string; hint: string; icon: GlyphName }> = [
  { scope: "conversation", label: "Conversation only", hint: "Rewind the chat and put this message back in the input. Files stay.", icon: "history" },
  { scope: "code", label: "Code only", hint: "Undo file edits from this message on. The chat stays.", icon: "code" },
  { scope: "both", label: "Conversation and code", hint: "Rewind the chat and undo file edits from this message on.", icon: "undo" },
];

function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
  const index = items.indexOf(document.activeElement as HTMLElement);
  items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
}

function RevertMenu({ turnId, busy }: { turnId: string; busy: boolean }) {
  const [stage, setStage] = useState<"closed" | "open" | RevertScope>("closed");
  const current = busy ? "closed" : stage;
  const run = (scope: RevertScope) => {
    setStage("closed");
    post({ type: "restore", turnId, scope });
  };

  return (
    <div
      className="relative"
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setStage("closed")}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || current === "closed") return;
        event.stopPropagation();
        setStage("closed");
      }}
    >
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={current !== "closed"}
        aria-label="Revert"
        title={busy ? "Stop the running turn to revert" : "Revert to before this message"}
        onClick={() => setStage(current === "closed" ? "open" : "closed")}
        className={cx("btn btn-icon", current !== "closed" && "bg-hover text-fg")}
      >
        <Icon name="undo" />
      </button>
      {current === "open" && (
        <div role="menu" aria-label="Revert" onKeyDown={moveFocus} className="popover absolute top-full right-0 z-30 mt-1.5 w-64 max-w-[calc(100vw-48px)]">
          {revertScopes.map(({ scope, label, hint, icon }, index) => (
            <button
              key={scope}
              type="button"
              role="menuitem"
              autoFocus={index === 0}
              onClick={() => (scope === "conversation" ? run(scope) : setStage(scope))}
              className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
            >
              <Icon name={icon} className="mt-0.5 text-muted" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {current !== "closed" && current !== "open" && (
        <div role="alertdialog" aria-label="Confirm revert" className="popover absolute top-full right-0 z-30 mt-1.5 w-60 max-w-[calc(100vw-48px)] p-2.5">
          <p className="text-sm text-fg">Undo file edits from this message on?</p>
          <p className="mt-0.5 text-xs text-muted">{revertScopes.find((entry) => entry.scope === current)?.hint}</p>
          <div className="mt-2.5 flex justify-end gap-2">
            <button type="button" onClick={() => setStage("closed")} className="btn">
              Cancel
            </button>
            <button type="button" autoFocus onClick={() => run(current)} className="btn btn-primary">
              Revert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={copied ? "Copied" : label}
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        })
      }
      className="btn btn-icon"
    >
      <Icon name={copied ? "check" : "copy"} />
    </button>
  );
}

function MessageActions({ turn, busy, latest, resumable }: { turn: Turn; busy: boolean; latest: boolean; resumable: boolean }) {
  const idle = latest && !busy;
  return (
    <div
      role="toolbar"
      aria-label="Message actions"
      className={cx(
        "mt-1 flex h-6 items-center justify-end gap-0.5 transition-opacity group-hover/actions:opacity-100 focus-within:opacity-100 has-[.popover]:opacity-100",
        latest ? "opacity-60" : "opacity-0",
      )}
    >
      <CopyButton text={turn.prompt} label="Copy message" />
      {idle && (
        <button type="button" aria-label="Edit message" title="Edit: rewind the chat and put this message back in the input" onClick={() => post({ type: "restore", turnId: turn.id, scope: "conversation" })} className="btn btn-icon">
          <Icon name="edit" />
        </button>
      )}
      {idle && !resumable && (
        <button type="button" aria-label="Retry" title="Run this message again" onClick={() => post({ type: "retry", turnId: turn.id })} className="btn btn-icon">
          <Icon name="retry" />
        </button>
      )}
      <RevertMenu turnId={turn.id} busy={busy} />
    </div>
  );
}

function Prompt({ turn, busy, latest, resumable }: { turn: Turn; busy: boolean; latest: boolean; resumable: boolean }) {
  const label = turn.reverted ? "Reverted: no longer part of the agent's history" : turn.followUp ? "Follow-up from Anvil" : undefined;
  const choosing = !turn.followUp && turn.status === "running" && turn.steps.length === 0;
  return (
    <div className="group/actions">
      <div className="overflow-hidden rounded-lg border border-border bg-input/60 shadow-sm">
        <div className="px-3 py-2">
          {label && (
            <p className="mb-0.5 flex items-center gap-1 text-xs text-muted">
              {turn.reverted && <Icon name="history" />}
              {label}
            </p>
          )}
          <p className="text-base whitespace-pre-wrap text-fg">{turn.prompt}</p>
          {!turn.context && turn.mentions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {turn.mentions.map((mention) => (
                <span key={mention} className="rounded-sm bg-badge/40 px-1.5 font-mono text-xs text-fg">
                  @{mention}
                </span>
              ))}
            </div>
          )}
        </div>
        {(turn.context || choosing) && <ContextFooter report={turn.context} />}
      </div>
      {!turn.reverted && <MessageActions turn={turn} busy={busy} latest={latest} resumable={resumable} />}
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
    <section className="rounded-lg border border-border bg-editor/40 px-3 py-2" aria-label="Agent plan">
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
      {state && <span className="rounded-md bg-secondary px-1.5 text-secondary-fg">{state}</span>}
    </div>
  );
}

function Resume({ turnId }: { turnId: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={() => post({ type: "continue" })} className="btn btn-secondary" title="Pick up where the agent stopped">
        <Icon name="play" />
        Continue
      </button>
      <button type="button" onClick={() => post({ type: "retry", turnId })} className="btn" title="Run this message again">
        <Icon name="retry" />
        Retry
      </button>
    </span>
  );
}

function answerText(turn: Turn): string {
  return turn.steps.flatMap((step) => (step.kind === "text" ? [step.text] : [])).join("\n\n");
}

function Footer({ turn, resumable, latest }: { turn: Turn; resumable: boolean; latest: boolean }) {
  const answer = answerText(turn);
  const { input, output, cached } = turn.usage;
  const parts = [
    shortModel(turn.model),
    turn.endedAt ? formatDuration(turn.endedAt - turn.startedAt) : undefined,
    `${turn.steps.filter((step) => step.kind === "tool").length} tools`,
    `${formatTokens(input)} in · ${formatTokens(output)} out${cached ? ` · ${formatTokens(cached)} cached` : ""}`,
    turn.usage.costUsd !== undefined ? `≈${formatUsd(turn.usage.costUsd)}` : undefined,
  ].filter(Boolean);

  return (
    <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {turn.status === "cancelled" && (
        <span className="flex h-5 shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 text-secondary-fg">
          <Icon name="stop" />
          Cancelled
        </span>
      )}
      {turn.finish && (
        <span
          title={`${turn.finish.summary}\n${turn.finish.verification}`}
          className={cx(
            "flex min-w-0 items-center gap-1",
            turn.finish.verified ? "text-green" : "text-yellow",
          )}
        >
          <Icon name={turn.finish.verified ? "check-circle" : "warning"} />
          <span className="truncate">{turn.finish.verified ? `Verified: ${turn.finish.command ?? turn.finish.verification}` : `Not verified: ${turn.finish.verification}`}</span>
        </span>
      )}
      {turn.status === "superseded" && (
        <span className="flex h-5 shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 text-secondary-fg" title="Stopped so your new message could be sent">
          <Icon name="arrow-right" />
          Superseded by your message
        </span>
      )}
      {turn.status === "error" && (
        <span className="flex h-5 shrink-0 items-center gap-1 rounded-md bg-red/14 px-1.5 text-red">
          <Icon name="error" />
          Failed
        </span>
      )}
      {resumable && <Resume turnId={turn.id} />}
      <span className="min-w-0 truncate" title={turn.model}>{parts.join(" · ")}</span>
      {answer && (
        <span className={cx("ml-auto transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100", latest ? "opacity-60" : "opacity-0")}>
          <CopyButton text={answer} label="Copy answer" />
        </span>
      )}
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
    <article className={cx("group/turn relative flex flex-col pt-5 pr-3 pb-4 pl-8", !live && "turn-finished", turn.reverted && "opacity-50")}>
      <span aria-hidden="true" className="absolute top-0 bottom-0 left-[18.5px] w-px bg-border" />
      <Icon name="notch" className={cx("absolute top-[33px] left-3", turn.reverted ? "text-muted" : "text-orange")} />
      <Prompt turn={turn} busy={busy} latest={latest} resumable={resumable} />
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
      {!live && <Footer turn={turn} resumable={resumable} latest={latest} />}
      {!live && changeSet && changeSet.files.length > 0 && <TurnChanges changeSet={changeSet} />}
    </article>
  );
});
