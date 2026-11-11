import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentSpec } from "../harness/harnessClient.ts";

export type AgentMode = "agent" | "inline";

export interface SpecOptions {
  toolServerName: string;
  iterationLimit?: number;
  reasoningEffort?: string;
  maxTokens?: number;
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
  private readonly profiles: Record<AgentMode, AgentProfile>;

  constructor(extensionPath: string) {
    const load = (file: string) => JSON.parse(readFileSync(join(extensionPath, "agents", file), "utf8")) as AgentProfile;
    this.profiles = { agent: load("anvil-agent.json"), inline: load("anvil-inline.json") };
  }

  compactionTokens(mode: AgentMode): number {
    return this.profiles[mode].compactionInputTokens;
  }

  maxTokens(mode: AgentMode): number {
    return this.profiles[mode].params.maxTokens;
  }

  spec(mode: AgentMode, model: string, options: SpecOptions): AgentSpec {
    const profile = this.profiles[mode];
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
      ],
      config: {
        sandbox: { enabled: false },
        dynamicSubAgents: { enabled: profile.subagents },
        askUserQuestions: { enabled: false },
        contextManagement: {
          compaction: { enabled: true, trigger: { type: "input_tokens", value: profile.compactionInputTokens } },
          largeToolResponse: { enabled: false },
        },
        iterationLimit: mode === "agent" ? options.iterationLimit ?? profile.iterationLimit : profile.iterationLimit,
      },
    };
  }
}

export function defaultReasoningEffort(model: string): string | undefined {
  return model.startsWith("ollama/") ? "none" : undefined;
}
