import type { ContextLive, Turn } from "./protocol.ts";

export interface SessionTotals {
  turns: number;
  input: number;
  output: number;
  cached: number;
  costUsd?: number;
  costPartial: boolean;
  cacheHit?: number;
  context?: ContextLive;
  compactions: number;
}

export function sessionTotals(turns: Turn[]): SessionTotals {
  const counted = turns.filter((turn) => !turn.reverted);
  let input = 0;
  let output = 0;
  let cached = 0;
  let cost = 0;
  let priced = 0;
  let unpriced = 0;
  let compactions = 0;
  for (const turn of counted) {
    input += turn.usage.input + (turn.liveUsage?.input ?? 0);
    output += turn.usage.output + (turn.liveUsage?.output ?? 0);
    cached += turn.usage.cached + (turn.liveUsage?.cached ?? 0);
    if (turn.usage.costUsd !== undefined) {
      cost += turn.usage.costUsd;
      priced += 1;
    } else if (turn.status !== "running" && turn.status !== "paused" && turn.usage.input > 0) {
      unpriced += 1;
    }
    compactions += turn.context?.live?.compactions ?? 0;
  }
  const latest = [...counted].reverse().find((turn) => turn.context?.live);
  return {
    turns: counted.filter((turn) => !turn.followUp).length,
    input,
    output,
    cached,
    costUsd: priced ? cost : undefined,
    costPartial: priced > 0 && unpriced > 0,
    cacheHit: input > 0 && cached > 0 ? Math.min(1, cached / input) : undefined,
    context: latest?.context?.live,
    compactions,
  };
}

export interface RunStats {
  elapsedMs: number;
  toolCalls: number;
  current: string;
  tokensPerSecond?: number;
}

export function runStats(turn: Turn, now: number): RunStats {
  const tools = turn.steps.filter((step) => step.kind === "tool");
  const pending = turn.steps.some((step) => step.kind === "approval" && step.status === "pending") || tools.some((step) => step.status === "awaiting-approval");
  const running = [...tools].reverse().find((step) => step.status === "running");
  const elapsedMs = Math.max(0, now - turn.startedAt);
  const output = turn.liveUsage?.output ?? 0;
  return {
    elapsedMs,
    toolCalls: tools.length,
    current: pending ? "Waiting for your review" : running ? [running.title, running.detail].filter(Boolean).join(" · ") : "Thinking",
    tokensPerSecond: output > 0 && elapsedMs > 1000 ? output / (elapsedMs / 1000) : undefined,
  };
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return "<$0.01";
  return `$${value < 10 ? value.toFixed(2) : value.toFixed(1)}`;
}
