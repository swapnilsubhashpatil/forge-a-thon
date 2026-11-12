import type { PlanItem, PlanStatus } from "../shared/protocol.ts";

/**
 * M6: a plan checklist (Codex update_plan / Gemini write_todos). Strong models track their own work, so Claude Code
 * and Amp dropped todo tools for them; the tool is aimed at weak and local models, where re-sending the plan with
 * each result keeps the task on track and survives compaction (Roo's per-turn reminder).
 */
const STATUSES: PlanStatus[] = ["pending", "in_progress", "completed", "blocked", "cancelled"];

export type PlanUpdate = { ok: true; plan: PlanItem[] } | { ok: false; error: string };

export function validatePlan(raw: unknown): PlanUpdate {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Invalid plan: pass a non-empty list of {step, status}." };
  const plan: PlanItem[] = [];
  for (const entry of raw) {
    const step = typeof entry?.step === "string" ? entry.step.trim() : "";
    const status = entry?.status as PlanStatus;
    if (!step) return { ok: false, error: "Invalid plan: every item needs a non-empty step." };
    if (!STATUSES.includes(status)) return { ok: false, error: `Invalid plan: status must be one of ${STATUSES.join(", ")}.` };
    plan.push({ step, status });
  }
  if (plan.filter((item) => item.status === "in_progress").length > 1) {
    return { ok: false, error: 'Invalid plan: only one step can be "in_progress" at a time.' };
  }
  return { ok: true, plan };
}

export function openItems(plan: PlanItem[] | undefined): PlanItem[] {
  return (plan ?? []).filter((item) => item.status === "pending" || item.status === "in_progress");
}

const MARKS: Record<PlanStatus, string> = { pending: "[ ]", in_progress: "[>]", completed: "[x]", blocked: "[!]", cancelled: "[-]" };

/** Compact reminder appended to tool results while a plan has open steps. */
export function planReminder(plan: PlanItem[] | undefined): string | undefined {
  if (!plan?.length || !openItems(plan).length) return undefined;
  const nl = String.fromCharCode(10);
  return `${nl}${nl}<plan>${nl}${plan.map((item) => `${MARKS[item.status]} ${item.step}`).join(nl)}${nl}</plan> Update it with update_plan when a step changes status.`;
}
