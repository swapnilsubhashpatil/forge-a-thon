import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { AgentProfiles, defaultReasoningEffort } from "../src/agent/agentProfile.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const profiles = new AgentProfiles(root);

test("inline mode exposes only the edit and read tools", () => {
  const spec = profiles.spec("inline", "anthropic/claude-sonnet-5-5", { toolServerName: "anvil-editor-test" });
  assert.deepEqual(spec.mcpServers?.[0]?.enableTools, ["propose_edit", "read_file"]);
});

test("agent mode keeps every tool", () => {
  const spec = profiles.spec("agent", "anthropic/claude-sonnet-5-5", { toolServerName: "anvil-editor-test" });
  assert.deepEqual(spec.mcpServers?.[0]?.enableTools, ["@all"]);
});

test("local Ollama models default to no reasoning, hosted models keep their default", () => {
  assert.equal(defaultReasoningEffort("ollama/qwen3-8b"), "none");
  assert.equal(defaultReasoningEffort("anthropic/claude-sonnet-5-5"), undefined);
  const local = profiles.spec("inline", "ollama/qwen3-8b", { toolServerName: "anvil-editor-test" });
  assert.equal(local.model.params?.reasoningEffort, "none");
});

test("an explicit reasoning setting wins over the local-model default", () => {
  const spec = profiles.spec("inline", "ollama/qwen3-8b", { toolServerName: "anvil-editor-test", reasoningEffort: "low" });
  assert.equal(spec.model.params?.reasoningEffort, "low");
});
