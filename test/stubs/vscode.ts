export const files = new Map<string, string>();

export class Uri {
  readonly path: string;

  private constructor(path: string) {
    this.path = path;
  }

  static file(path: string): Uri {
    return new Uri(path);
  }

  static parse(value: string): Uri {
    return new Uri(value.replace(/^file:\/\//, ""));
  }

  get fsPath(): string {
    return this.path;
  }

  toString(): string {
    return `file://${this.path}`;
  }
}

export class Range {
  readonly start: number;
  readonly end: number;

  constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
}

type Operation = { kind: "replace"; uri: Uri; text: string } | { kind: "delete"; uri: Uri };

export class WorkspaceEdit {
  readonly operations: Operation[] = [];

  replace(uri: Uri, _range: Range, text: string): void {
    this.operations.push({ kind: "replace", uri, text });
  }

  deleteFile(uri: Uri): void {
    this.operations.push({ kind: "delete", uri });
  }
}

function document(uri: Uri) {
  return {
    uri,
    getText: () => files.get(uri.path) ?? "",
    positionAt: (offset: number) => offset,
    save: async () => true,
  };
}

export const workspace = {
  asRelativePath: (uri: Uri) => uri.path.replace(/^\/ws\//, ""),
  openTextDocument: async (uri: Uri) => {
    if (!files.has(uri.path)) throw new Error(`missing ${uri.path}`);
    return document(uri);
  },
  applyEdit: async (edit: WorkspaceEdit) => {
    for (const operation of edit.operations) {
      if (operation.kind === "replace") files.set(operation.uri.path, operation.text);
      else files.delete(operation.uri.path);
    }
    return true;
  },
};
