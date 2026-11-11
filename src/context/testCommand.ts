import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

export interface TestCommand {
  command: string;
  reason: string;
  /** Environment the command needs, applied by run_command itself (never inline, so it works on every shell). */
  env: Record<string, string>;
}

const PY_CONFIGS = ["pyproject.toml", "pytest.ini", "setup.cfg", "tox.ini"];

/**
 * Guess how to verify a change in this workspace. Returns undefined when unsure; the pack then says nothing,
 * because a wrong hint costs the model more than no hint.
 */
export function detectTestCommand(root: string, workspaceFiles: string[], targets: string[]): TestCommand | undefined {
  const python = detectPython(root, workspaceFiles, targets);
  if (python) return python;
  return detectNode(root);
}

/** `src/<package>/__init__.py` layouts need src on the import path when the package is not installed. */
export function pythonSrcLayout(root: string): boolean {
  const src = join(root, "src");
  if (!existsSync(src)) return false;
  try {
    return readdirSync(src, { withFileTypes: true }).some((entry) => entry.isDirectory() && existsSync(join(src, entry.name, "__init__.py")));
  } catch {
    return false;
  }
}

function detectPython(root: string, files: string[], targets: string[]): TestCommand | undefined {
  const testFiles = files.filter((path) => extname(path) === ".py" && /(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(path));
  const configured = PY_CONFIGS.some((name) => mentionsPytest(join(root, name)));
  if (!configured && !testFiles.length) return undefined;

  const env: Record<string, string> = pythonSrcLayout(root) ? { PYTHONPATH: "src" } : {};
  const companion = companionTest(targets, testFiles);
  const command = companion ? `python -m pytest ${companion} -q` : "python -m pytest -q";
  const reasons = [configured ? "pytest configured" : `${testFiles.length} test files`];
  if (companion) reasons.push(`${companion} tests ${basename(targets.find((target) => matches(target, companion)) ?? "")}`.trim());
  if (env.PYTHONPATH) reasons.push("src layout: PYTHONPATH=src is set for you");
  return { command, reason: reasons.join("; "), env };
}

function detectNode(root: string): TestCommand | undefined {
  const manifest = join(root, "package.json");
  if (!existsSync(manifest)) return undefined;
  try {
    const test = (JSON.parse(readFileSync(manifest, "utf8")) as { scripts?: Record<string, string> }).scripts?.test;
    if (!test || /no test specified/i.test(test)) return undefined;
    return { command: "npm test", reason: `package.json scripts.test: ${test}`, env: {} };
  } catch {
    return undefined;
  }
}

function mentionsPytest(path: string): boolean {
  try {
    return /\[tool\.pytest|\[pytest\]|\[tool:pytest\]|pytest/.test(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
}

function stem(path: string): string {
  return basename(path, extname(path)).replace(/^test_|_test$/g, "");
}

function matches(target: string, test: string): boolean {
  return stem(target) === stem(test) && !/(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(target);
}

/** The test file named after the highest-ranked target that has one, e.g. src/flask/cli.py -> tests/test_cli.py. */
function companionTest(targets: string[], testFiles: string[]): string | undefined {
  for (const target of targets) {
    if (testFiles.includes(target)) return target;
    const hit = testFiles.find((test) => matches(target, test));
    if (hit) return hit;
  }
  return undefined;
}
