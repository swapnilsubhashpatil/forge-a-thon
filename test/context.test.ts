import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { mentionCandidates, searchCode } from "../src/context/codeSearch.ts";
import { buildContextPack } from "../src/context/contextPack.ts";
import { rankFiles } from "../src/context/ranker.ts";
import { estimateTokens } from "../src/context/tokens.ts";
import { WorkspaceIndex } from "../src/context/workspaceIndex.ts";

const FLASK = process.env.FLASK_REPO ?? "C:/Coding/flask-3.1.3";
const TASK_B_PROMPTS = [
  "Add a new `flask config` CLI command that prints the current app's configuration as JSON, with an option to mask secret values, and add tests for it.",
  "Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as \"***\". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.",
];

test("Task B finds the CLI module, its tests and docs as targets", { skip: !existsSync(FLASK) && "Flask repo not found" }, async () => {
  const index = new WorkspaceIndex(FLASK);
  await index.build();
  for (const prompt of TASK_B_PROMPTS) {
    const top = rankFiles(index, { text: prompt }).slice(0, 5);
    for (const path of ["src/flask/cli.py", "tests/test_cli.py", "docs/cli.rst"]) {
      const hit = top.find((file) => file.path === path);
      assert.ok(hit, `${path} missing from top 5: ${top.map((file) => file.path).join(", ")}`);
      assert.equal(hit.role, "target");
    }
    const config = top.find((file) => file.path === "src/flask/config.py");
    if (config) assert.equal(config.role, "reference");
  }
  const ranked = rankFiles(index, { text: TASK_B_PROMPTS[1] });

  for (const budget of [1500, 6000]) {
    const pack = await buildContextPack(index, ranked, budget);
    assert.ok(estimateTokens(pack.text) <= budget);
    assert.equal(pack.report.usedTokens, estimateTokens(pack.text));
    assert.match(pack.text, /^<context>[\s\S]*<\/context>$/);
  }
});

test("small workspace: skeleton, imports, mentions, search fallback and budget", async () => {
  const root = await mkdtemp(join(tmpdir(), "anvil-context-"));
  await mkdir(join(root, "pkg"));
  await writeFile(join(root, "pkg", "__init__.py"), "from .core import Engine as Engine\n");
  await writeFile(
    join(root, "pkg", "core.py"),
    '"""Core engine."""\nfrom .util import helper\n\nclass Engine:\n    def start_engine(self, fast: bool) -> None:\n        helper()\n\ndef build_engine():\n    return Engine()\n',
  );
  await writeFile(join(root, "pkg", "util.py"), "def helper():\n    pass\n");
  const index = new WorkspaceIndex(root);
  await index.build();

  const core = index.get("pkg/core.py")!;
  assert.deepEqual(core.symbols.map((symbol) => [symbol.name, symbol.kind]), [["Engine", "class"], ["start_engine", "method"], ["build_engine", "function"]]);
  assert.deepEqual(core.imports, ["pkg/util.py"]);
  assert.deepEqual(index.get("pkg/__init__.py")!.imports, ["pkg/core.py"]);

  const ranked = rankFiles(index, { text: "speed up start_engine", mentions: ["pkg/util.py"] });
  assert.equal(ranked[0].path, "pkg/util.py");
  assert.equal(ranked[0].role, "mentioned");
  assert.equal(ranked[1].path, "pkg/core.py");
  assert.ok(ranked[1].reasons.includes("defines start_engine"));

  const pack = await buildContextPack(index, ranked, 300);
  assert.ok(estimateTokens(pack.text) <= 300);
  assert.match(await searchCode(index, { query: "helper" }), /pkg\/core\.py \(2\)/);
  assert.equal(mentionCandidates(index, "start", 5)[0].label, "start_engine");
});
