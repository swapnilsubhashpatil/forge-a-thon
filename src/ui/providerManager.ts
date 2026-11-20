import type { ConversationStore } from "../agent/conversationStore.ts";
import type { HarnessClient, ProviderDraft } from "../harness/harnessClient.ts";
import type { WebviewMessage } from "../shared/protocol.ts";
import { readSettings, SETTING_KEYS, writeSetting } from "./settings.ts";

type ProviderMessage = Extract<WebviewMessage, { type: "addProvider" | "removeProvider" | "setProviderModels" | "refreshProviders" }>;

const uniqueIds = (ids: string[]) => [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

export function providerDraft(message: Extract<ProviderMessage, { type: "addProvider" }>): ProviderDraft | string {
  const custom = message.providerType === "custom";
  const name = custom ? message.name.trim() || "custom" : message.providerType;
  const models = uniqueIds(message.models);
  const apiKey = message.apiKey?.trim() || undefined;
  const baseUrl = message.baseUrl?.trim() || undefined;
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) return "Name must be lowercase letters, digits and dashes, starting with a letter or digit.";
  if (custom) {
    try {
      if (!["http:", "https:"].includes(new URL(baseUrl ?? "").protocol)) return "Base URL must start with http:// or https://.";
    } catch {
      return "Base URL is not valid.";
    }
  } else if (!apiKey) {
    return "An API key is required.";
  }
  if (!models.length) return "Pick at least one model.";
  return { providerType: message.providerType, name, apiKey, baseUrl, models };
}

export class ProviderManager {
  private readonly client: () => HarnessClient;
  private readonly store: ConversationStore;

  constructor(client: () => HarnessClient, store: ConversationStore) {
    this.client = client;
    this.store = store;
  }

  async refresh(): Promise<void> {
    const client = this.client();
    const [providers, catalog, models] = await Promise.all([client.listProviders(), client.providerCatalog(), client.listModels()]);
    this.store.update((state) => {
      state.providers = providers;
      state.catalog = catalog;
      state.availableModels = models;
      state.providerError = undefined;
    });
  }

  async handle(message: ProviderMessage): Promise<void> {
    try {
      if (message.type === "addProvider") {
        const draft = providerDraft(message);
        if (typeof draft === "string") return this.fail(draft);
        await this.client().addProvider(draft);
      } else if (message.type === "removeProvider") {
        await this.client().removeProvider(message.name);
      } else if (message.type === "setProviderModels") {
        const ids = uniqueIds(message.models);
        if (!ids.length) return this.fail("A provider needs at least one model.");
        await this.client().setProviderModels(message.name, ids);
        await this.dropFromChain(message.name, ids);
      }
      await this.refresh();
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  private async dropFromChain(name: string, kept: string[]): Promise<void> {
    const provider = this.store.state.providers.find((entry) => entry.name === name);
    const removed = provider?.models.filter((_, index) => !kept.includes(provider.modelIds[index])) ?? [];
    const chain = readSettings().chain;
    if (chain.some((model) => removed.includes(model))) await writeSetting(SETTING_KEYS.chain, chain.filter((model) => !removed.includes(model)));
  }

  private fail(error: string): void {
    this.store.update((state) => {
      state.providerError = error;
    });
  }
}
