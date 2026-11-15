import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectRules } from "../src/context/projectRules.ts";

const repo = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "anvil-rules-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
};

test("AGENTS.md and CLAUDE.md are read in order; identical copies are sent once", () => {
  const rules = loadProjectRules(repo({ "AGENTS.md": "Run tox before committing.", "CLAUDE.md": "Run tox before committing.", ".cursorrules": "Prefer pathlib." }));
  assert.deepEqual(rules?.sources, ["AGENTS.md", ".cursorrules"]);
  assert.match(rules?.text ?? "", /Project rules \(follow them\):[\s\S]*Run tox[\s\S]*Prefer pathlib/);
});

test("rules are trimmed to their budget and absent rules give nothing", () => {
  const rules = loadProjectRules(repo({ "AGENTS.md": "x ".repeat(10_000) }), 300);
  assert.ok((rules?.tokens ?? 0) <= 340);
  assert.equal(rules?.trimmed, true);
  assert.match(rules?.text ?? "", /read_file AGENTS\.md/);
  assert.equal(loadProjectRules(repo({ "README.md": "hi" })), undefined);
});
