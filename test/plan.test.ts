import { test } from "node:test";
import assert from "node:assert/strict";
import { openItems, planReminder, validatePlan } from "../src/agent/plan.ts";
import { evaluateFinish } from "../src/agent/finishGate.ts";

test("plans need steps and known statuses, and at most one in progress", () => {
  assert.equal(validatePlan([]).ok, false);
  assert.equal(validatePlan([{ step: "x", status: "doing" }]).ok, false);
  const two = validatePlan([{ step: "a", status: "in_progress" }, { step: "b", status: "in_progress" }]);
  assert.equal(two.ok, false);
  if (!two.ok) assert.match(two.error, /only one step/);
  const good = validatePlan([{ step: " Add command ", status: "completed" }, { step: "Add test", status: "in_progress" }]);
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.plan[0].step, "Add command");
});

test("the reminder lists the plan while steps are open and disappears when done", () => {
  const plan = [{ step: "Add command", status: "completed" as const }, { step: "Add test", status: "in_progress" as const }];
  assert.match(planReminder(plan) ?? "", /\[x\] Add command[\s\S]*\[>\] Add test/);
  assert.equal(planReminder([{ step: "a", status: "completed" }]), undefined);
  assert.equal(openItems([{ step: "a", status: "blocked" }]).length, 0);
});

test("finish_task is refused while plan steps are open", () => {
  const verdict = evaluateFinish({ summary: "s", verified: false, verification: "no tests" }, {}, [{ step: "Write docs", status: "pending" }]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reply, /Write docs/);
  assert.equal(evaluateFinish({ summary: "s", verified: false, verification: "no tests" }, {}, [{ step: "Write docs", status: "cancelled" }]).ok, true);
});
