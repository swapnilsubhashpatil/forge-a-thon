import * as vscode from "vscode";
import type { ConversationStore } from "../agent/conversationStore.ts";
import type { HarnessClient } from "../harness/harnessClient.ts";
import type { McpServerInfo, WebviewMessage } from "../shared/protocol.ts";

type McpMessage = Extract<WebviewMessage, { type: "addMcpServer" | "testMcpServer" | "removeMcpServer" | "toggleMcpServer" }>;

const DISABLED_KEY = "mcp.disabled";
const TEST_TIMEOUT_SECONDS = 15;
const OWN_PREFIX = "anvil-editor-";

export function mcpServerProblem(name: string, url: string): string | undefined {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) return "Name must be lowercase letters, digits and dashes, starting with a letter or digit.";
  if (name.startsWith(OWN_PREFIX)) return `Names starting with ${OWN_PREFIX} are reserved for Anvil.`;
  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) return "URL must start with http:// or https://.";
  } catch {
    return "URL is not valid.";
  }
  return undefined;
}

export class McpManager {
  private readonly client: () => HarnessClient;
  private readonly store: ConversationStore;

  constructor(client: () => HarnessClient, store: ConversationStore) {
    this.client = client;
    this.store = store;
  }

  enabledNames(): string[] {
    return this.store.state.mcpServers.filter((server) => server.enabled && server.status !== "error").map((server) => server.name);
  }

  async refresh(): Promise<void> {
    const configured = await this.client().listMcpServers();
    const disabled = new Set(disabledNames());
    const known = new Map(this.store.state.mcpServers.map((server) => [server.name, server]));
    this.store.update((state) => {
      state.mcpServers = configured
        .filter((server) => !server.name.startsWith(OWN_PREFIX))
        .map((server) => {
          const previous = known.get(server.name);
          const same = previous?.url === server.url;
          return { ...server, enabled: !disabled.has(server.name), status: same ? previous.status : "unknown", tools: same ? previous.tools : undefined, error: same ? previous.error : undefined };
        });
    });
  }

  register(): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(`anvil.${DISABLED_KEY}`)) return;
      const disabled = new Set(disabledNames());
      this.store.update((state) => {
        for (const server of state.mcpServers) server.enabled = !disabled.has(server.name);
      });
    });
  }

  async handle(message: McpMessage): Promise<void> {
    switch (message.type) {
      case "addMcpServer":
        return this.add(message);
      case "testMcpServer":
        return this.test(message.name);
      case "removeMcpServer":
        return this.remove(message.name);
      case "toggleMcpServer":
        return this.toggle(message.name, message.enabled);
    }
  }

  private async add(message: Extract<McpMessage, { type: "addMcpServer" }>): Promise<void> {
    const name = message.name.trim();
    const url = message.url.trim();
    const problem = mcpServerProblem(name, url);
    if (problem) return this.showDraft(name, url, message.description, problem);
    const header = message.headerName?.trim() && message.headerValue ? { name: message.headerName.trim(), value: message.headerValue } : undefined;
    try {
      await this.client().addMcpServer(name, url, message.description?.trim() || "", header);
    } catch (error) {
      return this.showDraft(name, url, message.description, `Could not add: ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.refresh().catch(() => undefined);
    await this.test(name);
  }

  private async test(name: string): Promise<void> {
    this.patch(name, { status: "testing", error: undefined });
    try {
      const tools = await this.client().listMcpTools(name, TEST_TIMEOUT_SECONDS);
      this.patch(name, { status: "ok", tools, error: undefined });
    } catch (error) {
      this.patch(name, { status: "error", tools: undefined, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async remove(name: string): Promise<void> {
    if (name.startsWith(OWN_PREFIX)) return;
    const failure = await this.client().removeMcpServer(name).then(() => undefined, (error: unknown) => error);
    await this.refresh().catch(() => undefined);
    if (failure) this.patch(name, { status: "error", error: `Could not remove: ${failure instanceof Error ? failure.message : String(failure)}` });
  }

  private async toggle(name: string, enabled: boolean): Promise<void> {
    const disabled = disabledNames().filter((entry) => entry !== name);
    await vscode.workspace.getConfiguration("anvil").update(DISABLED_KEY, enabled ? disabled : [...disabled, name], vscode.ConfigurationTarget.Global);
    this.patch(name, { enabled });
  }

  private showDraft(name: string, url: string, description: string | undefined, error: string): void {
    this.store.update((state) => {
      state.mcpServers = [...state.mcpServers.filter((server) => server.name !== name), { name, url, description, enabled: !disabledNames().includes(name), status: "error", error }];
    });
  }

  private patch(name: string, change: Partial<McpServerInfo>): void {
    this.store.update((state) => {
      const server = state.mcpServers.find((entry) => entry.name === name);
      if (server) Object.assign(server, change);
    });
  }
}

function disabledNames(): string[] {
  return vscode.workspace.getConfiguration("anvil").get<string[]>(DISABLED_KEY, []);
}
