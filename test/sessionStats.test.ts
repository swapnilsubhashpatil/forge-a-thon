import { test } from "node:test";
import assert from "node:assert/strict";
import { formatUsd, runStats, sessionTotals } from "../src/shared/sessionStats.ts";
import type { Turn } from "../src/shared/protocol.ts";

const turn = (patch: Partial<Turn>): Turn => ({
  id: Math.random().toString(36),
  prompt: "p",
  mentions: [],
  steps: [],
  status: "done",
  model: "anthropic/claude-sonnet-5-5",
  usage: { input: 0, output: 0, cached: 0 },
  startedAt: 0,
  ...patch,
});

test("session totals add finished usage and the running turn's live count, skipping reverted turns", () => {
  const totals = sessionTotals([
    turn({ usage: { input: 1000, output: 100, cached: 800, costUsd: 0.05 } }),
    turn({ status: "running", usage: { input: 0, output: 0, cached: 0 }, liveUsage: { input: 500, output: 50, cached: 400, calls: 2 } }),
    turn({ reverted: true, usage: { input: 9999, output: 9, cached: 0, costUsd: 9 } }),
    turn({ followUp: true, usage: { input: 100, output: 10, cached: 0, costUsd: 0.01 } }),
  ]);
  assert.equal(totals.input, 1600);
  assert.equal(totals.output, 160);
  assert.equal(totals.turns, 2);
  assert.ok(Math.abs((totals.costUsd ?? 0) - 0.06) < 1e-9);
  assert.equal(totals.costPartial, false);
  assert.equal(totals.cacheHit, 1200 / 1600);
});

test("cost is undefined for unpriced models and marked partial when mixed", () => {
  assert.equal(sessionTotals([turn({ usage: { input: 10, output: 1, cached: 0 } })]).costUsd, undefined);
  const mixed = sessionTotals([turn({ usage: { input: 10, output: 1, cached: 0, costUsd: 0.02 } }), turn({ usage: { input: 10, output: 1, cached: 0 } })]);
  assert.equal(mixed.costPartial, true);
});

test("run stats report elapsed time, tool calls, the current step and output speed", () => {
  const running = turn({
    status: "running",
    startedAt: 1000,
    liveUsage: { input: 0, output: 600, cached: 0, calls: 1 },
    steps: [
      { kind: "tool", id: "1", name: "read_file", title: "Read cli.py", status: "done" },
      { kind: "tool", id: "2", name: "run_command", title: "Run command", detail: "pytest", status: "running" },
    ],
  });
  const stats = runStats(running, 13_000);
  assert.equal(stats.elapsedMs, 12_000);
  assert.equal(stats.toolCalls, 2);
  assert.equal(stats.current, "Run command · pytest");
  assert.equal(stats.tokensPerSecond, 50);
  assert.equal(formatUsd(0.004), "<$0.01");
  assert.equal(formatUsd(0.214), "$0.21");
});
