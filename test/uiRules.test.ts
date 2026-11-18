import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const sourceFile = /\.(ts|tsx|css|html|json)$/;

const scanned = [
  ...["src", "webview-ui/src"].flatMap((dir) =>
    readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
      .filter((file) => sourceFile.test(file))
      .map((file) => join(root, dir, file)),
  ),
  join(root, "package.json"),
  join(root, "README.md"),
];

function violations(pattern: RegExp): string[] {
  return scanned.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) => (pattern.test(line) ? [`${relative(root, file)}:${i + 1}`] : [])),
  );
}

test("no em dash in source or user-visible text", () => {
  assert.deepEqual(violations(/—/), []);
});

test("no blinking or pulsing animations", () => {
  assert.deepEqual(violations(/animate-pulse|@keyframes\s+(blink|pulse)|animation:.*blink/), []);
});
