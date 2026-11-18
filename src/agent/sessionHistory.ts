import type { ConversationSummary, Turn } from "../shared/protocol.ts";

const KEY = "anvil.history";
const MAX_CONVERSATIONS = 30;
const TITLE_CHARS = 60;

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  turns: Turn[];
  sessionId?: string;
  lastTurnId?: string;
  model?: string;
  edits: number;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

export class SessionHistory {
  private readonly memento: Memento;

  constructor(memento: Memento) {
    this.memento = memento;
  }

  get(id: string): Conversation | undefined {
    return this.all().find((conversation) => conversation.id === id);
  }

  async save(conversation: Conversation): Promise<void> {
    const rest = this.all().filter((entry) => entry.id !== conversation.id);
    await this.write([conversation, ...rest]);
  }

  async delete(id: string): Promise<void> {
    await this.write(this.all().filter((entry) => entry.id !== id));
  }

  summaries(): ConversationSummary[] {
    return this.all().map(({ id, title, updatedAt, turns, model, edits }) => ({ id, title, updatedAt, turns: turns.length, model, edits }));
  }

  private all(): Conversation[] {
    return this.memento.get<Conversation[]>(KEY) ?? [];
  }

  private write(conversations: Conversation[]): Thenable<void> {
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
    return this.memento.update(KEY, sorted);
  }
}

export function conversationTitle(prompt: string): string {
  const line = prompt.trim().replace(/\s+/g, " ");
  return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS - 1)}…` : line;
}
