import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReplacement } from "../src/edits/editMatcher.ts";
import { computeHunks, diffStat, renderReview, resolveText } from "../src/edits/hunks.ts";

const source = ["def add(a, b):", "    total = a + b", "    return total", "", "def sub(a, b):", "    return a - b", ""].join("\n");

function applied(result: ReturnType<typeof applyReplacement>) {
  assert.ok(result.ok, result.ok ? "" : `${result.reason}\n${result.hint}`);
  return result;
}

test("exact match replaces the unique occurrence", () => {
  const result = applied(applyReplacement(source, "return a - b", "return b - a"));
  assert.equal(result.matchKind, "exact");
  assert.ok(result.text.includes("    return b - a\n"));
});

test("trailing whitespace falls back to the whitespace stage", () => {
  const result = applied(applyReplacement(source, "    total = a + b  \n    return total\t", "    return a + b"));
  assert.equal(result.matchKind, "whitespace");
  assert.ok(result.text.startsWith("def add(a, b):\n    return a + b\n\ndef sub"));
});

test("wrong indentation is matched and new_string is re-indented", () => {
  const result = applied(applyReplacement(source, "total = a + b\nreturn total", "if a:\n    return a\nreturn a + b"));
  assert.equal(result.matchKind, "indentation");
  assert.ok(result.text.includes("    if a:\n        return a\n    return a + b\n"));
});

test("a one-character typo is matched fuzzily", () => {
  const result = applied(applyReplacement(source, "def add(a, b):\n    totl = a + b\n    return total\ndef sub(a, b):", "def add(a, b):\n    return a + b\n\ndef sub(a, b):"));
  assert.equal(result.matchKind, "fuzzy");
  assert.ok(result.text.startsWith("def add(a, b):\n    return a + b\n\ndef sub(a, b):\n    return a - b"));
});

test("ambiguous old_string fails with a hint, replaceAll succeeds", () => {
  const twice = "x = 1\ny = 2\nx = 1\n";
  const result = applyReplacement(twice, "x = 1", "x = 3");
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason.includes("2 places") && result.hint.includes("1 | x = 1"));
  const all = applied(applyReplacement(twice, "x = 1", "x = 3", true));
  assert.equal(all.text, "x = 3\ny = 2\nx = 3\n");
  assert.equal(all.occurrences, 2);
});

test("unrelated old_string fails instead of matching", () => {
  assert.equal(applyReplacement(source, "class Config:\n    debug = True", "x").ok, false);
});

test("CRLF files keep CRLF line endings", () => {
  const crlf = source.replace(/\n/g, "\r\n");
  const result = applied(applyReplacement(crlf, "total = a + b\n    return total", "return a + b"));
  assert.equal(result.text, ["def add(a, b):", "    return a + b", "", "def sub(a, b):", "    return a - b", ""].join("\r\n"));
});

test("empty old_string on an empty file writes the whole file", () => {
  assert.equal(applied(applyReplacement("", "", "hello\n")).text, "hello\n");
  assert.equal(applyReplacement("x", "", "y").ok, false);
});

const baseline = "a\nb\nc\nd\ne\n";
const proposal = "a\nB\nc\nd\nE\nf\n";

test("hunks are minimal and render per decision", () => {
  const hunks = computeHunks(baseline, proposal);
  assert.deepEqual(hunks.map((h) => [h.baselineStart, h.removed, h.added]), [[1, 1, 1], [4, 1, 2]]);
  const pending = renderReview(baseline, hunks, ["pending", "pending"]);
  assert.equal(pending.text, "a\nb\nB\nc\nd\ne\nE\nf\n");
  assert.deepEqual(pending.removedLines, [1, 5]);
  assert.deepEqual(pending.addedLines, [2, 6, 7]);
  assert.deepEqual(pending.hunkAnchors, [{ index: 0, line: 1 }, { index: 1, line: 5 }]);
  const mixed = renderReview(baseline, hunks, ["accepted", "rejected"]);
  assert.equal(mixed.text, "a\nB\nc\nd\ne\n");
  assert.deepEqual([mixed.removedLines, mixed.addedLines], [[], []]);
});

test("resolveText applies only accepted hunks", () => {
  const hunks = computeHunks(baseline, proposal);
  assert.equal(resolveText(baseline, hunks, ["accepted", "accepted"]), proposal);
  assert.equal(resolveText(baseline, hunks, ["rejected", "rejected"]), baseline);
  assert.equal(resolveText(baseline, hunks, ["rejected", "accepted"]), "a\nb\nc\nd\nE\nf\n");
  assert.deepEqual(diffStat(baseline, proposal), { added: 3, removed: 2 });
});

test("trailing newline and CRLF round-trip", () => {
  const before = "one\r\ntwo";
  const after = "one\r\ntwo\r\nthree\r\n";
  const hunks = computeHunks(before, after);
  assert.equal(resolveText(before, hunks, hunks.map(() => "accepted")), after);
  assert.equal(resolveText(before, hunks, hunks.map(() => "rejected")), before);
  assert.equal(renderReview(before, hunks, ["pending"]).text, "one\r\ntwo\r\ntwo\r\nthree\r\n");
  assert.equal(renderReview(before, hunks, ["rejected"]).text, before);
});
