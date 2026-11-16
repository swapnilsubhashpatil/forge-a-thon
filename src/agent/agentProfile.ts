import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentSpec } from "../harness/harnessClient.ts";

export type AgentMode = "agent" | "inline";

export interface SpecOptions {
  toolServerName: string;
  iterationLimit?: number;
  reasoningEffort?: string;
}

interface AgentProfile {
  name: string;
  instructions: string[];
  toolsRequiringApproval: string[];
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

  spec(mode: AgentMode, model: string, options: SpecOptions): AgentSpec {
    const profile = this.profiles[mode];
    const reasoning = options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {};
    return {
      model: { name: model, params: { temperature: profile.params.temperature, maxTokens: profile.params.maxTokens, ...reasoning } },
      instructions: profile.instructions.join("\n"),
      mcpServers: [
        {
          name: options.toolServerName,
          enableTools: ["@all"],
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
