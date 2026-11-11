# 06 G2 Scope badges
Spec: [G2](../spec.md#g2-scope-badges)

## Do
- Track seen ranges per file: `read_file` ranges + context-pack slices (whole file for `create_file`).
- Inline: the selection (+ the enclosing function's docstring from the skeleton) is the allowed range.
- Review computes per-hunk flags; amber badge in the review CodeLens/hover ("outside selection" / "edited without reading"); flags listed in the tool result. Never blocks Accept.

## Acceptance
- Unit tests: hunk inside/outside selection; agent hunk on unread lines; new file never flagged.
- Task A on Sonnet: no badge. Contrived out-of-selection hunk: badge shown.
