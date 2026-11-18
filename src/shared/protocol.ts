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
  fetched: string[];
  read: string[];
  edited: string[];
  live?: ContextLive;
  verify?: string;
  rules?: string[];
  attachments?: Array<{ label: string; kind: Attachment["kind"]; tokens: number }>;
  slices?: Array<{ path: string; start: number; end: number }>;
}

export interface ContextLive {
  inputTokens: number;
  threshold: number;
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
  deliveredAtStep?: number;
  turnId?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  cached: number;
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
  liveUsage?: TokenUsage & { calls: number };
  finish?: FinishReport;
  plan?: PlanItem[];
  followUp?: boolean;
  changeSetId?: string;
  chain?: { sessionId: string; previousTurnId: string };
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
  undone?: boolean;
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
  workspace?: { name: string; files: number; user?: string };
  sessionId?: string;
  sessionUrl?: string;
  turns: Turn[];
  harness: HarnessStatus;
  models: ModelHealth[];
  activeModel?: string;
  busy: boolean;
  changeSets: ChangeSetSummary[];
  queue: QueuedNote[];
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
