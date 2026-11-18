import { test } from "node:test";
import assert from "node:assert/strict";
import { LoopGuard } from "../src/agent/loopGuard.ts";

test("identical call and result: nudge at 3, stop at 5", () => {
  const guard = new LoopGuard();
  const verdicts = [1, 2, 3, 4, 5].map(() => guard.record("read_file", { path: "a.py" }, "same").action);
  assert.deepEqual(verdicts, ["ok", "ok", "nudge", "nudge", "stop"]);
});

test("same call with a different result is not a loop (pytest re-run after a fix)", () => {
  const guard = new LoopGuard();
  const results = ["1 failed", "1 failed", "56 passed", "56 passed"];
  const verdicts = results.map((out) => guard.record("run_command", { command: "pytest" }, out).action);
  assert.deepEqual(verdicts, ["ok", "ok", "ok", "ok"]);
});

test("A-B-A-B cycles are caught", () => {
  const guard = new LoopGuard();
  const verdicts: string[] = [];
  for (let i = 0; i < 5; i++) {
    verdicts.push(guard.record("search_code", { query: "x" }, "r1").action);
    verdicts.push(guard.record("read_file", { path: "a.py" }, "r2").action);
  }
  assert.ok(verdicts.includes("nudge"));
  assert.equal(verdicts.at(-1), "stop");
});

test("reset after an accepted edit clears the history; different args never loop", () => {
  const guard = new LoopGuard();
  guard.record("read_file", { path: "a.py" }, "same");
  guard.record("read_file", { path: "a.py" }, "same");
  guard.reset();
  assert.equal(guard.record("read_file", { path: "a.py" }, "same").action, "ok");
  const varied = new LoopGuard();
  for (let i = 0; i < 6; i++) assert.equal(varied.record("read_file", { path: `f${i}.py` }, "x").action, "ok");
});
