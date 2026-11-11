import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateFinish, needsFinishFollowUp } from "../src/agent/finishGate.ts";

const pytest = (at: number, exitCode = "0") => ({ command: "python -m pytest tests/test_cli.py -q", exitCode, at });

test("verified is accepted only when a passing command ran after the last edit", () => {
  const ok = evaluateFinish({ summary: "Added flask config", verified: true }, { lastEditAt: 10, lastCommand: pytest(20) });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.report.command, "python -m pytest tests/test_cli.py -q");

  const stale = evaluateFinish({ summary: "Added flask config", verified: true }, { lastEditAt: 30, lastCommand: pytest(20) });
  assert.equal(stale.ok, false);
  assert.match(stale.reply, /ran before your last accepted edit/);

  const never = evaluateFinish({ summary: "Added flask config", verified: true }, { lastEditAt: 30 });
  assert.equal(never.ok, false);
  assert.match(never.reply, /no command has run/);
});

test("a failing command cannot verify", () => {
  const failed = evaluateFinish({ summary: "Added flask config", verified: true }, { lastEditAt: 10, lastCommand: pytest(20, "1") });
  assert.equal(failed.ok, false);
  assert.match(failed.reply, /exited with 1/);
});

test("not verified is accepted with a reason, rejected without one", () => {
  const honest = evaluateFinish({ summary: "Docs only", verified: false, verification: "user declined the test run" }, { lastEditAt: 10 });
  assert.equal(honest.ok, true);
  if (honest.ok) assert.equal(honest.report.verified, false);
  assert.equal(evaluateFinish({ summary: "Docs only", verified: false }, { lastEditAt: 10 }).ok, false);
  assert.equal(evaluateFinish({ summary: " ", verified: false, verification: "x" }, {}).ok, false);
});

test("follow-up only for completed turns with edits and no finish", () => {
  const finish = { summary: "s", filesChanged: [], verified: false, verification: "v" };
  assert.equal(needsFinishFollowUp({ status: "done", editedFiles: 2 }), true);
  assert.equal(needsFinishFollowUp({ status: "done", editedFiles: 2, finish }), false);
  assert.equal(needsFinishFollowUp({ status: "done", editedFiles: 0 }), false);
  assert.equal(needsFinishFollowUp({ status: "cancelled", editedFiles: 2 }), false);
  assert.equal(needsFinishFollowUp({ status: "error", editedFiles: 2 }), false);
});
