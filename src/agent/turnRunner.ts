import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";
import { EventLog, type ApprovalDecision, type HarnessClient, type HarnessEvent } from "../harness/harnessClient.ts";
import type { ChangeLedger } from "../edits/changeLedger.ts";
import type { ReviewController } from "../edits/reviewController.ts";
import type { ContextReport, ModelHealth, ToolStep, Turn } from "../shared/protocol.ts";
import type { AgentMode, AgentProfiles, PromptProfile } from "./agentProfile.ts";
import type { ConversationStore } from "./conversationStore.ts";
import { EDIT_TOOLS, type EditCoordinator } from "./editCoordinator.ts";
import { backoffDelay, classifyFailure, describeFailure, truncationRetryTokens, type CircuitBreaker, type Failure } from "./resilience.ts";
import { describeToolCall, extractText, parseArguments } from "./toolCallView.ts";
import { callSignature, deliverQueued, formatNotes, takeLeftovers } from "./noteQueue.ts";
import { mergeRanges, type LineRange, type ScopeFence } from "../edits/scopeFence.ts";
import { killAllCommands } from "../tools/commandRunner.ts";
import { subagentDenial } from "./subagentPolicy.ts";
import { LoopGuard } from "./loopGuard.ts";
import { planReminder, validatePlan } from "./plan.ts";
import { evaluateFinish, needsFinishFollowUp, type FinishArgs, type FollowUpKind, type WorkLog } from "./finishGate.ts";

export interface TurnRequest {
  mode: AgentMode;
  title: string;
  prompt: string;
  mentions: string[];
  message: string;
  context?: ContextReport;
  /** Anvil's own follow-up (M8); never triggers another follow-up. */
  followUp?: boolean;
  /** Inline edits: the selected lines (1-based, inclusive), the G2 fence. */
  selection?: { path: string; start: number; end: number };
}

export interface RunnerSettings {
  modelChain: string[];
  firstEventTimeoutMs: number;
  iterationLimit: number;
  reasoningEffort?: string;
  promptProfile?: PromptProfile;
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
  mode: AgentMode;
  selection?: TurnRequest["selection"];
  abort: AbortController;
  cancelled: boolean;
  /** Cancelled by "Stop and send" rather than Stop. */
  superseded?: boolean;
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
  private noteCounter = 0;
  /** Set when the last turn ended at TrueForge's iteration limit (M10). */
  private hitStepLimit = false;
  /**
   * Main-thread model calls in the running turn, for the turn-budget hint. Keyed by event id: the event log re-emits
   * the same model.message on every streamed delta, so counting events would overcount many times over.
   */
  private readonly mainModelCalls = new Set<string>();
  /** Tool call ids already counted into expectedMain (model.message is re-emitted on every delta). */
  private readonly announcedCalls = new Set<string>();
  /** model.message events whose usage was already added to the live count. */
  private readonly countedUsage = new Set<string>();
  private readonly loopGuard = new LoopGuard();
  /** Session-wide record of accepted edits and commands, so a follow-up turn can verify edits from the turn before. */
  private work: WorkLog = {};
  private turnEdits = 0;
  /** Main-thread edit attempts that could not be applied (no match, missing file), for the M8 follow-up. */
  private failedEdits = 0;
  /** G2: lines of each file the agent has seen this session (read_file ranges). */
  private readonly seen = new Map<string, LineRange[]>();
  /** Files edited this session; their line numbers have shifted, so earlier reads no longer map and they are not fenced. */
  private readonly shifted = new Set<string>();
  /** Subagent threads currently running; while any run, a tool call is only treated as main-thread when announced. */
  private readonly runningSubagents = new Set<string>();
  /** Signatures of main-thread tool calls seen in the event stream and not yet executed. */
  private readonly expectedMain = new Map<string, number>();

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

  noteFileRead(path: string, startLine?: number, endLine?: number): void {
    if (startLine !== undefined && endLine !== undefined) this.seen.set(path, mergeRanges([...(this.seen.get(path) ?? []), { start: startLine, end: endLine }]));
    const context = this.activeContext();
    if (!context) return;
    const inPack = context.files.some((file) => file.path === path);
    const newRead = !context.read.includes(path);
    const newFetch = !inPack && !context.fetched.includes(path);
    if (!newRead && !newFetch) return;
    this.deps.store.update(() => {
      if (newRead) context.read.push(path);
      if (newFetch) context.fetched.push(path);
    });
  }

  noteFileEdited(path: string): void {
    this.work.lastEditAt = Date.now();
    this.loopGuard.reset();
    this.shifted.add(path);
    if (this.active) this.turnEdits += 1;
    const context = this.activeContext();
    if (!context || context.edited.includes(path)) return;
    this.deps.store.update(() => context.edited.push(path));
  }

  /** Context of the running turn only, so late tool calls never touch a finished turn's scorecard. */
  private activeContext(): ContextReport | undefined {
    if (!this.active) return undefined;
    return this.deps.store.state.turns.find((turn) => turn.id === this.active?.turnId)?.context;
  }

  /** Holds a message sent while a turn runs (M11). */
  queueNote(text: string, mentions: string[]): void {
    this.noteCounter += 1;
    const id = `note-${Date.now().toString(36)}-${this.noteCounter}`;
    this.deps.store.update((state) => state.queue.push({ id, text, mentions, status: "queued" }));
  }

  removeNote(id: string): void {
    this.deps.store.update((state) => {
      state.queue = state.queue.filter((note) => note.id !== id || note.status !== "queued");
    });
  }

  /** Takes one queued note out of the queue, e.g. for "Stop and send". */
  takeNote(id: string): { text: string; mentions: string[] } | undefined {
    const note = this.deps.store.state.queue.find((entry) => entry.id === id && entry.status === "queued");
    if (!note) return undefined;
    this.removeNote(id);
    return { text: note.text, mentions: note.mentions };
  }

  /** Undelivered notes, removed from the queue and joined into the next prompt. */
  takeLeftovers(): { text: string; mentions: string[] } | undefined {
    let leftovers: { text: string; mentions: string[] } | undefined;
    this.deps.store.update((state) => {
      leftovers = takeLeftovers(state.queue);
    });
    return leftovers;
  }

  /**
   * Called by the tool server with every tool result. Appends queued notes to the next main-thread result of an
   * agent turn; subagent results and inline turns never carry them.
   */
  decorateToolResult(name: string, args: Record<string, unknown>, result: string): string {
    const active = this.active;
    if (!active || active.cancelled || active.mode !== "agent") return result;
    const signature = callSignature(name, args);
    const announced = this.expectedMain.get(signature) ?? 0;
    if (announced > 0) {
      if (announced === 1) this.expectedMain.delete(signature);
      else this.expectedMain.set(signature, announced - 1);
    }
    const isMain = announced > 0 || this.runningSubagents.size === 0;
    if (!isMain) return result;
    result = this.guardLoop(active, name, args, result);
    if (name !== "update_plan") result += planReminder(this.deps.store.state.turns.find((entry) => entry.id === active.turnId)?.plan) ?? "";
    const limit = this.deps.settings().iterationLimit;
    if (this.mainModelCalls.size * 2 >= limit) result += turnBudget(this.mainModelCalls.size, limit);
    if (!this.deps.store.state.queue.some((note) => note.status === "queued")) return result;
    const turn = this.deps.store.state.turns.find((entry) => entry.id === active.turnId);
    const step = (turn?.steps.filter((entry) => entry.kind === "tool" && entry.threadTitle === undefined).length ?? 0) || 1;
    let delivered: ReturnType<typeof deliverQueued> = [];
    this.deps.store.update((state) => {
      delivered = deliverQueued(state.queue, step, active.turnId);
    });
    if (!delivered.length) return result;
    const label = delivered.length === 1 ? "your message" : `${delivered.length} messages`;
    this.deps.store.notice(active.turnId, "info", `Delivered ${label} to the agent with the result of step ${step}.`);
    return result + formatNotes(delivered);
  }

  /** The update_plan tool (M6): validates, stores the plan on the running turn for the checklist, replies. */
  updatePlan(raw: unknown): string {
    const active = this.active;
    if (!active) return "No task is running.";
    const update = validatePlan(raw);
    if (!update.ok) return update.error;
    const turn = this.deps.store.state.turns.find((entry) => entry.id === active.turnId);
    if (turn) this.deps.store.update(() => {
      turn.plan = update.plan;
    });
    return "Plan updated.";
  }

  /** M7: appends a loop warning, or stops the turn, when the main agent keeps repeating an identical call. */
  private guardLoop(active: ActiveTurn, name: string, args: Record<string, unknown>, result: string): string {
    if (name === "finish_task") return result;
    const verdict = this.loopGuard.record(name, args, result);
    if (verdict.action === "ok") return result;
    if (verdict.action === "nudge") {
      this.deps.store.notice(active.turnId, "warning", `Loop detected: ${name} repeated with the same result. The agent was asked to change approach.`);
      return `${result}\n\n${verdict.message}`;
    }
    this.deps.store.notice(active.turnId, "error", `${verdict.message} The run was stopped; accepted changes were kept.`);
    setTimeout(() => void this.cancel(), 0);
    return `${result}\n\n${verdict.message}`;
  }

  noteCommand(command: string, exitCode: string): void {
    this.work.lastCommand = { command, exitCode, at: Date.now() };
  }

  /** The finish_task tool (M8). Accepted reports are shown on the turn as a verified / not verified chip. */
  finishTask(args: FinishArgs): string {
    const active = this.active;
    if (!active) return "No task is running.";
    const plan = this.deps.store.state.turns.find((entry) => entry.id === active.turnId)?.plan;
    const decision = evaluateFinish(args, this.work, plan);
    if (decision.ok) {
      const turn = this.deps.store.state.turns.find((entry) => entry.id === active.turnId);
      if (turn) this.deps.store.update(() => {
        turn.finish = decision.report;
      });
    }
    return decision.reply;
  }

  /** True once after a turn stopped at the step limit; the caller sends the wrap-up turn. */
  takeWrapUp(): boolean {
    const due = this.hitStepLimit;
    this.hitStepLimit = false;
    return due;
  }

  /** True when the last turn ended with accepted edits but no accepted finish_task, and was not itself a follow-up. */
  needsFinishFollowUp(): FollowUpKind | undefined {
    const turn = this.deps.store.state.turns.at(-1);
    if (!turn || turn.followUp) return undefined;
    return needsFinishFollowUp({ status: turn.status, finish: turn.finish, editedFiles: this.turnEdits, failedEdits: this.failedEdits });
  }

  /**
   * G2 fence for an edit to an existing file: the selection for inline edits, otherwise the lines the agent read or
   * was shown in the pack. Files already edited this session are not fenced (their line numbers moved).
   */
  fenceFor(path: string): ScopeFence | undefined {
    const active = this.active;
    if (!active) return undefined;
    if (active.selection) {
      if (active.selection.path !== path) return { ranges: [], label: "outside selection" };
      return { ranges: [{ start: active.selection.start, end: active.selection.end }], label: "outside selection", slack: 2 };
    }
    if (this.shifted.has(path)) return undefined;
    const context = this.activeContext();
    const fromPack = (context?.slices ?? []).filter((slice) => slice.path === path).map(({ start, end }) => ({ start, end }));
    return { ranges: mergeRanges([...(this.seen.get(path) ?? []), ...fromPack]), label: "edited without reading", slack: 1 };
  }

  /**
   * "Restore" on a past message: rewinds the agent's conversation to just before that turn (TrueForge continues the
   * session from the turn it chained from, so later turns drop out of its history), optionally undoing the code of
   * that turn and every later one, newest first. Files edited by hand since are skipped, never overwritten.
   */
  async restoreTo(turnId: string, withCode: boolean): Promise<{ prompt: string; mentions: string[]; restored: string[]; skipped: string[]; rewound: boolean } | undefined> {
    if (this.busy) throw new Error("Stop the running turn before restoring.");
    const turns = this.deps.store.state.turns;
    const index = turns.findIndex((turn) => turn.id === turnId);
    if (index < 0) return undefined;
    const target = turns[index];
    const later = turns.slice(index).filter((turn) => !turn.reverted);
    const restored: string[] = [];
    const skipped: string[] = [];
    if (withCode) {
      for (const turn of [...later].reverse()) {
        if (!turn.changeSetId) continue;
        const result = await this.deps.ledger.undo(turn.changeSetId);
        restored.push(...result.restored);
        skipped.push(...result.skipped);
      }
    }
    // Rewind the conversation: only possible while the session the turn ran in is still the current one.
    let rewound = false;
    const chain = target.chain;
    if (chain && this.agentSession?.id === chain.sessionId) {
      this.agentSession.lastCompletedTurnId = chain.previousTurnId === "none" ? undefined : chain.previousTurnId;
      rewound = true;
    } else if (chain) {
      this.agentSession = undefined;
      rewound = true;
    }
    this.work = {};
    this.seen.clear();
    this.shifted.clear();
    this.deps.store.update(() => {
      for (const turn of later) turn.reverted = true;
    });
    if (rewound || withCode) {
      const what = withCode ? `Restored the conversation and code to before “${target.prompt.slice(0, 60)}”.` : `Restored the conversation to before “${target.prompt.slice(0, 60)}”; code left as it is.`;
      this.deps.store.notice(target.id, skipped.length ? "warning" : "info", skipped.length ? `${what} Skipped (edited since): ${[...new Set(skipped)].join(", ")}.` : what);
    }
    return { prompt: target.prompt, mentions: target.mentions, restored, skipped, rewound };
  }

  /** Undo only one turn's accepted code changes, leaving the conversation as it is. */
  async undoTurn(turnId: string): Promise<{ restored: string[]; skipped: string[] }> {
    const turn = this.deps.store.state.turns.find((entry) => entry.id === turnId);
    if (!turn?.changeSetId) return { restored: [], skipped: [] };
    return this.deps.ledger.undo(turn.changeSetId);
  }

  resetSession(): void {
    this.work = {};
    this.seen.clear();
    this.shifted.clear();
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
    const active: ActiveTurn = { turnId, mode: request.mode, selection: request.selection, abort: new AbortController(), cancelled: false, approvals: new Map() };
    this.active = active;
    this.starting = false;
    this.runningSubagents.clear();
    this.expectedMain.clear();
    this.loopGuard.reset();
    this.hitStepLimit = false;
    this.mainModelCalls.clear();
    this.announcedCalls.clear();
    this.countedUsage.clear();
    if (!request.followUp) {
      this.turnEdits = 0;
      this.failedEdits = 0;
    }
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
      followUp: request.followUp,
      startedAt: Date.now(),
    };
    store.update((state) => {
      state.turns.push(turn);
      state.busy = true;
    });
    const changeSetId = ledger.begin(request.title);
    edits.beginTurn(changeSetId);
    store.update(() => {
      turn.changeSetId = changeSetId;
    });

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
        // M10: the step limit is the task's size, not the model's fault: no failover, no breaker, one wrap-up turn.
        if (result.kind === "failed" && result.failure.kind === "limit" && !active.cancelled) {
          this.hitStepLimit = request.followUp !== true;
          store.notice(turnId, "warning", `The agent used all ${this.deps.settings().iterationLimit} steps. ${this.hitStepLimit ? "Asking it to wrap up with a summary of what is done and what remains." : "Stopped."}`);
          this.finish(turn, "done");
          return;
        }
        if (result.kind === "cancelled" || active.cancelled) {
          this.finish(turn, active.superseded ? "superseded" : "cancelled");
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
        state.queue = state.queue.filter((note) => note.status === "queued");
      });
      this.refreshModelHealth();
      store.flush();
      this.deps.onBusyChange(false);
    }
  }

  async cancel(options: { superseded?: boolean } = {}): Promise<void> {
    const active = this.active;
    if (!active || active.cancelled) return;
    active.cancelled = true;
    active.superseded = options.superseded;
    killAllCommands();
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
      promptProfile: settings.promptProfile,
    };
  }

  private async ensureSession(request: TurnRequest, model: string, active: ActiveTurn, overrides: SpecOverrides): Promise<{ id: string; previousTurnId: string }> {
    const client = this.deps.client();
    const spec = this.deps.profiles.spec(request.mode, model, this.specOptions(overrides));
    const specKey = JSON.stringify([model, overrides.reasoningEffort ?? null, overrides.maxTokens ?? null, this.deps.settings().promptProfile ?? "auto"]);
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
      if (request.mode === "agent") {
        this.deps.store.update(() => {
          turn.chain = { sessionId: session.id, previousTurnId: session.previousTurnId };
        });
      }
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

      const subagentReason = threadId !== MAIN_THREAD ? subagentDenial(name, args) : undefined;
      if (subagentReason) {
        this.upsertTool(turn, { id: ref.id, status: "denied", output: subagentReason }, name, args, threadId);
        return { ...base, allow: false, reason: subagentReason };
      }
      if (threadId !== MAIN_THREAD && name === "run_command") {
        this.upsertTool(turn, { id: ref.id, status: "running" }, name, args, threadId);
        return { ...base, allow: true };
      }

      if (EDIT_TOOLS.has(name)) {
        const result = await this.deps.edits.resolve(name, args);
        const reason = active.cancelled ? "The user cancelled the turn." : this.deps.edits.denialReason(result);
        if (reason) this.deps.edits.drop(name, args);
        if (!result.ok && !active.cancelled && threadId === MAIN_THREAD) this.failedEdits += 1;
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
        if (threadId === MAIN_THREAD) this.mainModelCalls.add(event.id);
        if (event.usage) this.countLiveUsage(turn, event.id, event.usage);
        if (threadId === MAIN_THREAD && event.usage && turn.context) {
          const usage = event.usage;
          const context = turn.context;
          store.update(() => {
            context.live = {
              inputTokens: usage.inputTokens,
              threshold: this.deps.profiles.compactionTokens(this.active?.mode ?? "agent"),
              cacheReadTokens: usage.cacheReadTokens,
              compactions: context.live?.compactions ?? 0,
            };
          });
        }
        if (threadId === MAIN_THREAD) {
          const text = extractText(event.content);
          if (text.trim()) store.upsertStep(turn.id, { kind: "text", id: event.id, text });
          if (event.reasoningContent?.trim()) store.upsertStep(turn.id, { kind: "reasoning", id: `${event.id}-reasoning`, text: event.reasoningContent });
        }
        for (const call of event.toolCalls ?? []) {
          if (!call.function?.name) continue;
          const { name, args } = parseArguments(call.function.name, call.function.arguments ?? "");
          if (threadId === MAIN_THREAD && !this.announcedCalls.has(call.id)) {
            this.announcedCalls.add(call.id);
            const signature = callSignature(name, args);
            this.expectedMain.set(signature, (this.expectedMain.get(signature) ?? 0) + 1);
          }
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
        this.runningSubagents.add(event.threadId);
        this.threadTitles.set(event.threadId, event.title);
        store.upsertStep(turn.id, { kind: "subagent", id: event.threadId, title: event.title, status: "running" });
        break;
      case "thread.done":
        this.runningSubagents.delete(event.threadId);
        store.upsertStep(turn.id, { kind: "subagent", id: event.threadId, title: event.title, status: event.state.status === "done" ? "done" : "error" });
        break;
      case "thread.context_compaction_started":
        store.notice(turn.id, "info", "Compacting earlier conversation to stay within the context window.");
        break;
      case "thread.context_compaction_finished":
        if (turn.context?.live) {
          const live = turn.context.live;
          store.update(() => {
            live.compactions += 1;
          });
        }
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
    this.deps.store.update(() => {
      // TrueForge's totals replace the live estimate for this attempt.
      turn.liveUsage = undefined;
      if (!metrics) return;
      turn.usage.input += metrics.totalInputTokens ?? 0;
      turn.usage.output += metrics.totalOutputTokens ?? 0;
      turn.usage.cached += metrics.totalCacheReadTokens ?? 0;
      if (metrics.totalReasoningTokens) turn.usage.reasoning = (turn.usage.reasoning ?? 0) + metrics.totalReasoningTokens;
      if (metrics.totalCostInUsd) turn.usage.costUsd = (turn.usage.costUsd ?? 0) + metrics.totalCostInUsd;
    });
  }

  /** Live token count while a turn runs: each completed model call once (events are re-emitted per delta). */
  private countLiveUsage(turn: Turn, eventId: string, usage: TrueForgeApi.ModelMessageUsage): void {
    if (this.countedUsage.has(eventId)) return;
    this.countedUsage.add(eventId);
    this.deps.store.update(() => {
      const live = turn.liveUsage ?? { input: 0, output: 0, cached: 0, calls: 0 };
      live.input += usage.inputTokens;
      live.output += usage.outputTokens;
      live.cached += usage.cacheReadTokens ?? 0;
      live.calls += 1;
      turn.liveUsage = live;
    });
  }
}

/** Goose-style budget hint once half the steps are used, so the agent converges instead of hitting the wall. */
function turnBudget(used: number, limit: number): string {
  const nl = String.fromCharCode(10);
  return `${nl}${nl}<turn-budget>${used}/${limit} steps used</turn-budget> Be direct: batch the remaining calls, verify, and call finish_task before the limit.`;
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
