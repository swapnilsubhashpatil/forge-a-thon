import { test } from "node:test";
import assert from "node:assert/strict";
import { callSignature, deliverQueued, formatNotes, NOTE_INSTRUCTION, takeLeftovers } from "../src/agent/noteQueue.ts";
import type { QueuedNote } from "../src/shared/protocol.ts";

const note = (id: string, text: string, status: QueuedNote["status"] = "queued", mentions: string[] = []): QueuedNote => ({ id, text, mentions, status });

test("queued notes are delivered once, in order, with the step that carried them", () => {
  const queue = [note("a", "also mask CREDENTIAL"), note("b", "already sent", "delivered"), note("c", "add a changelog entry")];
  const delivered = deliverQueued(queue, 4, "turn-1");
  assert.deepEqual(delivered.map((entry) => entry.id), ["a", "c"]);
  assert.ok(queue.every((entry) => entry.status === "delivered"));
  assert.equal(queue[0].deliveredAtStep, 4);
  assert.deepEqual(deliverQueued(queue, 5, "turn-1"), []);
});

test("delivery text wraps each note and lets the model decide relevance", () => {
  const text = formatNotes([note("a", "also mask CREDENTIAL"), note("b", "fix the typo in README")]);
  assert.equal(text.match(/<user_note sent_mid_task>/g)?.length, 2);
  assert.ok(text.includes("also mask CREDENTIAL"));
  assert.ok(text.endsWith(NOTE_INSTRUCTION));
  assert.match(NOTE_INSTRUCTION, /adapt now/);
  assert.match(NOTE_INSTRUCTION, /finish the current task first/);
});

test("leftovers join undelivered notes into one prompt and leave delivered ones", () => {
  const queue = [note("a", "first", "queued", ["src/a.py"]), note("b", "seen", "delivered"), note("c", "second", "queued", ["src/a.py", "src/b.py"])];
  const leftovers = takeLeftovers(queue);
  assert.equal(leftovers?.text, "first\n\nsecond");
  assert.deepEqual(leftovers?.mentions, ["src/a.py", "src/b.py"]);
  assert.deepEqual(queue.map((entry) => entry.id), ["b"]);
  assert.equal(takeLeftovers(queue), undefined);
});

test("call signatures ignore key order and undefined fields", () => {
  assert.equal(callSignature("read_file", { path: "a.py", start_line: 1 }), callSignature("read_file", { start_line: 1, path: "a.py", fresh: undefined }));
  assert.notEqual(callSignature("read_file", { path: "a.py" }), callSignature("read_file", { path: "b.py" }));
});
