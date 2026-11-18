import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectTestCommand, pythonSrcLayout } from "../src/context/testCommand.ts";

function workspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "anvil-testcmd-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test("Flask-style src layout picks the companion test file and sets PYTHONPATH", () => {
  const root = workspace({
    "pyproject.toml": "[tool.pytest.ini_options]\ntestpaths = [\"tests\"]\n",
    "src/flask/__init__.py": "",
    "src/flask/cli.py": "",
    "tests/test_cli.py": "",
    "tests/test_helpers.py": "",
  });
  const files = ["src/flask/__init__.py", "src/flask/cli.py", "tests/test_cli.py", "tests/test_helpers.py"];
  const result = detectTestCommand(root, files, ["src/flask/cli.py", "docs/cli.rst"]);
  assert.equal(result?.command, "python -m pytest tests/test_cli.py -q");
  assert.deepEqual(result?.env, { PYTHONPATH: "src" });
  assert.match(result?.reason ?? "", /src layout/);
  assert.equal(pythonSrcLayout(root), true);
});

test("Python repo without a matching companion runs the whole suite", () => {
  const root = workspace({ "pkg/core.py": "", "tests/test_other.py": "" });
  const result = detectTestCommand(root, ["pkg/core.py", "tests/test_other.py"], ["pkg/core.py"]);
  assert.equal(result?.command, "python -m pytest -q");
  assert.deepEqual(result?.env, {});
});

test("Node repo uses npm test unless the script is the npm placeholder", () => {
  assert.equal(detectTestCommand(workspace({ "package.json": JSON.stringify({ scripts: { test: "node --test" } }) }), ["index.js"], [])?.command, "npm test");
  const placeholder = JSON.stringify({ scripts: { test: "echo \"Error: no test specified\" && exit 1" } });
  assert.equal(detectTestCommand(workspace({ "package.json": placeholder }), ["index.js"], []), undefined);
});

test("unknown repos get no hint", () => {
  assert.equal(detectTestCommand(workspace({ "main.go": "" }), ["main.go"], ["main.go"]), undefined);
});
