import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAttachments, selectionAttachment, terminalAttachment } from "../src/context/attachments.ts";

test("a selection is labelled by file and lines and numbered like read_file", () => {
  const attachment = selectionAttachment("src/flask/cli.py", 1068, 1070, "def routes_command():\n    pass\n    return");
  assert.equal(attachment.label, "cli.py:1068-1070");
  const { text } = formatAttachments([attachment]);
  assert.match(text, /Selected by the user: src\/flask\/cli\.py lines 1068-1070/);
  assert.match(text, / 1068  def routes_command\(\):/);
  assert.match(text, / 1070      return/);
  assert.ok(text.startsWith("<attachments>"));
});

test("terminal output keeps the command, exit code and the tail, without ANSI", () => {
  const output = `\x1b[31mFAILED\x1b[0m tests/test_cli.py::test_config\n${"x".repeat(20_000)}\n1 failed, 55 passed`;
  const attachment = terminalAttachment(output, "python -m pytest tests/test_cli.py -q", 1);
  assert.equal(attachment.label, "terminal: python -m pytest tests/test_cli.py -q (exit 1)");
  assert.ok(!attachment.text.includes("\x1b["));
  assert.ok(attachment.text.endsWith("1 failed, 55 passed"));
  assert.match(formatAttachments([attachment]).text, /command: python -m pytest tests\/test_cli\.py -q, exit 1/);
});

test("attachments respect their own budget and nothing is emitted when empty", () => {
  assert.deepEqual(formatAttachments([]), { text: "", tokens: 0 });
  const big = selectionAttachment("a.py", 1, 5000, Array.from({ length: 5000 }, (_, i) => `line ${i}`).join("\n"));
  const { text, tokens } = formatAttachments([big], 500);
  assert.ok(tokens < 700);
  assert.match(text, /trimmed to fit/);
});
