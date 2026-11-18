import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";
import { EventLog, type ApprovalDecision, type HarnessClient, type HarnessEvent } from "../harness/harnessClient.ts";
import type { ChangeLedger } from "../edits/changeLedger.ts";
import type { ReviewController } from "../edits/reviewController.ts";
import type { ContextReport, ModelHealth, ToolStep, Turn } from "../shared/protocol.ts";
import type { AgentMode, AgentProfiles } from "./agentProfile.ts";
import type { ConversationStore } from "./conversationStore.ts";
import { EDIT_TOOLS, type EditCoordinator } from "./editCoordinator.ts";
import { backoffDelay, classifyFailure, describeFailure, truncationRetryTokens, type CircuitBreaker, type Failure } from "./resilience.ts";
import { describeToolCall, extractText, parseArguments } from "./toolCallView.ts";

export interface TurnRequest {
  mode: AgentMode;
  title: string;
  prompt: string;
  mentions: string[];
  message: string;
  context?: ContextReport;
}

export interface RunnerSettings {
  modelChain: string[];
  firstEventTimeoutMs: number;
  iterationLimit: number;
  reasoningEffort?: string;
  toolServerName: string;
}

export interface TurnRunnerDeps {
  client: () => HarnessClient;
  store: ConversationStore;
  profiles: AgentProfiles;
  breaker: CircuitBreaker;
  edits: EditCoordinator;
  ledger: ChangeLedger;
  review: ReviewController;
  settings: () => RunnerSettings;
  onBusyChange: (busy: boolean) => void;
  log: (line: string) => void;
}

type AttemptResult =
  | { kind: "done" }
  | { kind: "cancelled" }
  | { kind: "failed"; failure: Failure }
  | { kind: "harness"; message: string; sessionMissing: boolean };

interface ActiveTurn {
  turnId: string;
  abort: AbortController;
  cancelled: boolean;
  sessionId?: string;
  approvals: Map<string, (allow: boolean) => void>;
}

interface AgentSession {
  id: string;
  specKey: string;
  lastCompletedTurnId?: string;
}

interface SpecOverrides {
  reasoningEffort?: string;
  maxTokens?: number;
}

const MAIN_THREAD = "main";
const MAX_OUTPUT_CHARS = 4_000;
const MAX_RESUMES = 200;

export class TurnRunner {
  private readonly deps: TurnRunnerDeps;
  private agentSession: AgentSession | undefined;
  private active: ActiveTurn | undefined;
  private starting = false;
  private readonly healthy = new Set<string>();
  private readonly threadTitles = new Map<string, string>();
  private turnCounter = 0;

  constructor(deps: TurnRunnerDeps) {
    this.deps = deps;
  }

  get busy(): boolean {
    return this.active !== undefined || this.starting;
  }

  markStarting(starting: boolean): void {
    this.starting = starting;
    this.deps.store.update((state) => {
      state.busy = starting || this.active !== undefined;
    });
  }

  currentContext(): ContextReport | undefined {
    const turns = this.deps.store.state.turns;
    return turns[turns.length - 1]?.context;
  }

  noteFileRead(path: string): void {
    const context = this.currentContext();
    if (!context || context.files.some((file) => file.path === path) || context.fetched.includes(path)) return;
    this.deps.store.update(() => context.fetched.push(path));
  }

  resetSession(): void {
    this.agentSession = undefined;
    this.deps.store.reset();
  }

  refreshModelHealth(): void {
    const { breaker } = this.deps;
    const models: ModelHealth[] = this.deps.settings().modelChain.map((model) => ({
      model,
      state: breaker.isOpen(model) ? "cooling" : this.healthy.has(model) ? "healthy" : "unknown",
      coolingUntil: breaker.coolingUntil(model),
      lastError: breaker.lastError(model),
    }));
    this.deps.store.update((state) => {
      state.models = models;
      if (!this.active) state.activeModel = breaker.order(models.map((entry) => entry.model))[0];
    });
  }

  async run(request: TurnRequest): Promise<void> {
    if (this.active) throw new Error("A turn is already running. Cancel it first.");
    const { store, ledger, edits, breaker } = this.deps;
    this.turnCounter += 1;
    const turnId = `turn-${Date.now().toString(36)}-${this.turnCounter}`;
    const active: ActiveTurn = { turnId, abort: new AbortController(), cancelled: false, approvals: new Map() };
    this.active = active;
    this.starting = false;
    this.deps.onBusyChange(true);

    const turn: Turn = {
      id: turnId,
      prompt: request.prompt,
      mentions: request.mentions,
      context: request.context,
      steps: [],
      status: "running",
      model: "",
      usage: { input: 0, output: 0, cached: 0 },
      startedAt: Date.now(),
    };
    store.update((state) => {
      state.turns.push(turn);
      state.busy = true;
    });
    const changeSetId = ledger.begin(request.title);
    edits.beginTurn(changeSetId);

    try {
      const chain = this.deps.settings().modelChain;
      if (!chain.length) {
        store.notice(turnId, "error", "No models configured. Run “Anvil: Configure Model Fallback Chain” or add a model provider in TrueForge.");
        this.finish(turn, "error");
        return;
      }
      let previous: { model: string; failure: Failure } | undefined;
      for (const model of breaker.order(chain)) {
        if (previous) {
          store.notice(turnId, "warning", `${previous.model} ${describeFailure(previous.failure)} (${previous.failure.message}). Switched to ${model}.`);
        } else if (breaker.isOpen(model)) {
          store.notice(turnId, "warning", `Every model is cooling down after recent failures. Retrying ${model}.`);
        }
        store.update((state) => {
          turn.model = model;
          state.activeModel = model;
        });
        let result = await this.attempt(request, model, turn, active);
        if (result.kind === "harness" && result.sessionMissing && request.mode === "agent" && !active.cancelled) {
          this.agentSession = undefined;
          store.notice(turnId, "info", "The TrueForge session was no longer available. Started a new session.");
          result = await this.attempt(request, model, turn, active);
        }
        if (result.kind === "failed" && result.failure.retrySameModel && !active.cancelled) {
          store.notice(turnId, "info", `${model} ${describeFailure(result.failure)}. Retrying once.`);
          await delay(backoffDelay(0));
          result = await this.attempt(request, model, turn, active);
        }
        if (result.kind === "failed" && result.failure.kind === "truncated" && !active.cancelled) {
          const maxTokens = truncationRetryTokens(this.deps.profiles.maxTokens(request.mode));
          store.notice(turnId, "info", `${model} ${describeFailure(result.failure)}. Retrying once with reasoning off and ${maxTokens.toLocaleString("en-US")} output tokens.`);
          result = await this.attempt(request, model, turn, active, { reasoningEffort: "none", maxTokens });
        }
        if (result.kind === "done") {
          breaker.reset(model);
          this.healthy.add(model);
          this.finish(turn, "done");
          return;
        }
        if (result.kind === "cancelled" || active.cancelled) {
          this.finish(turn, "cancelled");
          return;
        }
        if (result.kind === "harness") {
          store.notice(turnId, "error", `TrueForge request failed: ${result.message}. Models were not blamed; check the harness and press Reconnect if needed.`);
          this.finish(turn, "error");
          return;
        }
        if (result.failure.kind !== "context" && result.failure.kind !== "truncated") breaker.trip(model, result.failure.message);
        this.healthy.delete(model);
        this.refreshModelHealth();
        this.deps.log(`Model ${model} failed: ${result.failure.message}`);
        previous = { model, failure: result.failure };
      }
      const workspaceNote = ledger.hasWrites(changeSetId)
        ? "Changes you accepted before the failure were kept; use Undo to revert them."
        : "Your files were not modified.";
      store.notice(turnId, "error", `All models in the fallback chain failed. Last error: ${previous?.failure.message ?? "unknown"}. ${workspaceNote}`);
      this.finish(turn, "error");
    } catch (error) {
      store.notice(turnId, "error", error instanceof Error ? error.message : String(error));
      this.finish(turn, "error");
    } finally {
      edits.forget();
      this.active = undefined;
      store.update((state) => {
        state.busy = false;
      });
      this.refreshModelHealth();
      store.flush();
      this.deps.onBusyChange(false);
    }
  }

  async cancel(): Promise<void> {
    const active = this.active;
    if (!active || active.cancelled) return;
    active.cancelled = true;
    active.abort.abort();
    this.deps.edits.cancelPending();
    for (const resolve of active.approvals.values()) resolve(false);
    active.approvals.clear();
    await this.deps.review.discardAll();
    if (active.sessionId) {
      await this.deps.client().cancel(active.sessionId).catch((error: unknown) => this.deps.log(`Cancel request failed: ${String(error)}`));
    }
  }

  resolveApproval(approvalKey: string, allow: boolean): void {
    const resolve = this.active?.approvals.get(approvalKey);
    if (!resolve) return;
    this.active?.approvals.delete(approvalKey);
    resolve(allow);
  }

  private finish(turn: Turn, status: Turn["status"]): void {
    this.deps.store.update(() => {
      turn.status = status;
      turn.endedAt = Date.now();
      for (const step of turn.steps) {
        if (step.kind === "tool" && (step.status === "running" || step.status === "awaiting-approval")) {
          step.status = status === "done" ? "done" : "error";
        }
        if (step.kind === "approval" && step.status === "pending") step.status = "denied";
        if (step.kind === "subagent" && step.status === "running") step.status = status === "done" ? "done" : "error";
      }
    });
  }

  private specOptions(overrides: SpecOverrides = {}) {
    const settings = this.deps.settings();
    return {
      toolServerName: settings.toolServerName,
      iterationLimit: settings.iterationLimit,
      reasoningEffort: overrides.reasoningEffort ?? settings.reasoningEffort,
      maxTokens: overrides.maxTokens,
    };
  }

  private async ensureSession(request: TurnRequest, model: string, active: ActiveTurn, overrides: SpecOverrides): Promise<{ id: string; previousTurnId: string }> {
    const client = this.deps.client();
    const spec = this.deps.profiles.spec(request.mode, model, this.specOptions(overrides));
    const specKey = JSON.stringify([model, overrides.reasoningEffort ?? null, overrides.maxTokens ?? null]);
    if (request.mode === "inline") {
      const id = await client.createSession(spec, request.title);
      active.sessionId = id;
      return { id, previousTurnId: "none" };
    }
    if (this.agentSession && this.agentSession.specKey !== specKey) {
      try {
        await client.updateSessionSpec(this.agentSession.id, spec);
        this.agentSession.specKey = specKey;
      } catch (error) {
        this.deps.log(`Could not switch the session model, starting a new session: ${errorText(error)}`);
        this.agentSession = undefined;
      }
    }
    if (!this.agentSession) {
      const id = await client.createSession(spec, request.title);
      this.agentSession = { id, specKey };
      this.deps.store.update((state) => {
        state.sessionId = id;
        state.sessionUrl = client.sessionUrl(id);
      });
    }
    active.sessionId = this.agentSession.id;
    return { id: this.agentSession.id, previousTurnId: this.agentSession.lastCompletedTurnId ?? "none" };
  }

  private async attempt(request: TurnRequest, model: string, turn: Turn, active: ActiveTurn, overrides: SpecOverrides = {}): Promise<AttemptResult> {
    if (active.cancelled) return { kind: "cancelled" };
    const client = this.deps.client();
    const attemptAbort = new AbortController();
    const onCancel = () => attemptAbort.abort();
    active.abort.signal.addEventListener("abort", onCancel);
    let timedOut = false;
    let sessionId: string | undefined;
    const watchdog = setTimeout(() => {
      timedOut = true;
      attemptAbort.abort();
      if (sessionId) void client.cancel(sessionId).catch(() => undefined);
    }, this.deps.settings().firstEventTimeoutMs);
    const disarm = () => clearTimeout(watchdog);

    try {
      const session = await this.ensureSession(request, model, active, overrides);
      sessionId = session.id;
      const log = new EventLog();
      const answered = new Set<string>();
      const pending: TrueForgeApi.ToolApprovalRequiredEvent[] = [];
      let harnessTurnId: string | undefined;
      let pauseReason: string | undefined;
      let stream = await client.startTurn(session.id, request.message, session.previousTurnId, attemptAbort.signal);
      for (let resumes = 0; resumes < MAX_RESUMES; resumes += 1) {
        let paused = false;
        for await (const raw of stream) {
          const event = log.absorb(raw);
          if (!event) continue;
          if (producesOutput(raw)) disarm();
          if (event.type === "turn.created") harnessTurnId = event.turnId;
          if (event.type === "tool.approval_required") pending.push(event);
          if (event.type === "mcp.auth_required") pauseReason = "the Anvil tool server rejected TrueForge's credentials";
          if (event.type === "tool.response_required") pauseReason = "the agent asked for a client-side tool result Anvil does not provide";
          if (event.type === "turn.update" && event.state.status === "paused") {
            paused = true;
            break;
          }
          if (event.type === "turn.done") {
            disarm();
            this.applyMetrics(turn, event.state.metrics);
            if (event.state.status === "done") {
              if (this.agentSession && request.mode === "agent" && harnessTurnId) this.agentSession.lastCompletedTurnId = harnessTurnId;
              return { kind: "done" };
            }
            if (event.state.status === "cancelled") {
              return active.cancelled ? { kind: "cancelled" } : { kind: "failed", failure: classifyFailure(`timeout: turn cancelled by the server (${event.state.reason})`) };
            }
            return { kind: "failed", failure: classifyFailure(event.state.message) };
          }
          this.render(turn, event);
        }
        if (active.cancelled) return { kind: "cancelled" };
        if (!harnessTurnId) return { kind: "harness", message: "the event stream ended before the turn started", sessionMissing: false };
        if (paused) {
          disarm();
          const requests = this.unanswered(pending, answered);
          pending.length = 0;
          if (!requests.length) {
            return { kind: "harness", message: `the turn paused because ${pauseReason ?? "it is waiting for input Anvil cannot provide"}`, sessionMissing: false };
          }
          this.setPaused(turn, true);
          const decisions = await this.decide(requests, log, turn, active);
          this.setPaused(turn, false);
          if (active.cancelled) return { kind: "cancelled" };
          await client.answerApprovals(session.id, harnessTurnId, decisions);
          for (const request of requests) answered.add(request.key);
        }
        stream = await client.resumeTurn(session.id, harnessTurnId, log.lastEventId, attemptAbort.signal);
      }
      return { kind: "harness", message: "the turn did not finish after repeated resumes", sessionMissing: false };
    } catch (error) {
      if (active.cancelled) return { kind: "cancelled" };
      if (timedOut) {
        return { kind: "failed", failure: classifyFailure(`timeout: no model output within ${Math.round(this.deps.settings().firstEventTimeoutMs / 1000)}s`) };
      }
      const status = (error as { statusCode?: number } | undefined)?.statusCode;
      const message = errorText(error);
      return { kind: "harness", message, sessionMissing: status === 404 && /session/i.test(message) };
    } finally {
      disarm();
      active.abort.signal.removeEventListener("abort", onCancel);
    }
  }

  private unanswered(pending: TrueForgeApi.ToolApprovalRequiredEvent[], answered: Set<string>) {
    const seen = new Set<string>();
    const requests: Array<{ key: string; threadId: string; ref: TrueForgeApi.ToolCallRef }> = [];
    for (const event of pending) {
      for (const ref of event.toolCalls) {
        const key = `${event.threadId}:${ref.id}`;
        if (answered.has(key) || seen.has(key)) continue;
        seen.add(key);
        requests.push({ key, threadId: event.threadId, ref });
      }
    }
    return requests;
  }

  private setPaused(turn: Turn, paused: boolean): void {
    this.deps.store.update(() => {
      if (turn.status === "running" || turn.status === "paused") turn.status = paused ? "paused" : "running";
    });
  }

  private async decide(
    requests: Array<{ key: string; threadId: string; ref: TrueForgeApi.ToolCallRef }>,
    log: EventLog,
    turn: Turn,
    active: ActiveTurn,
  ): Promise<ApprovalDecision[]> {
    return Promise.all(requests.map(async ({ key, threadId, ref }) => {
      const base = { threadId, toolCallId: ref.id };
      const source = log.get(ref.sourceEventId);
      const call = source?.type === "model.message" ? source.toolCalls?.find((candidate) => candidate.id === ref.id) : undefined;
      if (!call) {
        return { ...base, allow: false, reason: "Anvil could not display this tool call for review, so it was not approved. Try again." };
      }
      const { name, args } = parseArguments(call.function.name, call.function.arguments ?? "{}");
      this.upsertTool(turn, { id: ref.id, status: "awaiting-approval" }, name, args, threadId);

      if (EDIT_TOOLS.has(name)) {
        const result = await this.deps.edits.resolve(name, args);
        const reason = active.cancelled ? "The user cancelled the turn." : this.deps.edits.denialReason(result);
        if (reason) this.deps.edits.drop(name, args);
        this.upsertTool(turn, {
          id: ref.id,
          status: reason ? "denied" : "running",
          diff: result.ok && result.outcome.accepted > 0 ? result.outcome.stat : undefined,
          output: reason,
        }, name, args, threadId);
        return reason ? { ...base, allow: false, reason } : { ...base, allow: true };
      }

      const view = describeToolCall(name, args);
      const approvalId = `approval-${key}`;
      const detail = typeof args.command === "string" ? args.command : JSON.stringify(args, null, 2);
      this.deps.store.upsertStep(turn.id, { kind: "approval", id: approvalId, toolCallId: key, toolName: name, title: view.title, detail, status: "pending" });
      const allow = active.cancelled ? false : await new Promise<boolean>((resolve) => active.approvals.set(key, resolve));
      this.deps.store.upsertStep(turn.id, { kind: "approval", id: approvalId, toolCallId: key, toolName: name, title: view.title, detail, status: allow ? "allowed" : "denied" });
      this.upsertTool(turn, { id: ref.id, status: allow ? "running" : "denied" }, name, args, threadId);
      return allow ? { ...base, allow: true } : { ...base, allow: false, reason: "The user declined to run this. Continue without it or ask what they prefer." };
    }));
  }

  private render(turn: Turn, event: HarnessEvent): void {
    const { store } = this.deps;
    switch (event.type) {
      case "model.message": {
        const threadId = event.threadId;
        if (threadId === MAIN_THREAD) {
          const text = extractText(event.content);
          if (text.trim()) store.upsertStep(turn.id, { kind: "text", id: event.id, text });
          if (event.reasoningContent?.trim()) store.upsertStep(turn.id, { kind: "reasoning", id: `${event.id}-reasoning`, text: event.reasoningContent });
        }
        for (const call of event.toolCalls ?? []) {
          if (!call.function?.name) continue;
          const { name, args } = parseArguments(call.function.name, call.function.arguments ?? "");
          this.upsertTool(turn, { id: call.id }, name, args, threadId);
        }
        break;
      }
      case "tool.response": {
        const failed = /^(Error:|Edit not applied)/.test(event.content);
        store.update(() => {
          const step = turn.steps.find((candidate): candidate is ToolStep => candidate.kind === "tool" && candidate.id === event.toolCallId);
          if (!step) return;
          if (step.status !== "denied") step.status = failed ? "error" : "done";
          step.output = event.content.length > MAX_OUTPUT_CHARS ? `${event.content.slice(0, MAX_OUTPUT_CHARS)}\n…` : event.content;
        });
        break;
      }
      case "thread.created":
        this.threadTitles.set(event.threadId, event.title);
        store.upsertStep(turn.id, { kind: "subagent", id: event.threadId, title: event.title, status: "running" });
        break;
      case "thread.done":
        store.upsertStep(turn.id, { kind: "subagent", id: event.threadId, title: event.title, status: event.state.status === "done" ? "done" : "error" });
        break;
      case "thread.context_compaction_started":
        store.notice(turn.id, "info", "Compacting earlier conversation to stay within the context window.");
        break;
      case "thread.context_compaction_finished":
        store.notice(turn.id, "success", "Context compacted. The agent keeps a summary of earlier steps.");
        break;
      default:
        break;
    }
  }

  private upsertTool(turn: Turn, patch: Partial<ToolStep> & { id: string }, name: string, args: Record<string, unknown>, threadId: string): void {
    const view = describeToolCall(name, args);
    const threadTitle = threadId !== MAIN_THREAD ? this.threadTitles.get(threadId) : undefined;
    this.deps.store.upsertStep<ToolStep>(turn.id, { kind: "tool", name, status: "running", ...view, threadTitle, ...patch }, (step) => {
      Object.assign(step, view, { threadTitle }, patch);
    });
  }

  private applyMetrics(turn: Turn, metrics: TrueForgeApi.TurnMetrics | undefined): void {
    if (!metrics) return;
    this.deps.store.update(() => {
      turn.usage.input += metrics.totalInputTokens ?? 0;
      turn.usage.output += metrics.totalOutputTokens ?? 0;
      turn.usage.cached += metrics.totalCacheReadTokens ?? 0;
    });
  }
}

function producesOutput(event: HarnessEvent): boolean {
  if (event.type === "model.message.delta") return Boolean(event.content || event.reasoningContent || event.toolCalls?.length);
  if (event.type === "model.message") return Boolean(extractText(event.content) || event.reasoningContent || event.toolCalls?.length);
  return event.type === "tool.response" || event.type === "tool.approval_required" || event.type === "thread.created";
}

function errorText(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as { statusCode?: number; body?: unknown; message?: string };
    const body = record.body ? JSON.stringify(record.body) : "";
    return [record.statusCode ? `HTTP ${record.statusCode}` : "", record.message ?? "", body].filter(Boolean).join(" ");
  }
  return String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
