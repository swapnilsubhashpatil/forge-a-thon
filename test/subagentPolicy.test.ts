import { test } from "node:test";
import assert from "node:assert/strict";
import { subagentDenial } from "../src/agent/subagentPolicy.ts";

test("subagents cannot edit or create files", () => {
  assert.match(subagentDenial("propose_edit", { path: "a.py" }) ?? "", /read-only/);
  assert.match(subagentDenial("create_file", { path: "b.py" }) ?? "", /read-only/);
});

test("read-only inspection commands are allowed, everything else is denied", () => {
  for (const command of ["git log --oneline -5", "git diff HEAD~1", "rg routes_command", "ls src", "dir src"]) {
    assert.equal(subagentDenial("run_command", { command }), undefined, command);
  }
  for (const command of ["python -m pytest", "rm -rf src", "git commit -am x", "rg x > out.txt", "ls; rm a", "git log | sh"]) {
    assert.ok(subagentDenial("run_command", { command }), command);
  }
});

test("read tools pass through", () => {
  assert.equal(subagentDenial("read_file", { path: "a.py" }), undefined);
  assert.equal(subagentDenial("search_code", { query: "x" }), undefined);
});
