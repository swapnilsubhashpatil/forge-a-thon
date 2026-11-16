export function personalizedPageRank(
  nodes: string[],
  edges: Map<string, string[]>,
  personalization: Map<string, number>,
  damping = 0.85,
  iterations = 40,
): Map<string, number> {
  const total = [...personalization.values()].reduce((sum, value) => sum + value, 0);
  const prior = new Map<string, number>();
  for (const node of nodes) prior.set(node, total > 0 ? (personalization.get(node) ?? 0) / total : 1 / nodes.length);
  let rank = new Map(prior);
  for (let step = 0; step < iterations; step++) {
    const next = new Map<string, number>();
    for (const node of nodes) next.set(node, (1 - damping) * prior.get(node)!);
    let dangling = 0;
    for (const node of nodes) {
      const value = rank.get(node)!;
      const targets = (edges.get(node) ?? []).filter((target) => next.has(target));
      if (!targets.length) {
        dangling += value;
        continue;
      }
      const share = (damping * value) / targets.length;
      for (const target of targets) next.set(target, next.get(target)! + share);
    }
    for (const node of nodes) next.set(node, next.get(node)! + damping * dangling * prior.get(node)!);
    rank = next;
  }
  return rank;
}
