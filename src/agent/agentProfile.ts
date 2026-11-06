import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_SERVER_NAME, type AgentSpec } from "../harness/harnessClient.ts";

export type AgentMode = "agent" | "inline";

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

  spec(mode: AgentMode, model: string, iterationLimit?: number): AgentSpec {
    const profile = this.profiles[mode];
    return {
      model: { name: model, params: { temperature: profile.params.temperature, maxTokens: profile.params.maxTokens } },
      instructions: profile.instructions.join("\n"),
      mcpServers: [
        {
          name: TOOL_SERVER_NAME,
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
        iterationLimit: mode === "agent" ? iterationLimit ?? profile.iterationLimit : profile.iterationLimit,
      },
    };
  }
}
