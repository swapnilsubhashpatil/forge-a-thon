import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as Code from "vscode";
import type { ChangeSetSummary } from "../src/shared/protocol.ts";

const stub = new URL("./stubs/vscode.ts", import.meta.url).href;
registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: stub, shortCircuit: true } : next(specifier, context)),
});
const vscode = await import("./stubs/vscode.ts");
const { ChangeLedger } = await import("../src/edits/changeLedger.ts");

const uri = (name: string) => vscode.Uri.file(`/ws/${name}`) as unknown as Code.Uri;
const write = (name: string, text: string) => vscode.files.set(`/ws/${name}`, text);
const read = (name: string) => vscode.files.get(`/ws/${name}`);

function ledger(file?: string) {
  const state: { sets: ChangeSetSummary[] } = { sets: [] };
  return { ledger: new ChangeLedger((sets) => (state.sets = sets), file), state };
}

test("partial undo keeps the set listed until every file is undone", async () => {
  vscode.files.clear();
  const { ledger: l, state } = ledger();
  const id = l.begin("turn");
  write("a.py", "a2");
  write("b.py", "b2");
  l.record(id, uri("a.py"), "a1", "a2");
  l.record(id, uri("b.py"), "b1", "b2");
  write("b.py", "b3");

  const first = await l.undo(id);
  assert.deepEqual(first, { restored: ["a.py"], skipped: ["b.py"] });
  assert.equal(read("a.py"), "a1");
  assert.equal(state.sets[0].undone, false);
  assert.deepEqual(state.sets[0].files.map((file) => [file.path, file.undone === true]), [["a.py", true], ["b.py", false]]);

  write("b.py", "b2");
  const second = await l.undo(id);
  assert.deepEqual(second, { restored: ["b.py"], skipped: [] });
  assert.equal(read("a.py"), "a1");
  assert.equal(state.sets[0].undone, true);
});

test("a file changed by hand after the agent edit is skipped, never overwritten", async () => {
  vscode.files.clear();
  const { ledger: l, state } = ledger();
  const id = l.begin("turn");
  write("a.py", "agent");
  l.record(id, uri("a.py"), "original", "agent");
  write("a.py", "user");
  assert.deepEqual(await l.undo(id), { restored: [], skipped: ["a.py"] });
  assert.equal(read("a.py"), "user");
  assert.equal(state.sets[0].undone, false);
});

test("a file already restored outside Anvil counts as undone", async () => {
  vscode.files.clear();
  const { ledger: l, state } = ledger();
  const id = l.begin("inline");
  write("a.py", "agent");
  l.record(id, uri("a.py"), "original", "agent");
  write("a.py", "original");
  assert.deepEqual(await l.undo(id), { restored: ["a.py"], skipped: [] });
  assert.equal(state.sets[0].undone, true);
});

test("sets touching the same file undo newest first", async () => {
  vscode.files.clear();
  const { ledger: l } = ledger();
  const older = l.begin("one");
  l.record(older, uri("a.py"), "v1", "v2");
  const newer = l.begin("two");
  l.record(newer, uri("a.py"), "v2", "v3");
  write("a.py", "v3");

  assert.deepEqual((await l.undo(older)).skipped, ["a.py"]);
  assert.deepEqual((await l.undo(newer)).restored, ["a.py"]);
  assert.deepEqual((await l.undo(older)).restored, ["a.py"]);
  assert.equal(read("a.py"), "v1");
});

test("undoing a created file deletes it", async () => {
  vscode.files.clear();
  const { ledger: l } = ledger();
  const id = l.begin("turn");
  write("new.py", "content");
  l.record(id, uri("new.py"), undefined, "content");
  await l.undo(id);
  assert.equal(read("new.py"), undefined);
});

test("the ledger survives a reload and can still undo", async () => {
  vscode.files.clear();
  const file = join(mkdtempSync(join(tmpdir(), "anvil-ledger-")), "nested", "ledger.json");
  const { ledger: first } = ledger(file);
  const id = first.begin("turn");
  write("a.py", "after");
  first.record(id, uri("a.py"), "before", "after");
  first.keep([id]);
  await first.saved();

  const { ledger: second, state } = ledger(file);
  await second.load();
  assert.equal(state.sets.length, 1);
  assert.equal(state.sets[0].kept, true);
  assert.deepEqual(state.sets[0].files.map((entry) => entry.path), ["a.py"]);
  assert.deepEqual((await second.undo(id)).restored, ["a.py"]);
  assert.equal(read("a.py"), "before");
});
