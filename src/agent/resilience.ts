export type FailureKind = "auth" | "not-found" | "rate-limit" | "unavailable" | "timeout" | "context" | "unknown";

export interface Failure {
  kind: FailureKind;
  message: string;
  retrySameModel: boolean;
}

const PATTERNS: Array<{ kind: FailureKind; pattern: RegExp }> = [
  { kind: "auth", pattern: /\b(401|403)\b|unauthori[sz]ed|forbidden|invalid[ _-]?(api[ _-]?)?key|incorrect api key|authentication|permission denied/i },
  { kind: "not-found", pattern: /\b404\b|model[^.]*not (found|exist)|no such model|unknown model|not configured|does not exist/i },
  { kind: "rate-limit", pattern: /\b429\b|rate.?limit|quota|too many requests|resource.?exhausted|payment required|\b402\b/i },
  { kind: "context", pattern: /context.?length|maximum context|too many tokens|prompt is too long/i },
  { kind: "timeout", pattern: /timed? ?out|timeout|deadline exceeded|ETIMEDOUT|no model output/i },
  { kind: "unavailable", pattern: /\b(5\d\d)\b|ECONNREFUSED|ECONNRESET|ENOTFOUND|fetch failed|socket hang up|overloaded|unavailable|bad gateway|network/i },
];

export function classifyFailure(message: string): Failure {
  const match = PATTERNS.find((entry) => entry.pattern.test(message));
  const kind = match?.kind ?? "unknown";
  return { kind, message: summarize(message), retrySameModel: kind === "rate-limit" || kind === "unavailable" };
}

export function describeFailure(failure: Failure): string {
  const labels: Record<FailureKind, string> = {
    auth: "authentication failed",
    "not-found": "model not available",
    "rate-limit": "rate limited",
    unavailable: "provider unavailable",
    timeout: "no response in time",
    context: "context window exceeded",
    unknown: "request failed",
  };
  return labels[failure.kind];
}

export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(4_000, 500 * 2 ** attempt);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export class CircuitBreaker {
  private readonly openUntil = new Map<string, number>();
  private readonly lastErrors = new Map<string, string>();
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(cooldownMs = 60_000, now: () => number = Date.now) {
    this.cooldownMs = cooldownMs;
    this.now = now;
  }

  trip(model: string, reason: string): void {
    this.openUntil.set(model, this.now() + this.cooldownMs);
    this.lastErrors.set(model, reason);
  }

  reset(model: string): void {
    this.openUntil.delete(model);
  }

  isOpen(model: string): boolean {
    return (this.openUntil.get(model) ?? 0) > this.now();
  }

  coolingUntil(model: string): number | undefined {
    const until = this.openUntil.get(model);
    return until && until > this.now() ? until : undefined;
  }

  lastError(model: string): string | undefined {
    return this.lastErrors.get(model);
  }

  order(chain: string[]): string[] {
    const healthy = chain.filter((model) => !this.isOpen(model));
    const cooling = chain.filter((model) => this.isOpen(model));
    return [...healthy, ...cooling];
  }
}

function summarize(message: string): string {
  const firstLine = message.split(/\r?\n/).find((line) => line.trim()) ?? message;
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
}
