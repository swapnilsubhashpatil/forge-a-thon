# T2 Context engine
- [x] WorkspaceIndex (git ls-files, Python/JS skeletons, import edges, term bags)
- [x] Ranker: mentions, path, BM25, sibling symbols, test/docs companions, PageRank, active files; target vs reference roles
- [x] Budgeted pack (candidates table, repo map, slices) — never exceeds budget
- [x] search_code (bundled ripgrep + JS fallback), find_symbol, find_references, @mention candidates
- [x] Benchmark on Flask: recall@5 1.0, MRR 0.854, pack ≈ 89 % smaller than whole files
