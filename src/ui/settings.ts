import * as vscode from "vscode";
import type { AnvilSettings } from "../shared/protocol.ts";

type Config = Pick<vscode.WorkspaceConfiguration, "get">;

export const SETTING_KEYS: Record<keyof AnvilSettings, string> = {
  chain: "models.chain",
  reasoningEffort: "models.reasoningEffort",
  reviewMode: "review.mode",
  autoApprove: "commands.autoApprove",
  budgetTokens: "context.budgetTokens",
  iterationLimit: "agent.iterationLimit",
  commandTimeoutSeconds: "commands.timeoutSeconds",
  failoverSeconds: "resilience.firstEventTimeoutSeconds",
  promptProfile: "agent.promptProfile",
  harnessUrl: "harness.url",
  harnessAutoStart: "harness.autoStart",
  selectionToolbar: "selection.askActions",
  selectionAutoAttach: "selection.autoAttach",
};

const DEFAULTS: AnvilSettings = {
  chain: [],
  reasoningEffort: "default",
  reviewMode: "review",
  autoApprove: [],
  budgetTokens: 6000,
  iterationLimit: 60,
  commandTimeoutSeconds: 120,
  failoverSeconds: 45,
  promptProfile: "auto",
  harnessUrl: "http://localhost:8790",
  harnessAutoStart: true,
  selectionToolbar: true,
  selectionAutoAttach: true,
};

export function readSettings(config: Config = vscode.workspace.getConfiguration("anvil")): AnvilSettings {
  const entries = Object.entries(SETTING_KEYS).map(([field, key]) => [field, config.get(key, DEFAULTS[field as keyof AnvilSettings])]);
  const settings = Object.fromEntries(entries) as AnvilSettings;
  return { ...settings, chain: settings.chain.filter(Boolean) };
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  const config = vscode.workspace.getConfiguration("anvil");
  const target = config.inspect(key)?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  await config.update(key, value, target);
}

export async function writeSettings(patch: Partial<AnvilSettings>): Promise<void> {
  for (const [field, value] of Object.entries(patch)) if (field in SETTING_KEYS) await writeSetting(SETTING_KEYS[field as keyof AnvilSettings], value);
}
