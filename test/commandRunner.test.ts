import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { clipOutput, formatCommandResult, runShell, stripAnsi, summarizeTests } from "../src/tools/commandRunner.ts";

test("pytest summaries carry counts and the first failure", () => {
  const out = "tests/test_cli.py ..F.\nFAILED tests/test_cli.py::test_config - AssertionError\n===== 1 failed, 55 passed, 3 skipped in 0.42s =====";
  assert.equal(summarizeTests(out), "1 failed, 55 passed, 3 skipped · first failure tests/test_cli.py::test_config");
  assert.equal(summarizeTests("55 passed, 3 skipped in 0.26s"), "55 passed, 3 skipped");
});

test("jest and node --test summaries are recognised; other output is not", () => {
  assert.equal(summarizeTests("Tests:       2 failed, 55 passed, 57 total"), "2 failed, 55 passed, 57 total");
  assert.equal(summarizeTests("ℹ pass 53\nℹ fail 1\nnot ok 4 - parses config"), "1 failed, 53 passed · first failure parses config");
  assert.equal(summarizeTests("hello world"), undefined);
});

test("clip keeps head and tail and says how much was cut", () => {
  const text = `${"a".repeat(3000)}${"b".repeat(20_000)}FAILED here`;
  const clipped = clipOutput(text);
  assert.ok(clipped.startsWith("a".repeat(2000)));
  assert.ok(clipped.endsWith("FAILED here"));
  assert.match(clipped, /characters omitted \(output had \d+ lines/);
  assert.equal(clipOutput("short"), "short");
});

test("ANSI colours and carriage-return progress are stripped", () => {
  assert.equal(stripAnsi("\x1b[32mPASSED\x1b[0m 50%\r100%"), "PASSED 50%\n100%");
});

test("a real command reports exit code, output and wall time", async () => {
  const result = await runShell(`node -e "console.log('hi'); process.exit(3)"`, { cwd: tmpdir(), timeoutMs: 20_000 });
  assert.equal(result.exitCode, "3");
  const text = formatCommandResult("node -e ...", result);
  assert.match(text.split("\n")[1], /^exit 3 · \d+\.\ds$/);
  assert.match(text, /hi/);
});

test("environment from the caller reaches the command", async () => {
  const result = await runShell(`node -e "console.log(process.env.PYTHONPATH)"`, { cwd: tmpdir(), timeoutMs: 20_000, env: { PYTHONPATH: "src" } });
  assert.equal(result.output.trim(), "src");
});

test("a silent command hits the inactivity timeout and is killed", async () => {
  const result = await runShell(`node -e "setTimeout(() => {}, 60000)"`, { cwd: tmpdir(), timeoutMs: 30_000, idleTimeoutMs: 800 });
  assert.equal(result.exitCode, "timeout");
  assert.equal(result.timedOut, "idle");
  assert.ok(result.wallMs < 10_000);
  assert.match(formatCommandResult("sleep", result, 800), /no output for 1s \(process tree killed\)/);
});

test("Windows drive letters are upper-cased for commands, other platforms untouched", async () => {
  const { normalizeCwd } = await import("../src/tools/commandRunner.ts");
  assert.equal(normalizeCwd(String.raw`c:\Users\x\flask`, "win32"), String.raw`C:\Users\x\flask`);
  assert.equal(normalizeCwd(String.raw`C:\Users\x`, "win32"), String.raw`C:\Users\x`);
  assert.equal(normalizeCwd("/home/c:/x", "linux"), "/home/c:/x");
});
