import { estimateTokens } from "./tokens.ts";
import type { WorkspaceIndex } from "./workspaceIndex.ts";

export function renderRepoMap(index: WorkspaceIndex, focusPaths: string[], maxTokens: number): string {
  const focus = focusPaths.filter((path) => index.get(path));
  const byDir = new Map<string, string[]>();
  for (const file of index.files()) {
    const cut = file.path.lastIndexOf("/");
    const dir = cut < 0 ? "." : file.path.slice(0, cut);
    byDir.set(dir, [...(byDir.get(dir) ?? []), file.path.slice(cut + 1)]);
  }
  const focusDirs = new Set(focus.map((path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".")));
  const focusSet = new Set(focus);
  const tree = [...focusDirs].sort().map((dir) => {
    const names = byDir.get(dir)!.map((name) => (focusSet.has(dir === "." ? name : `${dir}/${name}`) ? `${name}*` : name));
    return `${dir}/: ${names.join(" ")}`;
  });
  const others = [...byDir.keys()]
    .filter((dir) => !focusDirs.has(dir))
    .sort()
    .map((dir) => `${dir}/ (${byDir.get(dir)!.length} files)`);
  const render = (perFile: number) => {
    const lines = ["Repo map (* = focus file; skeletons show line numbers and signatures)", ...tree];
    for (const path of focus) {
      const symbols = index.get(path)!.symbols.slice(0, perFile);
      if (!symbols.length) continue;
      lines.push("", path);
      for (const symbol of symbols) lines.push(`${String(symbol.line).padStart(5)}${symbol.kind === "method" ? "    " : "  "}${symbol.signature}`);
    }
    return lines;
  };
  const fits = (lines: string[]) => estimateTokens(lines.join("\n")) <= maxTokens;
  const largest = Math.max(0, ...focus.map((path) => index.get(path)!.symbols.length));
  let low = 0;
  let high = largest;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(render(mid))) low = mid;
    else high = mid - 1;
  }
  const lines = render(low);
  while (lines.length && !fits(lines)) lines.pop();
  if (lines.length) {
    lines.push("");
    for (const line of ["Other directories:", ...others]) {
      lines.push(line);
      if (!fits(lines)) {
        lines.pop();
        break;
      }
    }
    if (lines[lines.length - 1] === "" || lines[lines.length - 1] === "Other directories:") lines.splice(-1, 1);
  }
  return lines.join("\n").trimEnd();
}
