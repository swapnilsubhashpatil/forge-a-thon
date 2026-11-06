# Problem statement

AI coding tools draw three common complaints: they **lose track of the file you care about**, they **rewrite a
function you did not ask them to touch**, and they **confidently edit a symbol that does not exist**.

Anvil is a **VS Code extension coding agent** whose agent loop runs on **TrueForge**, TrueFoundry's open-source agent
harness ([github.com/truefoundry/trueforge](https://github.com/truefoundry/trueforge)). The model is whatever you
configure in TrueForge.

The hard part: find the right code in a repo bigger than the context window, make multi-file changes the user didn't
spell out, show every change for review before it touches disk, and keep working when the model fails.

## Ground rules

- The extension is a TrueForge client: it creates sessions and sends turns through the TrueForge HTTP API or
  TypeScript SDK, then renders the streamed events.
- Editor capabilities (read file, search workspace, propose write, run command) are exposed to the agent as
  **MCP tools**. The agent decides what to read and change.
- TrueForge runs in local mode. Nothing is deployed.
- Models are configured in TrueForge (catalog provider or OpenAI-compatible endpoint). The extension **never calls a
  model provider directly** and does not hard-code one provider.
- No API keys in the repo. Ship an example config file.

## Core capabilities

1. **Inline edit**: select code, press a keybinding, type an instruction, get a diff in the editor with accept/reject.
2. **Agent mode**: a panel where one request drives a tool loop (read, search, write, run) that edits 3+ files nobody
   named.
3. **Context assembly**: `@file` and `@symbol` mentions, plus automatic retrieval with a size budget.
4. **Diff review**: per-hunk accept/reject, no silent writes, and undo for applied changes.
5. **Streaming and cancellation**: live tokens, mid-flight cancel, a non-blocking editor, and no half-applied edits
   after a cancel.

Out of scope: tab completion, training or hosting models, hosted backends or databases, authentication, Marketplace
publishing.

## Reference tasks

Repository: [pallets/flask](https://github.com/pallets/flask) at tag `3.1.3` (commit `22d92470`).

| Task | Instruction | Verification |
|---|---|---|
| A. Inline edit | In `src/flask/helpers.py`, select `get_debug_flag`: *"Treat the values 'off' and 'n' as false as well, case-insensitively, and update the docstring to list every value that is treated as false."* | `FLASK_DEBUG=off python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"` prints `False` |
| B. Agent mode | No files named: *"Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as "***". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands."* | `pytest tests/test_cli.py -q` passes, the masked JSON prints, the diff touches 3+ files, and the TrueForge session is shown |
| C. Resilience | Configure an unreachable endpoint or invalid key, then repeat Task A | The editor stays responsive, a clear message appears (or a fallback model takes over), and `git status` is clean |
