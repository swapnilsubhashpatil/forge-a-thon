import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { AgentProfiles } from "../src/agent/agentProfile.ts";

const stub = new URL("./stubs/vscode.ts", import.meta.url).href;
registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: stub, shortCircuit: true } : next(specifier, context)),
});
const { mcpServerProblem } = await import("../src/ui/mcpManager.ts");

const profiles = new AgentProfiles(fileURLToPath(new URL("..", import.meta.url)));
const options = { toolServerName: "anvil-editor-test", mcpServers: ["github"] };

test("agent mode adds enabled MCP servers with write approval", () => {
  const servers = profiles.spec("agent", "anthropic/claude-sonnet-5-5", options).mcpServers ?? [];
  assert.deepEqual(servers.map((server) => server.name), ["anvil-editor-test", "github"]);
  assert.deepEqual(servers[1], { name: "github", enableTools: ["@all"], requireApprovalForTools: ["@write", "@destructive"] });
});

test("ask mode only enables read-only MCP tools", () => {
  const servers = profiles.spec("ask", "anthropic/claude-sonnet-5-5", options).mcpServers ?? [];
  assert.deepEqual(servers[1]?.enableTools, ["@read-only"]);
});

test("inline mode and disabled servers stay out of the spec", () => {
  assert.equal(profiles.spec("inline", "anthropic/claude-sonnet-5-5", options).mcpServers?.length, 1);
  assert.equal(profiles.spec("agent", "anthropic/claude-sonnet-5-5", { toolServerName: "anvil-editor-test", mcpServers: [] }).mcpServers?.length, 1);
});

test("MCP server names and URLs are validated", () => {
  assert.equal(mcpServerProblem("github", "https://api.example.com/mcp"), undefined);
  assert.equal(mcpServerProblem("local-1", "http://localhost:3000/mcp"), undefined);
  assert.ok(mcpServerProblem("GitHub", "https://api.example.com/mcp"));
  assert.ok(mcpServerProblem("-bad", "https://api.example.com/mcp"));
  assert.ok(mcpServerProblem("a".repeat(64), "https://api.example.com/mcp"));
  assert.ok(mcpServerProblem("anvil-editor-x", "https://api.example.com/mcp"));
  assert.ok(mcpServerProblem("github", "ftp://example.com"));
  assert.ok(mcpServerProblem("github", "not a url"));
});
