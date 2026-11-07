# T3 Review
- [x] applyReplacement cascade (exact → whitespace → indentation → fuzzy), EOL preserving, retry hints
- [x] Stateless hunks render/resolve
- [x] ReviewController: inline decorations, per-hunk CodeLens, keybindings, new-file review, discardAll for cancel
- [x] ChangeLedger: per-turn change sets, multi-file undo with conflict skip
- [x] Benchmark: 97.5 % apply rate vs 15.2 % exact-only, 0 wrong-location matches
