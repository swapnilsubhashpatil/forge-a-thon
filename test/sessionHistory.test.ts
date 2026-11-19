import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationTitle, SessionHistory, type Conversation } from "../src/agent/sessionHistory.ts";

function memory() {
  const values = new Map<string, unknown>();
  return {
    get: <T>(key: string) => values.get(key) as T | undefined,
    update: async (key: string, value: unknown) => void values.set(key, value),
  };
}

const conversation = (id: string, updatedAt: number): Conversation => ({ id, title: id, updatedAt, turns: [], edits: 0 });

test("summaries are ordered by last update, newest first", async () => {
  const history = new SessionHistory(memory());
  await history.save(conversation("a", 1));
  await history.save(conversation("b", 3));
  await history.save(conversation("c", 2));
  assert.deepEqual(history.summaries().map((entry) => entry.id), ["b", "c", "a"]);
  await history.save(conversation("a", 4));
  assert.deepEqual(history.summaries().map((entry) => entry.id), ["a", "b", "c"]);
});

test("history keeps the 30 most recent conversations", async () => {
  const history = new SessionHistory(memory());
  for (let i = 0; i < 35; i += 1) await history.save(conversation(`c${i}`, i));
  const ids = history.summaries().map((entry) => entry.id);
  assert.equal(ids.length, 30);
  assert.equal(ids[0], "c34");
  assert.equal(history.get("c4"), undefined);
  assert.ok(history.get("c5"));
});

test("delete removes only that conversation", async () => {
  const history = new SessionHistory(memory());
  await history.save(conversation("a", 1));
  await history.save(conversation("b", 2));
  await history.delete("a");
  assert.deepEqual(history.summaries().map((entry) => entry.id), ["b"]);
});

test("titles are the first prompt on one line, trimmed to 60 characters", () => {
  assert.equal(conversationTitle("  fix\nthe   bug "), "fix the bug");
  const long = conversationTitle("x".repeat(80));
  assert.equal(long.length, 60);
  assert.ok(long.endsWith("…"));
});
