# Edit matcher robustness

Corpus: 30 function blocks (6 to 30 lines) sampled evenly from flask 3.1.3 `src/flask/*.py`.
Each block becomes an `old_string`, perturbed the way models typically get it wrong. The `new_string` is the
perturbed block with one marker line added inside the function body, written in the same (possibly wrong) style.

- **Exact only**: unique `String.indexOf` match, then splice. This is a plain search/replace tool.
- **Cascade located**: `applyReplacement` succeeded and the result equals the intended edit after trimming each line
  and dropping blank lines (right place, right content).
- **Cascade byte-exact**: the result is byte-identical to the intended file, including re-indentation and line endings.
  For the typo and missing-blank-line rows the intended file is the model's `new_string` spliced over the original
  block: the model rewrote those lines, so its version is what should land.

| Perturbation | Cases | Exact only | Cascade located | Cascade byte-exact | Stage used |
|---|---:|---:|---:|---:|---|
| none | 30 | 100.0% | 100.0% | 100.0% | exact:30 |
| trailing whitespace | 30 | 0.0% | 100.0% | 100.0% | whitespace:30 |
| tabs instead of spaces | 30 | 0.0% | 100.0% | 100.0% | indentation:30 |
| wrong indentation level | 30 | 0.0% | 100.0% | 100.0% | indentation:30 |
| CRLF file, LF old_string | 30 | 0.0% | 100.0% | 100.0% | exact:30 |
| one-character typo | 30 | 0.0% | 83.3% | 83.3% | fuzzy:25 |
| missing blank line | 18 | 0.0% | 100.0% | 100.0% | fuzzy:18 |
| **All** | 198 | 15.2% | 97.5% | 97.5% | |

False-positive check: each block was deleted from its file and its `old_string` (verbatim and with a typo) applied
to the remaining file, where only other, similar functions exist. 0 of 60 cases matched (must be 0).

Whole-corpus check: every `def` of 3+ lines (172) was deleted and its exact text applied to the rest of the file.
4 matched: ctx.py:278 __exit__ (exact), ctx.py:447 __exit__ (exact), helpers.py:80 generate (exact), helpers.py:95 generate (exact). These bodies exist verbatim a second time in the same file,
so a match is correct; the near-identical siblings (`do_teardown_request`/`do_teardown_appcontext`,
`render_template`/`stream_template`) are rejected because fuzzy matching needs 4+ non-blank lines, at most 15% changed lines, each
line at least 80% similar, an average of 85%+, and a 0.05 lead over any non-overlapping runner-up.

Limitations: perturbations are synthetic and applied one at a time. The typo misses are short lines where one swapped pair drops
line similarity under the 80% floor; those fail with a hint showing the closest lines so the model can retry. Recall is traded
for zero wrong-location edits on purpose.

Worst-case path (no exact match, fuzzy scan of the whole file): 6.82 ms per edit on average.

Reproduce: `node scripts/bench-edits.ts` (set `FLASK_SRC` to point at another checkout).
