import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { Step, Turn } from "../src/shared/protocol.ts";

const stub = new URL("./stubs/vscode.ts", import.meta.url).href;
registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: stub, shortCircuit: true } : next(specifier, context)),
});
const { inlineOutcome } = await import("../src/ui/inlineEdit.ts");

const turn = (steps: Step[]): Turn => ({
  id: "t1",
  prompt: "fix",
  mentions: [],
  steps,
  status: "done",
  model: "anthropic/claude-sonnet-5-5",
  usage: { input: 0, output: 0, cached: 0 },
  startedAt: 0,
});

const edit: Step = { kind: "tool", id: "e", name: "propose_edit", title: "Edit", status: "done", diff: { added: 5, removed: 1 } };

test("an inline edit that failed over says which model took over", () => {
  const outcome = inlineOutcome(
    turn([
      { kind: "notice", id: "n", tone: "warning", text: "switched", failover: { from: "broken/unreachable", to: "anthropic/claude-sonnet-5-5", reason: "bad port" } },
      edit,
    ]),
  );
  assert.equal(outcome.status, "Applied +5 −1");
  assert.match(outcome.note, /^broken\/unreachable failed \(bad port\)\. anthropic\/claude-sonnet-5-5 took over\./);
});

test("an inline edit without failover has no failover line", () => {
  assert.doesNotMatch(inlineOutcome(turn([edit])).note, /took over/);
});
