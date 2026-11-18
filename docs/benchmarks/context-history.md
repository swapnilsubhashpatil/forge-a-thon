# Held-out context benchmark: real Flask history

200 non-merge commits since May 2021 that modified source files (≤6 files, changelog/CI/deps excluded). Request = commit subject;
truth = files the commit modified that existed before it; index built at the parent commit. Split by hash: tune on dev, report test.

Metrics: hit@1 / hit@5 = a truth file ranked first / in the top 5; all@5 = every truth file in the top 5 (LocAgent-style file Acc@5);
recall@k = share of truth files in the top k; MRR = 1 / rank of the first truth file.

## dev (97 tasks)

| ranker | hit1 | hit5 | all5 | recall5 | recall10 | mrr |
|---|---|---|---|---|---|---|
| anvil | 0.629 | 0.835 | 0.619 | 0.730 | 0.854 | 0.725 |
| bm25 | 0.371 | 0.711 | 0.381 | 0.549 | 0.686 | 0.526 |

## test (103 tasks)

| ranker | hit1 | hit5 | all5 | recall5 | recall10 | mrr |
|---|---|---|---|---|---|---|
| anvil | 0.612 | 0.854 | 0.515 | 0.685 | 0.805 | 0.716 |
| bm25 | 0.398 | 0.699 | 0.369 | 0.521 | 0.669 | 0.532 |

## all (200 tasks)

| ranker | hit1 | hit5 | all5 | recall5 | recall10 | mrr |
|---|---|---|---|---|---|---|
| anvil | 0.620 | 0.845 | 0.565 | 0.707 | 0.828 | 0.720 |
| bm25 | 0.385 | 0.705 | 0.375 | 0.535 | 0.677 | 0.529 |

## Sample misses (anvil, no truth file in top 5)

| commit | request | truth | anvil top 5 |
|---|---|---|---|
| d44f1c65 | relax type hint for bytes io | src/flask/helpers.py | tests/type_check/typing_route.py, src/flask/json/__init__.py, src/flask/json/provider.py, tests/type_check/typing_app_decorators.py, tests/type_check/typing_error_handler.py |
| 7d5d1874 | better type checking during deprecation | src/flask/__init__.py | tests/type_check/typing_route.py, src/flask/debughelpers.py, tests/type_check/typing_app_decorators.py, tests/type_check/typing_error_handler.py, src/flask/wrappers.py |
| 98ae7189 | fix mypy finding | src/flask/app.py | src/flask/typing.py, src/flask/sansio/app.py, src/flask/sansio/scaffold.py, src/flask/helpers.py, src/flask/cli.py |
| dffe3034 | fix mypy findings | src/flask/helpers.py | src/flask/typing.py, requirements/typing.txt, src/flask/ctx.py, requirements/typing.in, requirements/dev.txt |
| 176fdfa0 | fix mypy findings | src/flask/helpers.py, src/flask/json/provider.py | src/flask/typing.py, requirements/typing.txt, src/flask/ctx.py, requirements/typing.in, requirements/dev.txt |
| eb1182a1 | fix mypy finding | src/flask/sessions.py | src/flask/typing.py, src/flask/sansio/app.py, src/flask/sansio/scaffold.py, src/flask/helpers.py, src/flask/cli.py |
| ccf125bf | fix mypy findings | src/flask/sessions.py | src/flask/typing.py, requirements/typing.txt, src/flask/ctx.py, requirements/typing.in, requirements/dev.txt |
| 1d5abfad | Fixing issue 5342: 'The double quote is missing in the string' | src/flask/cli.py | src/flask/config.py, src/flask/typing.py, src/flask/app.py, src/flask/wrappers.py, docs/security.rst |
| 65271c10 | Remove print left in by accident | src/flask/app.py | src/flask/testing.py, docs/patterns/sqlite3.rst, src/flask/cli.py, docs/reqcontext.rst, src/flask/sessions.py |
| 17e146ad | Pass maxsplit via kwarg to re.split | src/flask/cli.py | src/flask/helpers.py, src/flask/app.py, src/flask/json/__init__.py, src/flask/wrappers.py, src/flask/json/provider.py |
| 3fbfbad7 | werkzeug 2.3.3 compatibility | src/flask/testing.py | src/flask/helpers.py, src/flask/wrappers.py, src/flask/app.py, src/flask/globals.py, docs/installation.rst |
| 79ebf6c3 | update minimum requirements | src/flask/app.py | requirements/tests-pallets-min.txt, requirements/typing.txt, requirements/docs.txt, requirements/tests.txt, requirements/dev.txt |
| 84c007d3 | show subdomain or host in routes output | src/flask/cli.py, tests/test_cli.py | src/flask/app.py, tests/typing/typing_route.py, src/flask/testing.py, src/flask/blueprints.py, docs/patterns/appdispatch.rst |
| 8239765a | allow async signal receivers | src/flask/app.py, src/flask/ctx.py, src/flask/helpers.py, src/flask/templating.py | src/flask/signals.py, docs/signals.rst, tests/test_signals.py, docs/async-await.rst, tests/test_async.py |
| aa040c08 | run latest black format | src/flask/templating.py | src/flask/app.py, src/flask/cli.py, src/flask/scaffold.py, src/flask/globals.py, CONTRIBUTING.rst |
