import { execFile } from "node:child_process";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { parseFile, type PythonImport, type SymbolEntry } from "./skeleton.ts";
import { identifierTerms, pathTerms, textTerms } from "./terms.ts";
import { estimateTokens } from "./tokens.ts";

export type { SymbolEntry } from "./skeleton.ts";

export interface FileEntry {
  path: string;
  symbols: SymbolEntry[];
  imports: string[];
  tokens: number;
  terms: Set<string>;
  docLines: string[];
  termFreq: Map<string, number>;
  length: number;
}

interface Parsed {
  entry: FileEntry;
  pythonImports: PythonImport[];
  scriptImports: string[];
}

const MAX_BYTES = 512 * 1024;
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "venv", ".venv", "env", "__pycache__", ".tox", ".mypy_cache",
  ".pytest_cache", ".ruff_cache", ".next", "coverage", "target", ".idea", ".vscode-test", "site-packages",
]);
const BINARY_EXT = /\.(?:png|jpe?g|gif|bmp|ico|webp|svgz?|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|exe|dll|so|dylib|o|a|class|pyc|pyo|whl|egg|woff2?|ttf|otf|eot|mp[34]|wav|ogg|mov|avi|webm|db|sqlite3?|bin|dat|lock|vsix|map)$/i;
const SYMBOL_BOOST = 2;
const run = promisify(execFile);

export class WorkspaceIndex {
  readonly root: string;
  version = 0;
  private entries = new Map<string, FileEntry>();
  private parsed = new Map<string, Parsed>();
  private contents = new Map<string, { mtimeMs: number; text: string }>();
  private modules = new Map<string, string>();
  private realRoot?: Promise<string>;
  private identifierCache?: { version: number; names: Set<string> };

  constructor(root: string) {
    this.root = root;
  }

  async build(): Promise<void> {
    const paths = await this.listFiles();
    this.entries.clear();
    this.parsed.clear();
    this.contents.clear();
    await Promise.all(paths.map((path) => this.load(path)));
    this.modules = moduleMap([...this.parsed.keys()]);
    for (const parsed of this.parsed.values()) parsed.entry.imports = this.resolveImports(parsed);
    this.entries = new Map([...this.entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    this.version++;
  }

  files(): FileEntry[] {
    return [...this.entries.values()];
  }

  get(path: string): FileEntry | undefined {
    return this.entries.get(normalize(path));
  }

  /** Every identifier that appears in any indexed file (G3 grounding check), cached per index version. */
  identifiers(): Set<string> {
    if (this.identifierCache?.version !== this.version) {
      const names = new Set<string>();
      for (const { text } of this.contents.values()) for (const match of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) names.add(match[0]);
      this.identifierCache = { version: this.version, names };
    }
    return this.identifierCache.names;
  }

  /** Source of a workspace module by dotted name (`flask.helpers`), if the workspace defines it. */
  moduleText(module: string): string | undefined {
    const path = this.modules.get(module);
    return path ? this.text(path) : undefined;
  }

  text(path: string): string | undefined {
    return this.contents.get(normalize(path))?.text;
  }

  async refresh(path: string): Promise<void> {
    const rel = normalize(path);
    if (!this.entries.has(rel) && (await this.ignored(rel))) return;
    const loaded = await this.load(rel);
    if (!loaded) {
      this.remove(rel);
      return;
    }
    if (!this.modules.has(rel)) this.modules = moduleMap([...this.parsed.keys()]);
    const parsed = this.parsed.get(rel);
    if (parsed) parsed.entry.imports = this.resolveImports(parsed);
    this.version++;
  }

  remove(path: string): void {
    const rel = normalize(path);
    this.entries.delete(rel);
    this.parsed.delete(rel);
    this.contents.delete(rel);
    this.version++;
  }

  async read(path: string): Promise<string> {
    const rel = normalize(path);
    const absolute = await this.contained(rel);
    if (!absolute) throw new Error(`Path ${path} is outside the workspace`);
    const info = await stat(absolute);
    const cached = this.contents.get(rel);
    if (cached && cached.mtimeMs === info.mtimeMs) return cached.text;
    const text = await readFile(absolute, "utf8");
    this.contents.set(rel, { mtimeMs: info.mtimeMs, text });
    return text;
  }

  private async load(path: string): Promise<boolean> {
    let absolute;
    let info;
    try {
      absolute = await this.contained(path);
      info = await lstat(join(this.root, path));
    } catch {
      return false;
    }
    if (!absolute || !info.isFile()|| info.size > MAX_BYTES || BINARY_EXT.test(path)) return false;
    const buffer = await readFile(absolute);
    if (buffer.subarray(0, 8000).includes(0)) return false;
    const text = buffer.toString("utf8");
    this.contents.set(path, { mtimeMs: info.mtimeMs, text });
    const file = parseFile(path, text);
    const termFreq = new Map<string, number>();
    const bump = (term: string, by: number) => termFreq.set(term, (termFreq.get(term) ?? 0) + by);
    for (const term of textTerms(text)) bump(term, 1);
    for (const symbol of file.symbols) for (const term of identifierTerms(symbol.name)) bump(term, SYMBOL_BOOST);
    for (const term of textTerms(file.docLines.join(" "))) bump(term, 1);
    const segments = pathTerms(path);
    const terms = new Set([...segments.base, ...segments.dirs, ...termFreq.keys()]);
    let length = 0;
    for (const count of termFreq.values()) length += count;
    const entry: FileEntry = {
      path,
      symbols: file.symbols,
      imports: [],
      tokens: estimateTokens(text),
      terms,
      docLines: file.docLines,
      termFreq,
      length,
    };
    this.entries.set(path, entry);
    this.parsed.set(path, { entry, pythonImports: file.pythonImports, scriptImports: file.scriptImports });
    return true;
  }

  private async contained(rel: string): Promise<string | undefined> {
    const absolute = resolve(this.root, rel);
    if (!inside(resolve(this.root), absolute)) return undefined;
    this.realRoot ??= realpath(this.root);
    const real = await realpath(absolute);
    return inside(await this.realRoot, real) ? real : undefined;
  }

  private async ignored(rel: string): Promise<boolean> {
    try {
      await run("git", ["check-ignore", "-q", "--", rel], { cwd: this.root, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  private async listFiles(): Promise<string[]> {
    try {
      const { stdout } = await run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
        cwd: this.root,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      });
      const files = stdout.split("\0").filter(Boolean);
      if (files.length) return files.filter((file) => !file.split("/").some((part) => SKIP_DIRS.has(part)));
    } catch {}
    return this.walk("");
  }

  private async walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    let items;
    try {
      items = await readdir(join(this.root, dir), { withFileTypes: true });
    } catch {
      return out;
    }
    for (const item of items) {
      const rel = dir ? `${dir}/${item.name}` : item.name;
      if (item.isDirectory()) {
        if (!SKIP_DIRS.has(item.name) && !item.name.startsWith(".")) out.push(...(await this.walk(rel)));
      } else if (item.isFile()) out.push(rel);
    }
    return out;
  }

  private resolveImports(parsed: Parsed): string[] {
    const from = parsed.entry.path;
    const found = new Set<string>();
    for (const spec of parsed.pythonImports) {
      for (const target of this.resolvePython(from, spec)) if (target !== from) found.add(target);
    }
    for (const spec of parsed.scriptImports) {
      const target = this.resolveScript(from, spec);
      if (target && target !== from) found.add(target);
    }
    return [...found].sort();
  }

  private resolvePython(from: string, spec: PythonImport): string[] {
    let base = spec.module;
    if (spec.level > 0) {
      const own = moduleNames(from)[0];
      if (own === undefined) return [];
      const parts = own.split(".");
      const pkg = from.endsWith("__init__.py") ? parts : parts.slice(0, -1);
      const up = pkg.slice(0, Math.max(0, pkg.length - (spec.level - 1)));
      base = [...up, ...(spec.module ? [spec.module] : [])].join(".");
    }
    const module = this.modules.get(base);
    const targets: string[] = [];
    for (const name of spec.names) {
      const sub = this.modules.get(base ? `${base}.${name}` : name);
      if (sub) targets.push(sub);
      else if (module?.endsWith("__init__.py")) {
        const reexport = this.parsed.get(module)?.pythonImports.find((item) => item.level > 0 && item.names.includes(name));
        const resolved = reexport ? this.resolvePython(module, { ...reexport, names: [] })[0] : undefined;
        if (resolved) targets.push(resolved);
      }
    }
    if (!targets.length && module) targets.push(module);
    return targets;
  }

  private resolveScript(from: string, spec: string): string | undefined {
    const joined = posix.normalize(posix.join(posix.dirname(from), spec));
    const stripped = joined.replace(/\.(?:[cm]?js|jsx)$/, "");
    const candidates = [joined, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts"].flatMap((ext) => [stripped + ext, `${stripped}/index${ext}`])];
    return candidates.find((candidate) => this.entries.has(candidate));
  }
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function inside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function moduleNames(path: string): string[] {
  if (!/\.pyi?$/.test(path)) return [];
  const parts = path.replace(/\.pyi?$/, "").split("/");
  if (parts[parts.length - 1] === "__init__") parts.pop();
  const names = [parts.join(".")];
  for (const root of ["src", "lib", "python"]) if (parts[0] === root && parts.length > 1) names.unshift(parts.slice(1).join("."));
  return names.filter(Boolean);
}

function moduleMap(paths: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const path of [...paths].sort()) {
    for (const name of moduleNames(path)) if (!map.has(name) || path.endsWith(".py")) map.set(name, path);
  }
  return map;
}
