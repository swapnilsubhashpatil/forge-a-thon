# 03 M5 Detected test command
Spec: [M5](../spec.md#m5-test-command)

## Do
- `src/context/testCommand.ts`: detect from pyproject (`[tool.pytest.ini_options]`, `testpaths`), `pytest.ini`/`setup.cfg`, `package.json` `scripts.test`; target the nearest test companion of the top-ranked file (e.g. `tests/test_cli.py`). Returns `{command, reason}` or undefined.
- Context pack adds "Verify with (likely): …"; omitted when undefined.
- `run_command`: when `src/` holds a Python package and `PYTHONPATH` is unset, set `PYTHONPATH=src` in the child env.

## Acceptance
- Unit tests: Flask layout → `python -m pytest tests/test_cli.py -q`; npm repo → `npm test`; unknown → undefined.
- Task B on Sonnet: first pytest run does not fail on imports.
