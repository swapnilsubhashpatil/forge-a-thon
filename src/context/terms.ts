const STOPWORDS = new Set(
  (
    "a an the and or but of to in on at by for from with without into onto as is are was were be been being it its " +
    "this that these those there here so if then than when where which who whom what why how do does did done can " +
    "could should would will shall may might must not no yes all any some each every our your their my his her we " +
    "you they i me us them add adding make made change changes changed fix fixed implement create update new also " +
    "use using used via just like only please need want get set let one two way thing things self none true false " +
    "return returns def class import from"
  ).split(" "),
);

const KEEP_SHORT = new Set(["io", "ui", "db", "os", "id", "js", "ts", "py"]);

export function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 5 && /(?:ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed") && !word.endsWith("eed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

const splitCache = new Map<string, string[]>();

export function splitIdentifier(identifier: string): string[] {
  const cached = splitCache.get(identifier);
  if (cached) return cached;
  if (splitCache.size > 200_000) splitCache.clear();
  const parts = identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  splitCache.set(identifier, parts);
  return parts;
}

function keep(word: string): boolean {
  return (word.length > 2 || KEEP_SHORT.has(word)) && !STOPWORDS.has(word) && !/^\d+$/.test(word);
}

const termCache = new Map<string, string[]>();

export function identifierTerms(identifier: string): string[] {
  const cached = termCache.get(identifier);
  if (cached) return cached;
  if (termCache.size > 200_000) termCache.clear();
  const parts = splitIdentifier(identifier).filter(keep).map(stem);
  const compound = identifier.toLowerCase();
  if (/[_]|[a-z][A-Z]/.test(identifier) && parts.length > 1) parts.push(compound.replace(/^_+/, ""));
  termCache.set(identifier, parts);
  return parts;
}

export function textTerms(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) out.push(...identifierTerms(match[0]));
  return out;
}

export function pathTerms(path: string): { base: string[]; dirs: string[] } {
  const segments = path.split("/");
  const file = segments.pop() ?? "";
  const stemName = file.replace(/\.[^.]+$/, "");
  return {
    base: splitIdentifier(stemName).filter(keep).map(stem),
    dirs: segments.flatMap((segment) => splitIdentifier(segment).filter(keep).map(stem)),
  };
}

export interface QueryToken {
  term: string;
  position: number;
  compound: boolean;
}

export function queryTokens(text: string): QueryToken[] {
  const out: QueryToken[] = [];
  let position = 0;
  const withoutExtensions = text.replace(/\.(py|pyi|ts|tsx|js|jsx|mjs|rst|md|txt|json|toml|cfg|ini|ya?ml|html|css)\b/gi, " ");
  for (const match of withoutExtensions.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    const raw = match[0];
    const compound = /_|[a-z][A-Z]/.test(raw);
    if (compound) out.push({ term: raw.toLowerCase().replace(/^_+/, ""), position, compound: true });
    for (const part of splitIdentifier(raw)) {
      if (keep(part)) out.push({ term: stem(part), position, compound: false });
      position += 1;
    }
  }
  return out;
}
