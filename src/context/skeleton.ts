export interface SymbolEntry {
  name: string;
  kind: "class" | "function" | "method";
  line: number;
  signature: string;
}

export interface PythonImport {
  module: string;
  level: number;
  names: string[];
}

export interface ParsedFile {
  symbols: SymbolEntry[];
  pythonImports: PythonImport[];
  scriptImports: string[];
  docLines: string[];
}

const PYTHON_DEF = /^(\s*)(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/;
const SCRIPT_DEFS: [RegExp, SymbolEntry["kind"]][] = [
  [/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, "function"],
  [/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:class|interface)\s+([A-Za-z_$][\w$]*)/, "class"],
  [/^\s*export\s+(?:type|enum)\s+([A-Za-z_$][\w$]*)/, "class"],
  [/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/, "function"],
];

function pythonSignature(lines: string[], start: number): string {
  let signature = "";
  let depth = 0;
  for (let i = start; i < Math.min(lines.length, start + 15); i++) {
    const code = lines[i].replace(/#.*$/, "").trim();
    signature += (signature && !signature.endsWith("(") ? " " : "") + code;
    for (const char of code) depth += char === "(" || char === "[" ? 1 : char === ")" || char === "]" ? -1 : 0;
    if (depth <= 0 && /:(\s*\.\.\.)?$/.test(code)) break;
  }
  return signature.replace(/,?\s*\)/g, ")").replace(/\s+/g, " ");
}

function parsePython(lines: string[]): ParsedFile {
  const symbols: SymbolEntry[] = [];
  const pythonImports: PythonImport[] = [];
  const stack: { indent: number; kind: string }[] = [];
  let quote: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const wasInString = quote !== undefined;
    for (const match of line.matchAll(/"""|'''/g)) {
      if (!quote) quote = match[0];
      else if (quote === match[0]) quote = undefined;
    }
    if (wasInString) continue;
    const def = PYTHON_DEF.exec(line);
    if (def) {
      const indent = def[1].length;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const parent = stack[stack.length - 1];
      stack.push({ indent, kind: parent?.kind === "def" ? "def" : def[2] });
      if (parent?.kind === "def") continue;
      const kind = def[2] === "class" ? "class" : parent ? "method" : "function";
      symbols.push({ name: def[3], kind, line: i + 1, signature: pythonSignature(lines, i) });
      continue;
    }
    const fromImport = /^\s*from\s+(\.*)([\w.]*)\s+import\s+(.*)$/.exec(line);
    if (fromImport) {
      let names = fromImport[3];
      if (names.trim().startsWith("(") && !names.includes(")")) {
        for (let j = i + 1; j < Math.min(lines.length, i + 80); j++) {
          names += " " + lines[j];
          if (lines[j].includes(")")) break;
        }
      }
      pythonImports.push({
        module: fromImport[2],
        level: fromImport[1].length,
        names: [...names.replace(/#.*$/gm, "").matchAll(/([A-Za-z_]\w*)(?:\s+as\s+\w+)?/g)]
          .map((m) => m[1])
          .filter((name) => name !== "as"),
      });
      continue;
    }
    const plainImport = /^\s*import\s+([\w.,\s]+?)(?:\s+as\s+\w+)?\s*$/.exec(line);
    if (plainImport) {
      for (const module of plainImport[1].split(",")) {
        const name = module.trim().split(/\s+/)[0];
        if (name) pythonImports.push({ module: name, level: 0, names: [] });
      }
    }
  }
  return { symbols, pythonImports, scriptImports: [], docLines: pythonDoc(lines) };
}

function pythonDoc(lines: string[]): string[] {
  const first = lines.findIndex((line) => line.trim() && !line.startsWith("#"));
  if (first < 0) return [];
  const opening = /^\s*[rbu]?("""|''')(.*)$/.exec(lines[first]);
  if (!opening) return [];
  const doc: string[] = [];
  let rest = opening[2];
  for (let i = first; i < lines.length && doc.length < 3; i++) {
    const text = i === first ? rest : lines[i];
    const end = text.indexOf(opening[1]);
    const clean = (end >= 0 ? text.slice(0, end) : text).trim();
    if (clean) doc.push(clean);
    if (end >= 0 || (i > first && !clean && doc.length)) break;
    rest = "";
  }
  return doc;
}

function parseScript(lines: string[]): ParsedFile {
  const symbols: SymbolEntry[] = [];
  const scriptImports: string[] = [];
  lines.forEach((line, i) => {
    for (const [pattern, kind] of SCRIPT_DEFS) {
      const match = pattern.exec(line);
      if (match) {
        symbols.push({ name: match[1], kind, line: i + 1, signature: line.trim().replace(/\s*\{\s*$/, "") });
        break;
      }
    }
    for (const match of line.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)["'](\.{1,2}\/[^"']+)["']/g)) {
      scriptImports.push(match[1]);
    }
  });
  const doc = lines.find((line) => /^\s*(\/\/|\/\*\*?|\*)\s*\w/.test(line));
  return { symbols, pythonImports: [], scriptImports, docLines: doc ? [doc.replace(/^\s*(\/\/|\/\*\*?|\*)\s*/, "")] : [] };
}

function parseText(lines: string[]): ParsedFile {
  const doc = lines.map((line) => line.replace(/^[#=\-*\s]+/, "").trim()).find((line) => line.length > 2);
  return { symbols: [], pythonImports: [], scriptImports: [], docLines: doc ? [doc] : [] };
}

export function parseFile(path: string, content: string): ParsedFile {
  const lines = content.split(/\r?\n/);
  if (/\.pyi?$/.test(path)) return parsePython(lines);
  if (/\.(?:[cm]?[jt]sx?)$/.test(path)) return parseScript(lines);
  return parseText(lines);
}
