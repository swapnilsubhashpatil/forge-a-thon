import { createHash } from "node:crypto";
import { callSignature } from "./noteQueue.ts";

/**
 * M7: stuck-loop guard. A call counts as a repeat only when name, arguments AND result are identical, so a pytest
 * re-run after a fix (different output) is never flagged. Catches the same call repeated and short A→B→A→B cycles
 * (Gemini CLI checks periods up to 5; Cline warns at 3 and stops at 5). Counters reset on every accepted edit.
 */
export const NUDGE_AT = 3;
export const STOP_AT = 5;

export type LoopVerdict = { action: "ok" } | { action: "nudge"; message: string } | { action: "stop"; message: string };

export class LoopGuard {
  private history: string[] = [];

  reset(): void {
    this.history = [];
  }

  record(name: string, args: Record<string, unknown>, result: string): LoopVerdict {
    // Wall times differ run to run ("1.0s" vs "0.8s"); ignore them so an unchanged failing test still counts as a repeat.
    const stable = result.replace(/\b\d+(\.\d+)?\s?(ms|s)\b/g, "#t");
    const digest = createHash("sha1").update(stable).digest("hex").slice(0, 12);
    this.history.push(`${callSignature(name, args)}#${digest}`);
    if (this.history.length > 40) this.history.shift();
    const repeats = Math.max(...[1, 2, 3].map((period) => this.cycleRepeats(period)));
    if (repeats >= STOP_AT) {
      return { action: "stop", message: `Stopped: the agent repeated the same ${name} call ${repeats} times with identical results.` };
    }
    if (repeats >= NUDGE_AT) {
      return {
        action: "nudge",
        message:
          `Loop warning: you have made this exact call ${repeats} times with the same result. It will not change. ` +
          "Change your approach, use what you already have, or explain what is blocking you. Another repeat will stop the task.",
      };
    }
    return { action: "ok" };
  }

  /** How many times the last `period` calls have repeated back-to-back at the end of the history. */
  private cycleRepeats(period: number): number {
    const h = this.history;
    if (h.length < period) return 0;
    let count = 1;
    for (let end = h.length - period; end - period >= 0; end -= period) {
      const same = h.slice(end - period, end).every((entry, i) => entry === h[end + i]);
      if (!same) break;
      count += 1;
    }
    return period === 1 || count > 1 ? count : 0;
  }
}
