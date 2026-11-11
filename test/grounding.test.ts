import { test } from "node:test";
import assert from "node:assert/strict";
import { definedNames, describeUngrounded, ungroundedNames } from "../src/edits/grounding.ts";

const workspace = new Set(["get_debug_flag", "AppGroup", "with_appcontext", "current_app", "json", "click", "routes_command", "cli"]);
const modules: Record<string, string> = { "flask.helpers": "def get_debug_flag():\n    pass\ndef get_load_dotenv():\n    pass\n" };
const context = { knownIdentifier: (name: string) => workspace.has(name), moduleText: (module: string) => modules[module] };

test("the Task A edit has no ungrounded names", () => {
  const proposal = [
    "def get_debug_flag() -> bool:",
    '    """Get whether debug mode should be enabled for the app, indicated by the',
    "    :envvar:`FLASK_DEBUG` environment variable. The values ``0``, ``false``,",
    "    ``no``, ``off`` and ``n`` (case-insensitive) are treated as false.",
    '    """',
    '    val = os.environ.get("FLASK_DEBUG")',
    '    return bool(val and val.lower() not in {"0", "false", "no", "off", "n"})',
  ].join("\n");
  assert.deepEqual(ungroundedNames(proposal, proposal, context), []);
});

test("an invented helper call is flagged, a local helper defined in the proposal is not", () => {
  const added = "    secrets = get_secret_keys(app.config)\n    masked = _mask(value)\n";
  const proposal = `def _mask(value):\n    return "***"\n\ndef config_command():\n${added}`;
  assert.deepEqual(ungroundedNames(added, proposal, context), ["get_secret_keys"]);
});

test("method calls, builtins, keywords and constructors from imports are not flagged", () => {
  const added = '    data = {k: str(v) for k, v in current_app.config.items()}\n    click.echo(json.dumps(data, indent=2))\n    if isinstance(v, dict):\n        raise ValueError("x")\n';
  assert.deepEqual(ungroundedNames(added, added, context), []);
});

test("from-imports of names missing from a workspace module are flagged; external modules are trusted", () => {
  const added = "from flask.helpers import get_debug_flag, get_secret_keys\nfrom werkzeug.utils import anything\n";
  assert.deepEqual(ungroundedNames(added, added, context), ["get_secret_keys"]);
});

test("names inside strings and comments are ignored", () => {
  const added = '    msg = "call fake_function(x) here"  # also other_fake(y)\n';
  assert.deepEqual(ungroundedNames(added, added, context), []);
});

test("definedNames picks up defs, params, imports, assignments and loop targets", () => {
  const names = definedNames("import os as operating\nfrom a import (b, c as d)\ndef f(x, y=2, *args, **kw):\n    for i, j in z:\n        total = 0\n");
  for (const name of ["operating", "b", "d", "f", "x", "y", "args", "kw", "i", "j", "total"]) assert.ok(names.has(name), name);
  assert.equal(describeUngrounded(["a"]), "`a` is not defined anywhere");
});
