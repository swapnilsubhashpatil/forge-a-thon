import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheHitRatio, scoreContext } from "../src/context/scorecard.ts";
import type { ContextFile } from "../src/shared/protocol.ts";

const file = (path: string, role: ContextFile["role"] = "target"): ContextFile => ({ path, role, score: 1, tokens: 0, reasons: [] });

const files = [
  file("src/flask/cli.py"),
  file("tests/test_cli.py"),
  file("src/flask/app.py", "reference"),
  file("src/flask/config.py", "reference"),
  file("src/flask/helpers.py", "reference"),
  file("docs/cli.rst"),
];

test("hits count edited files inside the top five predictions only", () => {
  const score = scoreContext({ files, read: ["src/flask/cli.py", "docs/api.rst"], edited: ["src/flask/cli.py", "tests/test_cli.py", "docs/cli.rst"] });
  assert.equal(score.hits, 2);
  assert.equal(score.edited, 3);
  assert.equal(score.predictedRead, 1);
  assert.deepEqual(score.topPredicted, files.slice(0, 5).map((entry) => entry.path));
});

test("mentioned files do not count as predictions", () => {
  const score = scoreContext({ files: [file("a.py", "mentioned"), file("b.py")], read: [], edited: ["a.py", "b.py"] });
  assert.deepEqual(score.topPredicted, ["b.py"]);
  assert.equal(score.hits, 1);
});

test("no edits means zero of zero", () => {
  const score = scoreContext({ files, read: [], edited: [] });
  assert.equal(score.hits, 0);
  assert.equal(score.edited, 0);
});

test("cache ratio is unknown without cache data and capped at one", () => {
  assert.equal(cacheHitRatio(1000, undefined), undefined);
  assert.equal(cacheHitRatio(0, 10), undefined);
  assert.equal(cacheHitRatio(1000, 840), 0.84);
  assert.equal(cacheHitRatio(100, 200), 1);
});
