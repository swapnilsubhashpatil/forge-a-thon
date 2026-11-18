# Context retrieval benchmark

Repo: pallets/flask 3.1.3 (226 indexed text files, ~295k tokens). Node v24.20.0, 2026-11-18.
Run with `node scripts/bench.ts` (set `FLASK_REPO` to point elsewhere). Tokens are estimated as chars/4.

## Method
- **Index build**: `git ls-files`, read, regex skeletons, import edges and term bags; median of 5 cold builds.
- **Quality**: 12 realistic tasks with ground-truth files checked against the Flask source (the files a correct change or answer touches).
  recall@k = share of ground-truth files in the top k; MRR = mean of 1/rank of the first ground-truth file.
- **Baselines**: `bm25` ranks files by BM25 over the same term bags with all query words; `pathOnly` counts query words found in path segments.
  `anvil` is the full ranker (path match, BM25, symbol definitions, sibling symbols, test/docs companions, import-graph PageRank).
- **Pack**: context pack at a 6000-token budget vs the naive approach of sending the full text of the same top-8 files.

## Speed
| step | time |
|---|---|
| index build (median of 5) | 183.1 ms |
| rank one query | 5.33 ms |
| rank + build pack, one query | 6.31 ms |

## Retrieval quality
| ranker | recall@3 | recall@5 | MRR |
|---|---|---|---|
| anvil | 0.875 | 0.958 | 0.854 |
| bm25 | 0.625 | 0.708 | 0.432 |
| pathOnly | 0.167 | 0.208 | 0.144 |

| task | ground truth | anvil top 5 | recall@3 anvil / bm25 / path |
|---|---|---|---|
| Add a new `flask config` CLI command that prints the current app's configuration as JSON, with an option to mask secret values, and add tests for it. | src/flask/cli.py, tests/test_cli.py, docs/cli.rst | src/flask/cli.py, tests/test_cli.py, docs/cli.rst, tests/test_json.py, tests/test_json_tag.py | 1 / 0 / 0 |
| change get_debug_flag so FLASK_DEBUG=off is false | src/flask/helpers.py | src/flask/helpers.py, src/flask/app.py, tests/test_helpers.py, src/flask/cli.py, src/flask/sansio/app.py | 1 / 1 / 0 |
| where are blueprints registered | src/flask/sansio/app.py, src/flask/sansio/blueprints.py | src/flask/sansio/blueprints.py, src/flask/sansio/app.py, docs/blueprints.rst, tests/test_blueprints.py, src/flask/sansio/scaffold.py | 1 / 0.5 / 0 |
| add a test for json provider sort keys | src/flask/json/provider.py, tests/test_json.py | src/flask/json/provider.py, tests/test_json.py, src/flask/app.py, src/flask/blueprints.py, tests/test_json_tag.py | 1 / 1 / 0.5 |
| make the session cookie SameSite attribute configurable per request | src/flask/sessions.py | src/flask/sessions.py, tests/test_basic.py, src/flask/app.py, src/flask/helpers.py, src/flask/wrappers.py | 1 / 1 / 1 |
| support loading configuration from a TOML file | src/flask/config.py | src/flask/config.py, docs/config.rst, tests/test_config.py, tests/test_instance_config.py, tests/static/config.json | 1 / 0 / 0 |
| improve the error message when no create_app factory is found in the module | src/flask/cli.py | tests/test_apps/cliapp/factory.py, docs/tutorial/factory.rst, tests/test_user_error_handler.py, src/flask/cli.py, tests/type_check/typing_error_handler.py | 0 / 1 / 0 |
| send a signal when the application context is pushed | src/flask/ctx.py, src/flask/signals.py | src/flask/app.py, src/flask/ctx.py, src/flask/signals.py, docs/signals.rst, tests/test_signals.py | 1 / 0 / 0.5 |
| MethodView should dispatch HEAD requests to the get method | src/flask/views.py | src/flask/views.py, tests/test_views.py, docs/views.rst, src/flask/app.py, docs/tutorial/views.rst | 1 / 1 / 0 |
| url_for should quote special characters in the _anchor fragment | src/flask/app.py | src/flask/app.py, src/flask/helpers.py, tests/test_helpers.py, src/flask/blueprints.py, tests/test_basic.py | 1 / 1 / 0 |
| teardown_appcontext callbacks should run even after an unhandled exception | src/flask/app.py, src/flask/ctx.py | src/flask/sansio/app.py, src/flask/app.py, src/flask/sansio/scaffold.py, docs/appcontext.rst, src/flask/blueprints.py | 0.5 / 0 / 0 |
| allow registering template filters on a blueprint for the whole app | src/flask/sansio/blueprints.py | src/flask/sansio/blueprints.py, src/flask/sansio/app.py, tests/test_blueprints.py, docs/blueprints.rst, src/flask/sansio/scaffold.py | 1 / 1 / 0 |

## Token savings
| measure | tokens |
|---|---|
| average context pack | 4469 (max 5645, budget 6000) |
| average naive top-8 full files | 42696 |
| savings | 89.5% |

## Code search (median of 5)
| query | JS fallback | ripgrep |
|---|---|---|
| `add_command` | 27.6 ms | 38.2 ms |
| `def .*_command` | 32.2 ms | 55.3 ms |
| `SESSION_COOKIE` | 30.1 ms | 49.1 ms |

ripgrep: VS Code bundled rg. The fallback scans the in-memory index cache; rg includes process spawn cost.

## Limitations
- Ground truth is hand-labelled by us on one Python repo; the queries were written while tuning the ranker, so treat the numbers as a sanity check, not a held-out score.
- Skeletons are regex-based (Python, JS/TS); other languages rank on paths and terms only.
