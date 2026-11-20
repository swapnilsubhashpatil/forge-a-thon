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

interface Saved {
  draft?: Draft;
  settingsTab?: string;
}

function saved(): Saved {
  return (vscode().getState() as Saved | undefined) ?? {};
}

export function loadDraft(): Draft {
  return saved().draft ?? { text: "", mentions: [] };
}

export function saveDraft(draft: Draft): void {
  vscode().setState({ ...saved(), draft });
}

export function loadSettingsTab(): string | undefined {
  return saved().settingsTab;
}

export function saveSettingsTab(settingsTab: string): void {
  vscode().setState({ ...saved(), settingsTab });
}
