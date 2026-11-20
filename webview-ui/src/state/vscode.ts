import type { Attachment, WebviewMessage } from "../../../src/shared/protocol.ts";

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export interface Draft {
  text: string;
  mentions: string[];
  skill?: string;
  attachments?: Attachment[];
}

let api: VsCodeApi | undefined;

function vscode(): VsCodeApi {
  api ??= acquireVsCodeApi();
  return api;
}

export function post(message: WebviewMessage): void {
  vscode().postMessage(message);
}

export function loadDraft(): Draft {
  const saved = vscode().getState() as { draft?: Draft } | undefined;
  return saved?.draft ?? { text: "", mentions: [] };
}

export function saveDraft(draft: Draft): void {
  vscode().setState({ draft });
}
