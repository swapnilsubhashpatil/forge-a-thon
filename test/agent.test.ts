import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { AgentProfiles, defaultReasoningEffort, usesCompactPrompt } from "../src/agent/agentProfile.ts";
import { classifyFailure, truncationRetryTokens } from "../src/agent/resilience.ts";

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

test("TrueForge's truncation error is classified as truncated, not unknown", () => {
  const failure = classifyFailure("Output truncated: hit the 8192 token limit after 8192 tokens. Raise max_tokens and retry.");
  assert.equal(failure.kind, "truncated");
  assert.equal(failure.retrySameModel, false);
  assert.equal(classifyFailure("Output truncated: hit the provider's default token limit. Raise max_tokens and retry.").kind, "truncated");
});

test("other failures keep their existing kinds", () => {
  assert.equal(classifyFailure("Request failed (429): rate limit").kind, "rate-limit");
  assert.equal(classifyFailure("prompt is too long: too many tokens").kind, "context");
});

test("truncation retry doubles the output budget up to a ceiling", () => {
  assert.equal(truncationRetryTokens(8192), 16384);
  assert.equal(truncationRetryTokens(30000), 32768);
});

test("a max token override reaches the spec", () => {
  const spec = profiles.spec("inline", "ollama/qwen3-8b", { toolServerName: "anvil-editor-test", reasoningEffort: "none", maxTokens: 16384 });
  assert.equal(spec.model.params?.maxTokens, 16384);
  assert.equal(profiles.maxTokens("inline"), 8192);
});

test("compact prompt is chosen for local models in auto, and the setting overrides it", () => {
  assert.equal(usesCompactPrompt("ollama/qwen3-8b"), true);
  assert.equal(usesCompactPrompt("anthropic/claude-sonnet-5-5"), false);
  assert.equal(usesCompactPrompt("ollama/qwen3-8b", "full"), false);
  assert.equal(usesCompactPrompt("anthropic/claude-haiku-5-5", "compact"), true);
});

test("agent spec uses the compact instructions only for agent mode", () => {
  const compact = profiles.spec("agent", "ollama/qwen3-8b", { toolServerName: "t" }).instructions ?? "";
  const full = profiles.spec("agent", "anthropic/claude-sonnet-5-5", { toolServerName: "t" }).instructions ?? "";
  const inline = profiles.spec("inline", "ollama/qwen3-8b", { toolServerName: "t" }).instructions ?? "";
  assert.ok(compact.length < full.length / 2);
  assert.match(full, /Verify by execution, never by assumption/);
  assert.match(inline, /inline editor/);
});

test("TrueForge's iteration limit is its own failure kind, never a model fault to fail over", () => {
  const failure = classifyFailure("You have reached iteration limit of 60, please request again");
  assert.equal(failure.kind, "limit");
  assert.equal(failure.retrySameModel, false);
});
