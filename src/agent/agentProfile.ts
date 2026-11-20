import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentSpec } from "../harness/harnessClient.ts";
import type { AgentMode } from "../shared/protocol.ts";

export type RunMode = AgentMode | "inline";
export type PromptProfile = "auto" | "full" | "compact";

export interface SpecOptions {
  toolServerName: string;
  iterationLimit?: number;
  reasoningEffort?: string;
  maxTokens?: number;
  promptProfile?: PromptProfile;
  mcpServers?: string[];
}

export function usesCompactPrompt(model: string, profile: PromptProfile = "auto"): boolean {
  if (profile === "compact") return true;
  if (profile === "full") return false;
  return model.startsWith("ollama/");
}

interface AgentProfile {
  name: string;
  instructions: string[];
  toolsRequiringApproval: string[];
  enabledTools?: string[];
  preloadTools: boolean;
  subagents: boolean;
  compactionInputTokens: number;
  iterationLimit: number;
  params: { temperature: number; maxTokens: number };
}

export class AgentProfiles {
  private readonly profiles: Record<RunMode, AgentProfile>;
  private readonly compactAgent: AgentProfile;

  constructor(extensionPath: string) {
    const load = (file: string) => JSON.parse(readFileSync(join(extensionPath, "agents", file), "utf8")) as AgentProfile;
    this.profiles = { agent: load("anvil-agent.json"), ask: load("anvil-ask.json"), inline: load("anvil-inline.json") };
    this.compactAgent = load("anvil-agent-compact.json");
  }

  private profileFor(mode: RunMode, model: string, promptProfile?: PromptProfile): AgentProfile {
    return mode === "agent" && usesCompactPrompt(model, promptProfile) ? this.compactAgent : this.profiles[mode];
  }

  compactionTokens(mode: RunMode): number {
    return this.profiles[mode].compactionInputTokens;
  }

  maxTokens(mode: RunMode): number {
    return this.profiles[mode].params.maxTokens;
  }

  spec(mode: RunMode, model: string, options: SpecOptions): AgentSpec {
    const profile = this.profileFor(mode, model, options.promptProfile);
    const effort = options.reasoningEffort ?? defaultReasoningEffort(model);
    const reasoning = effort ? { reasoningEffort: effort } : {};
    return {
      model: { name: model, params: { temperature: profile.params.temperature, maxTokens: options.maxTokens ?? profile.params.maxTokens, ...reasoning } },
      instructions: profile.instructions.join("\n"),
      mcpServers: [
        {
          name: options.toolServerName,
          enableTools: profile.enabledTools ?? ["@all"],
          preload: profile.preloadTools,
          requireApprovalForTools: ["@write", "@destructive", ...profile.toolsRequiringApproval],
        },
        ...(mode === "inline" ? [] : (options.mcpServers ?? []).map((name) => ({
          name,
          enableTools: [mode === "ask" ? "@read-only" : "@all"],
          requireApprovalForTools: ["@write", "@destructive"],
        }))),
      ],
      config: {
        sandbox: { enabled: false },
        dynamicSubAgents: { enabled: profile.subagents },
        askUserQuestions: { enabled: false },
        contextManagement: {
          compaction: { enabled: true, trigger: { type: "input_tokens", value: profile.compactionInputTokens } },
          largeToolResponse: { enabled: false },
        },
        iterationLimit: mode === "inline" ? profile.iterationLimit : options.iterationLimit ?? profile.iterationLimit,
      },
    };
  }
}

export function defaultReasoningEffort(model: string): string | undefined {
  return model.startsWith("ollama/") ? "none" : undefined;
}
