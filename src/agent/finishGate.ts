import type { FinishReport, PlanItem } from "../shared/protocol.ts";
import { openItems } from "./plan.ts";

export interface CommandRecord {
  command: string;
  exitCode: string;
  at: number;
}

export interface WorkLog {
  lastEditAt?: number;
  lastCommand?: CommandRecord;
}

export interface FinishArgs {
  summary: string;
  files_changed?: string[];
  verification?: string;
  verified: boolean;
}

export type FinishDecision = { ok: true; report: FinishReport; reply: string } | { ok: false; reply: string };

export function evaluateFinish(args: FinishArgs, log: WorkLog, plan?: PlanItem[]): FinishDecision {
  const summary = args.summary.trim();
  if (!summary) return { ok: false, reply: "finish_task needs a summary of what you changed." };
  const open = openItems(plan);
  if (open.length) {
    return { ok: false, reply: `Not accepted: plan steps are still open (${open.map((item) => item.step).join("; ")}). Finish them, or mark them blocked or cancelled with update_plan, then call finish_task again.` };
  }
  const command = log.lastCommand;
  const ranAfterEdit = command !== undefined && (log.lastEditAt === undefined || command.at > log.lastEditAt);

  if (args.verified) {
    if (!ranAfterEdit) {
      const missing = command ? `the last command (${command.command}) ran before your last accepted edit` : "no command has run";
      return {
        ok: false,
        reply: `Not accepted: verified=true needs a test or check run after your last accepted edit, but ${missing}. Run it with run_command, then call finish_task again. If you cannot run it, call finish_task with verified=false and say why.`,
      };
    }
    if (command.exitCode !== "0") {
      return {
        ok: false,
        reply: `Not accepted: the last command (${command.command}) exited with ${command.exitCode}. Fix the failure and run it again, or call finish_task with verified=false and explain the failure.`,
      };
    }
  } else if (!args.verification?.trim()) {
    return { ok: false, reply: "Not accepted: with verified=false, say in verification why the change could not be checked." };
  }

  const report: FinishReport = {
    summary,
    filesChanged: args.files_changed ?? [],
    verified: args.verified,
    verification: args.verification?.trim() || (command ? command.command : ""),
    command: args.verified ? command?.command : undefined,
  };
  return { ok: true, report, reply: args.verified ? "Recorded: finished and verified." : "Recorded: finished, not verified." };
}

export type FollowUpKind = "verify" | "retry-edits";

export function needsFinishFollowUp(turn: { status: string; finish?: FinishReport; editedFiles: number; failedEdits?: number }): FollowUpKind | undefined {
  if (turn.status !== "done" || turn.finish !== undefined) return undefined;
  if (turn.editedFiles > 0) return "verify";
  if ((turn.failedEdits ?? 0) > 0) return "retry-edits";
  return undefined;
}

export const RETRY_EDITS_FOLLOW_UP =
  "Your edits were not applied: the tool results say why (usually old_string did not match the file). Read the current " +
  "text with read_file, then propose the edit again with old_string copied exactly. If you cannot make the change, call " +
  "finish_task with verified=false and explain what blocked you.";

export const WRAP_UP =
  "You reached the step limit. Do not call any tool except finish_task. Call finish_task now: summarise what is done, " +
  "list what remains and the next step, and set verified=true only if a check ran after your last accepted edit and passed.";

export const FINISH_FOLLOW_UP =
  "You changed files but did not call finish_task. If you have not run the relevant tests since your last accepted edit, " +
  "run them now with run_command and fix failures you caused. Then call finish_task: verified=true only if a command after " +
  "your last edit passed; otherwise verified=false with the reason.";
