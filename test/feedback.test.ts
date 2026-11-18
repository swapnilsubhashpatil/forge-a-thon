import { test } from "node:test";
import assert from "node:assert/strict";
import { currentRegion } from "../src/edits/feedback.ts";

const file = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";

test("region shows numbered current lines around each rejected change", () => {
  const proposal = file.replace("line 20\n", "rejected 20\n");
  const region = currentRegion(file, proposal) ?? "";
  const numbers = region.split("\n").map((line) => Number(line.trim().split(/\s+/)[0]));
  assert.deepEqual(numbers, [16, 17, 18, 19, 20, 21, 22, 23, 24]);
  assert.match(region, /   20  line 20/);
});

test("nearby changes merge, distant ones are separated", () => {
  const proposal = file.replace("line 10\n", "x\n").replace("line 13\n", "y\n").replace("line 40\n", "z\n");
  const region = currentRegion(file, proposal) ?? "";
  assert.equal(region.split("\n").filter((line) => line.trim() === "...").length, 1);
});

test("region is capped and handles CRLF and identical text", () => {
  const crlf = file.replace(/\n/g, "\r\n");
  const proposal = crlf.replace(/line (\d+)\r\n/g, (_, n) => (Number(n) % 3 === 0 ? `changed ${n}\r\n` : `line ${n}\r\n`));
  const region = currentRegion(crlf, proposal, 4, 10) ?? "";
  assert.ok(!region.includes("\r"));
  assert.match(region, /truncated/);
  assert.equal(currentRegion(file, file), undefined);
});
