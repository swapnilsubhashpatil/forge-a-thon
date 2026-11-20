import { TrueForge, isEventDelta, mergeEventDelta, type TrueForgeApi } from "@truefoundry/trueforge-sdk";

export type HarnessEvent = TrueForgeApi.TurnStreamingEvent;
export type AgentSpec = TrueForgeApi.AgentSpec;
export type MessageContent = TrueForgeApi.UserMessageContent;

const STREAM_TIMEOUT_SECONDS = 600;

export interface ApprovalDecision {
  threadId: string;
  toolCallId: string;
  allow: boolean;
  reason?: string;
}

export interface ConfiguredServer {
  name: string;
  url: string;
  description?: string;
}

export function harnessErrorMessage(error: unknown): string {
  const body = (error as { body?: { error?: { message?: unknown } } } | undefined)?.body;
  const message = typeof body?.error?.message === "string" ? body.error.message : error instanceof Error ? error.message : String(error);
  return message.replace(/^\[MCP Error\]\s*/, "").split(": [{")[0].slice(0, 240);
}

export class HarnessClient {
  readonly baseUrl: string;
  private readonly api: TrueForge;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.api = new TrueForge({ baseUrl: this.baseUrl });
  }

  async ping(): Promise<boolean> {
    try {
      await this.api.models.list({ timeoutInSeconds: 3, maxRetries: 0 });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.api.models.list();
    return response.data.map((model) => model.name);
  }

  async registerToolServer(name: string, url: string, token: string): Promise<void> {
    await this.addMcpServer(name, url, "Anvil editor tools served by the VS Code extension", { name: "Authorization", value: `Bearer ${token}` });
  }

  async addMcpServer(name: string, url: string, description = "", header?: { name: string; value: string }): Promise<void> {
    try {
      await this.api.settings.mcpServers.createOrUpdate({
        manifest: { type: "remote", name, description: description.trim() || name, url, ...(header ? { auth: { type: "header", headers: { [header.name]: header.value } } } : {}) },
      });
    } catch (error) {
      throw new Error(harnessErrorMessage(error));
    }
  }

  async removeMcpServer(name: string): Promise<void> {
    await this.api.settings.mcpServers.delete(name);
  }

  async listMcpServers(): Promise<ConfiguredServer[]> {
    const response = await this.api.settings.mcpServers.list();
    return response.data.map((server) => ({ name: server.name, url: server.manifest.url, description: server.manifest.description || undefined }));
  }

  async listMcpTools(name: string, timeoutInSeconds: number): Promise<string[]> {
    try {
      const response = await this.api.mcpServers.listTools(name, { timeoutInSeconds, maxRetries: 0 });
      return response.data.map((tool) => String(tool.name));
    } catch (error) {
      throw new Error(harnessErrorMessage(error));
    }
  }

  async createSession(spec: AgentSpec, title: string): Promise<string> {
    const response = await this.api.sessions.create({ agent: { spec } });
    const id = response.data.id;
    await this.api.sessions.update(id, { title }).catch(() => undefined);
    return id;
  }

  async updateSessionSpec(sessionId: string, spec: AgentSpec): Promise<void> {
    await this.api.sessions.update(sessionId, { agent: { spec } });
  }

  async startTurn(sessionId: string, content: MessageContent, previousTurnId: string, signal: AbortSignal): Promise<AsyncIterable<HarnessEvent>> {
    return this.api.sessions.createTurnStream(
      sessionId,
      { input: [{ type: "user.message", content }], previousTurnId },
      { timeoutInSeconds: STREAM_TIMEOUT_SECONDS, maxRetries: 0, abortSignal: signal },
    );
  }

  async resumeTurn(sessionId: string, turnId: string, afterEventId: string | undefined, signal: AbortSignal): Promise<AsyncIterable<HarnessEvent>> {
    return this.api.sessions.subscribeToTurn(
      sessionId,
      turnId,
      afterEventId ? { afterEventId } : {},
      { timeoutInSeconds: STREAM_TIMEOUT_SECONDS, maxRetries: 0, abortSignal: signal },
    );
  }

  async answerApprovals(sessionId: string, turnId: string, decisions: ApprovalDecision[]): Promise<void> {
    await this.api.sessions.createTurnEvents(sessionId, turnId, {
      events: decisions.map((decision) => ({
        type: "user.tool_approval" as const,
        threadId: decision.threadId,
        toolCallId: decision.toolCallId,
        approval: decision.allow ? { status: "allow" as const } : { status: "deny" as const, reason: decision.reason },
      })),
    });
  }

  async cancel(sessionId: string): Promise<void> {
    await this.api.sessions.cancel(sessionId, {});
  }

  sessionUrl(sessionId: string): string {
    return `${this.baseUrl}/sessions/${sessionId}`;
  }
}

export class EventLog {
  private readonly events = new Map<string, HarnessEvent>();
  lastEventId: string | undefined;

  absorb(event: HarnessEvent): HarnessEvent | undefined {
    if (isEventDelta(event)) {
      const base = this.events.get(event.id);
      if (!base) return undefined;
      mergeEventDelta(base, event);
      return base;
    }
    this.events.set(event.id, event);
    this.lastEventId = event.id;
    return event;
  }

  get(id: string): HarnessEvent | undefined {
    return this.events.get(id);
  }
}
