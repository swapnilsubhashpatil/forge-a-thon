/**
 * G3: "it confidently edits a symbol that does not exist". Before the user accepts a hunk, check that every bare
 * function call and every `from module import name` in the new lines refers to something that exists: defined in
 * the proposed file, anywhere in the workspace, imported, or a Python builtin. Only confident misses are reported;
 * attribute calls (obj.method()) are never checked because their receiver type is unknown.
 */

export interface GroundingContext {
  /** True when the identifier appears anywhere in the workspace or in an earlier proposal this session. */
  knownIdentifier: (name: string) => boolean;
  /** Source text of a workspace module (`flask.helpers`), or undefined for external modules. */
  moduleText?: (module: string) => string | undefined;
}

const PY_BUILTINS = new Set(
  (
    "abs aiter all anext any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex " +
    "delattr dict dir divmod enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex " +
    "id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow " +
    "print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip " +
    "__import__ NotImplemented Ellipsis exit quit " +
    "BaseException Exception ArithmeticError AssertionError AttributeError BufferError EOFError ImportError " +
    "ModuleNotFoundError LookupError IndexError KeyError MemoryError NameError NotImplementedError OSError " +
    "OverflowError RecursionError ReferenceError RuntimeError StopIteration StopAsyncIteration SyntaxError " +
    "SystemError TypeError UnboundLocalError UnicodeError UnicodeDecodeError UnicodeEncodeError ValueError " +
    "ZeroDivisionError FileNotFoundError FileExistsError PermissionError TimeoutError ConnectionError " +
    "IsADirectoryError NotADirectoryError KeyboardInterrupt SystemExit GeneratorExit Warning UserWarning " +
    "DeprecationWarning PendingDeprecationWarning RuntimeWarning FutureWarning ResourceWarning ExceptionGroup"
  ).split(" "),
);

const PY_KEYWORDS = new Set(
  "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case print".split(
    " ",
  ),
);

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;

/** Identifiers the proposed file text defines, binds or imports (approximate, errs towards "known"). */
export function definedNames(text: string): Set<string> {
  const names = new Set<string>();
  const add = (fragment: string) => {
    for (const match of fragment.matchAll(IDENT)) names.add(match[0]);
  };
  for (const line of text.split(/\r?\n/)) {
    const code = line.replace(/#.*$/, "");
    let match = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)/.exec(code);
    if (match) {
      names.add(match[1]);
      add(match[2].replace(/[:=][^,]*/g, ""));
    }
    match = /^\s*class\s+([A-Za-z_]\w*)/.exec(code);
    if (match) names.add(match[1]);
    match = /^\s*(?:from\s+[\w.]+\s+)?import\s+(.+)$/.exec(code);
    if (match) add(match[1].replace(/\b[\w.]+\s+as\b/g, "").replace(/[()]/g, ""));
    for (const assign of code.matchAll(/^\s*([A-Za-z_][\w,\s*]*?)\s*(?::[^=]+)?=(?!=)/g)) add(assign[1]);
    for (const bind of code.matchAll(/\b(?:for|as|global|nonlocal)\s+([A-Za-z_][\w,\s]*)/g)) add(bind[1]);
    for (const lambda of code.matchAll(/\blambda\s+([^:]*):/g)) add(lambda[1]);
    for (const walrus of code.matchAll(/([A-Za-z_]\w*)\s*:=/g)) names.add(walrus[1]);
  }
  return names;
}

/** Names used by `addedText` that cannot be found anywhere. Python only. */
export function ungroundedNames(addedText: string, proposal: string, context: GroundingContext): string[] {
  const defined = definedNames(proposal);
  const missing = new Set<string>();
  const known = (name: string) => defined.has(name) || PY_BUILTINS.has(name) || context.knownIdentifier(name);

  for (const line of addedText.split(/\r?\n/)) {
    const code = stripStrings(line).replace(/#.*$/, "");
    if (/^\s*(?:async\s+)?def\s|^\s*class\s|^\s*@/.test(code)) continue;

    const from = /^\s*from\s+([\w.]+)\s+import\s+(.+)$/.exec(code);
    if (from) {
      const source = from[1].startsWith(".") ? undefined : context.moduleText?.(from[1]);
      if (source !== undefined) {
        const exported = new Set(source.match(IDENT) ?? []);
        for (const item of from[2].replace(/[()]/g, "").split(",")) {
          const name = item.trim().split(/\s+as\s+/)[0];
          if (name && name !== "*" && !exported.has(name)) missing.add(name);
        }
      }
      continue;
    }
    if (/^\s*import\s/.test(code)) continue;

    // No space before "(": code is written `name(`, while docstring prose ("values (case-insensitive)") is not.
    for (const call of code.matchAll(/(^|[^\w.])([A-Za-z_]\w*)\(/g)) {
      const name = call[2];
      if (PY_KEYWORDS.has(name) || known(name)) continue;
      missing.add(name);
    }
  }
  return [...missing];
}

function stripStrings(line: string): string {
  return line.replace(/("""|''')[\s\S]*?\1|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
}

/** Sentence for the badge and the model. */
export function describeUngrounded(names: string[]): string {
  const list = names.map((name) => `\`${name}\``).join(", ");
  return names.length === 1 ? `${list} is not defined anywhere` : `${list} are not defined anywhere`;
}
