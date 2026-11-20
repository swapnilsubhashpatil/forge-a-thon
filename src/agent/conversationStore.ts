import type { AnvilSettings, ChatState, NoticeStep, NoticeTone, Step, Turn } from "../shared/protocol.ts";

const EMIT_INTERVAL_MS = 33;

export class ConversationStore {
  readonly state: ChatState;
  private readonly listeners = new Set<(state: ChatState) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private noticeCounter = 0;
  readonly offstage = new Map<string, Turn>();

  constructor(harnessUrl: string, settings: AnvilSettings) {
    this.state = {
      mode: "agent",
      history: [],
      pendingReviews: [],
      settings,
      mcpServers: [],
      providers: [],
      catalog: [],
      skills: [],
      turns: [],
      harness: { state: "connecting", url: harnessUrl },
      models: [],
      busy: false,
      changeSets: [],
      queue: [],
    };
  }

  subscribe(listener: (state: ChatState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  update(mutate: (state: ChatState) => void): void {
    mutate(this.state);
    this.schedule();
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const listener of this.listeners) listener(this.state);
  }

  turn(turnId: string): Turn | undefined {
    return this.state.turns.find((turn) => turn.id === turnId) ?? this.offstage.get(turnId);
  }

  upsertStep<T extends Step>(turnId: string, step: T, merge?: (existing: T) => void): void {
    this.update(() => {
      const turn = this.turn(turnId);
      if (!turn) return;
      const existing = turn.steps.find((candidate) => candidate.id === step.id && candidate.kind === step.kind) as T | undefined;
      if (existing && merge) merge(existing);
      else if (existing) Object.assign(existing, step);
      else turn.steps.push(step);
    });
  }

  notice(turnId: string, tone: NoticeTone, text: string, failover?: NoticeStep["failover"]): void {
    this.noticeCounter += 1;
    this.upsertStep(turnId, { kind: "notice", id: `notice-${this.noticeCounter}`, tone, text, failover });
  }

  reset(): void {
    this.update((state) => {
      state.turns = [];
      state.queue = [];
      state.sessionId = undefined;
      state.sessionUrl = undefined;
      state.busy = false;
    });
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      for (const listener of this.listeners) listener(this.state);
    }, EMIT_INTERVAL_MS);
  }
}
