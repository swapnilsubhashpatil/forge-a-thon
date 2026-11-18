import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHunks } from "../src/edits/hunks.ts";
import { describeFlags, flagHunks, hunkSpan, mergeRanges } from "../src/edits/scopeFence.ts";

const file = Array.from({ length: 40 }, (_, i) => `line ${i + 1}\n`).join("");
const change = (text: string, edits: Record<number, string>) =>
  text.split("\n").map((line, i) => edits[i + 1] ?? line).join("\n");

test("hunks inside the selection are not flagged, hunks outside are", () => {
  const proposal = change(file, { 12: "changed 12", 30: "changed 30" });
  const hunks = computeHunks(file, proposal);
  assert.deepEqual(hunks.map(hunkSpan), [{ start: 12, end: 12 }, { start: 30, end: 30 }]);
  const flags = flagHunks(hunks, { ranges: [{ start: 10, end: 20 }], label: "outside selection", slack: 2 });
  assert.deepEqual(flags, [undefined, "outside selection"]);
  assert.match(describeFlags(hunks, flags) ?? "", /change 2 \(line 30\): outside selection/);
});

test("slack covers a docstring line just outside the selection, but not beyond", () => {
  const hunks = computeHunks(file, change(file, { 9: "docstring" }));
  assert.deepEqual(flagHunks(hunks, { ranges: [{ start: 10, end: 20 }], label: "x", slack: 1 }), [undefined]);
  const far = computeHunks(file, change(file, { 6: "far" }));
  assert.deepEqual(flagHunks(far, { ranges: [{ start: 10, end: 20 }], label: "x", slack: 1 }), ["x"]);
});

test("an insertion right after the range end counts as inside", () => {
  const proposal = file.replace("line 20\n", "line 20\nnew line\n");
  const hunks = computeHunks(file, proposal);
  assert.deepEqual(flagHunks(hunks, { ranges: [{ start: 10, end: 20 }], label: "x" }), [undefined]);
});

test("a file the agent never read flags every hunk; no fence flags nothing", () => {
  const hunks = computeHunks(file, change(file, { 3: "a", 25: "b" }));
  assert.deepEqual(flagHunks(hunks, { ranges: [], label: "edited without reading" }), ["edited without reading", "edited without reading"]);
  assert.deepEqual(flagHunks(hunks, undefined), [undefined, undefined]);
  assert.equal(describeFlags(hunks, [undefined, undefined]), undefined);
});

test("ranges merge when they overlap or touch", () => {
  assert.deepEqual(mergeRanges([{ start: 30, end: 40 }, { start: 1, end: 10 }, { start: 11, end: 15 }, { start: 14, end: 20 }]), [
    { start: 1, end: 20 },
    { start: 30, end: 40 },
  ]);
});

test("a one-line change just past the slack is flagged; a pure insertion right after the range is not", () => {
  const changed = computeHunks(file, change(file, { 23: "changed 23" }));
  assert.deepEqual(flagHunks(changed, { ranges: [{ start: 10, end: 20 }], label: "x", slack: 2 }), ["x"]);
  const inserted = computeHunks(file, file.replace("line 22\n", "line 22\nnew\n"));
  assert.deepEqual(flagHunks(inserted, { ranges: [{ start: 10, end: 20 }], label: "x", slack: 2 }), [undefined]);
});
