export type FileRole = "target" | "reference" | "mentioned";

export interface ContextFile {
  path: string;
  role: FileRole;
  score: number;
  tokens: number;
  reasons: string[];
}

export interface ContextReport {
  strategy: string;
  budgetTokens: number;
  usedTokens: number;
  files: ContextFile[];
  /** Files the agent read that were not in the pack. */
  fetched: string[];
  /** Every file the agent read during the turn, pack files included. */
  read: string[];
  /** Files with at least one accepted hunk during the turn. */
  edited: string[];
  live?: ContextLive;
  /** Detected test command offered to the agent, if any. */
  verify?: string;
  /** Project rule files included (AGENTS.md, CLAUDE.md, …). */
  rules?: string[];
  /** What the user attached (selections, terminal output), shown as "attached by you". */
  attachments?: Array<{ label: string; kind: Attachment["kind"]; tokens: number }>;
  /** Line ranges (1-based, inclusive) the pack showed the agent; whole-file mentions use end = Infinity. */
  slices?: Array<{ path: string; start: number; end: number }>;
}

export interface ContextLive {
  /** Input tokens of the latest main-thread model call. */
  inputTokens: number;
  /** Compaction trigger configured for the agent. */
  threshold: number;
  /** Cache-read tokens of the latest call; undefined when the provider reports none. */
  cacheReadTokens?: number;
  compactions: number;
}

export type ToolStatus = "running" | "awaiting-approval" | "done" | "denied" | "error";

export interface DiffStat {
  added: number;
  removed: number;
}

export interface TextStep {
  kind: "text";
  id: string;
  text: string;
}

export interface ReasoningStep {
  kind: "reasoning";
  id: string;
  text: string;
}

export interface ToolStep {
  kind: "tool";
  id: string;
  name: string;
  title: string;
  detail?: string;
  path?: string;
  status: ToolStatus;
  output?: string;
  diff?: DiffStat;
  threadTitle?: string;
}

export interface ApprovalStep {
  kind: "approval";
  id: string;
  toolCallId: string;
  toolName: string;
  title: string;
  detail: string;
  status: "pending" | "allowed" | "denied";
}

export interface SubagentStep {
  kind: "subagent";
  id: string;
  title: string;
  status: "running" | "done" | "error";
}

export type NoticeTone = "info" | "success" | "warning" | "error";

export interface NoticeStep {
  kind: "notice";
  id: string;
  tone: NoticeTone;
  text: string;
  failover?: { from: string; to: string; reason: string };
}

export type Step = TextStep | ReasoningStep | ToolStep | ApprovalStep | SubagentStep | NoticeStep;

export type TurnStatus = "running" | "paused" | "done" | "cancelled" | "superseded" | "error";

export interface Attachment {
  id: string;
  kind: "selection" | "terminal" | "image";
  label: string;
  text: string;
  dataUrl?: string;
  mime?: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  command?: string;
  exitCode?: number;
}

export interface QueuedNote {
  id: string;
  text: string;
  mentions: string[];
  status: "queued" | "delivered";
  /** Tool step (1-based) whose result carried the note. */
  deliveredAtStep?: number;
  turnId?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  cached: number;
  /** TrueForge's own cost estimate in USD (turn metrics); absent when the provider reports none. */
  costUsd?: number;
  reasoning?: number;
}

export type PlanStatus = "pending" | "in_progress" | "completed" | "blocked" | "cancelled";

export interface PlanItem {
  step: string;
  status: PlanStatus;
}

export interface FinishReport {
  summary: string;
  filesChanged: string[];
  verified: boolean;
  verification: string;
  /** Command that verified the change, when verified. */
  command?: string;
}

export interface Turn {
  id: string;
  prompt: string;
  mentions: string[];
  context?: ContextReport;
  steps: Step[];
  status: TurnStatus;
  model: string;
  usage: TokenUsage;
  /** Model calls completed in the attempt still running, not yet in `usage` (TrueForge totals arrive at turn end). */
  liveUsage?: TokenUsage & { calls: number };
  /** Accepted finish_task report (M8). */
  finish?: FinishReport;
  /** Latest plan from update_plan (M6). */
  plan?: PlanItem[];
  /** Set on Anvil's own follow-up turns. */
  followUp?: boolean;
  /** Change set holding this turn's accepted edits (per-turn undo). */
  changeSetId?: string;
  /** Where this turn continued the TrueForge session from, so the conversation can be rewound to before it. */
  chain?: { sessionId: string; previousTurnId: string };
  /** Rewound by "Restore": kept visible but greyed out, no longer part of the agent's history. */
  reverted?: boolean;
  startedAt: number;
  endedAt?: number;
}

export type HarnessState = "connecting" | "starting" | "ready" | "offline";

export interface HarnessStatus {
  state: HarnessState;
  url: string;
  message?: string;
}

export type ModelHealthState = "healthy" | "cooling" | "unknown";

export interface ModelHealth {
  model: string;
  state: ModelHealthState;
  coolingUntil?: number;
  lastError?: string;
}

export interface ChangedFile {
  path: string;
  added: number;
  removed: number;
}

export interface ChangeSetSummary {
  id: string;
  label: string;
  files: ChangedFile[];
  createdAt: number;
  undone: boolean;
  kept?: boolean;
}

export type AgentMode = "agent" | "ask";

export type RevertScope = "conversation" | "code" | "both";

export type ReviewMode = "review" | "applyThenReview";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  turns: number;
  model?: string;
  edits: number;
}

export interface PendingReview {
  path: string;
  hunks: number;
  added: number;
  removed: number;
}

export interface AnvilSettings {
  chain: string[];
  reasoningEffort: "default" | "none" | "low" | "medium" | "high";
  reviewMode: ReviewMode;
  autoApprove: string[];
  budgetTokens: number;
}

export interface ChatState {
  conversationId?: string;
  mode: AgentMode;
  history: ConversationSummary[];
  pendingReviews: PendingReview[];
  settings: AnvilSettings;
  mcpServers: string[];
  workspace?: { name: string; files: number };
  sessionId?: string;
  sessionUrl?: string;
  turns: Turn[];
  harness: HarnessStatus;
  models: ModelHealth[];
  activeModel?: string;
  busy: boolean;
  changeSets: ChangeSetSummary[];
  /** Messages sent while a turn runs (M11). */
  queue: QueuedNote[];
  /** Every model TrueForge has configured, for the composer's model picker. */
  availableModels?: string[];
}

export type MentionKind = "file" | "symbol";

export interface MentionItem {
  kind: MentionKind;
  label: string;
  path: string;
  line?: number;
  detail?: string;
}

export type HostMessage =
  | { type: "state"; state: ChatState }
  | { type: "mentionResults"; requestId: number; items: MentionItem[] }
  | { type: "focusInput" }
  | { type: "attach"; attachment: Attachment }
  | { type: "setDraft"; text: string; mentions: string[] }
  | { type: "showView"; view: "chat" | "history" | "settings" };

export type WebviewMessage =
  | { type: "ready" }
  | { type: "send"; text: string; mentions: string[]; attachments?: Attachment[]; mode: AgentMode }
  | { type: "cancel" }
  | { type: "removeNote"; id: string }
  | { type: "setPrimaryModel"; model: string }
  | { type: "restore"; turnId: string; scope: RevertScope }
  | { type: "continue" }
  | { type: "retry"; turnId: string }
  | { type: "setMode"; mode: AgentMode }
  | { type: "keepAll" }
  | { type: "discardAll" }
  | { type: "openDiff"; path: string }
  | { type: "openHistory"; id: string }
  | { type: "deleteHistory"; id: string }
  | { type: "updateSettings"; patch: Partial<AnvilSettings> }
  | { type: "undoTurn"; turnId: string }
  | { type: "stopAndSend"; id: string }
  | { type: "newSession" }
  | { type: "approve"; toolCallId: string; allow: boolean; forSession?: boolean }
  | { type: "openFile"; path: string; line?: number }
  | { type: "undo"; changeSetId: string }
  | { type: "searchMentions"; requestId: number; query: string }
  | { type: "openSessionInHarness" }
  | { type: "configureModels" }
  | { type: "reconnect" };
