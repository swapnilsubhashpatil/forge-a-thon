import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { providerManifest, withModels } from "../src/harness/harnessClient.ts";

const stub = new URL("./stubs/vscode.ts", import.meta.url).href;
registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: stub, shortCircuit: true } : next(specifier, context)),
});
const { providerDraft } = await import("../src/ui/providerManager.ts");
const { readSettings, SETTING_KEYS } = await import("../src/ui/settings.ts");

const catalog = [
  { modelId: "claude-sonnet-5-5", name: "claude-sonnet-5-5", properties: { contextLength: 1000000, maxOutputTokens: 64000 } },
  { modelId: "claude-haiku-5-5", name: "claude-haiku-5-5", properties: { contextLength: 200000 } },
];
const add = (fields: Partial<{ providerType: string; name: string; apiKey: string; baseUrl: string; models: string[] }>) =>
  providerDraft({ type: "addProvider", providerType: "anthropic", name: "", apiKey: "sk-test", models: ["claude-sonnet-5-5"], ...fields });

test("catalog providers keep only the selected catalog models and are named by type", () => {
  const draft = add({ name: "ignored" });
  assert.ok(typeof draft !== "string");
  assert.equal(draft.name, "anthropic");
  assert.deepEqual(providerManifest(draft, catalog), {
    type: "anthropic",
    auth: { apiKey: "sk-test" },
    models: [catalog[0]],
  });
});

test("custom providers slug model ids and get default limits", () => {
  const draft = add({ providerType: "custom", name: "openrouter", baseUrl: "https://openrouter.ai/api/v1", models: ["qwen/Qwen3.5-Coder", " "] });
  assert.ok(typeof draft !== "string");
  assert.deepEqual(providerManifest(draft, []), {
    type: "custom",
    name: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    auth: { apiKey: "sk-test" },
    models: [{ modelId: "qwen/Qwen3.5-Coder", name: "qwen-qwen3-5-coder", properties: { contextLength: 131072, maxOutputTokens: 8192 } }],
  });
  const keyless = add({ providerType: "custom", name: "", apiKey: "", baseUrl: "http://127.0.0.1:11434/v1", models: ["llama3"] });
  assert.ok(typeof keyless !== "string");
  assert.equal(keyless.name, "custom");
  assert.equal("auth" in providerManifest(keyless, []), false);
});

test("provider drafts validate name, base URL, key and models", () => {
  const custom = { providerType: "custom", baseUrl: "https://example.com/v1", models: ["m"] };
  assert.equal(typeof add({ ...custom, name: "local-1" }), "object");
  assert.equal(typeof add({ ...custom, name: "Bad Name" }), "string");
  assert.equal(typeof add({ ...custom, name: "-bad" }), "string");
  assert.equal(typeof add({ ...custom, name: "ok", baseUrl: "ftp://example.com" }), "string");
  assert.equal(typeof add({ ...custom, name: "ok", baseUrl: "not a url" }), "string");
  assert.equal(typeof add({ ...custom, name: "ok", baseUrl: "" }), "string");
  assert.equal(typeof add({ apiKey: "" }), "string");
  assert.equal(typeof add({ models: [] }), "string");
});

test("settings map to anvil.* keys and read back with defaults", () => {
  const values = new Map<string, unknown>([["agent.iterationLimit", 30], ["harness.url", "http://127.0.0.1:9000"], ["selection.askActions", false], ["models.chain", ["a/b", ""]]]);
  const settings = readSettings({ get: ((key: string, fallback: unknown) => (values.has(key) ? values.get(key) : fallback)) as never });
  assert.equal(settings.iterationLimit, 30);
  assert.equal(settings.harnessUrl, "http://127.0.0.1:9000");
  assert.equal(settings.selectionToolbar, false);
  assert.equal(settings.commandTimeoutSeconds, 120);
  assert.equal(settings.failoverSeconds, 45);
  assert.deepEqual(settings.chain, ["a/b"]);
  assert.equal(SETTING_KEYS.failoverSeconds, "resilience.firstEventTimeoutSeconds");
  assert.equal(SETTING_KEYS.selectionAutoAttach, "selection.autoAttach");
  assert.equal(new Set(Object.values(SETTING_KEYS)).size, Object.keys(settings).length);
});

test("changing models keeps the masked auth and the rest of the manifest verbatim", () => {
  const auth = { apiKey: "abc-***REDACTED***-stu" };
  const kept = { modelId: "aa", name: "custom-aa", properties: { contextLength: 4096 } };
  const custom = { type: "custom", name: "local", baseUrl: "http://127.0.0.1:9/v1", auth, models: [kept, { modelId: "bb", name: "bb", properties: {} }] } as never;
  assert.deepEqual(withModels(custom, ["aa", "cc"], []), {
    type: "custom",
    name: "local",
    baseUrl: "http://127.0.0.1:9/v1",
    auth,
    models: [kept, { modelId: "cc", name: "cc", properties: { contextLength: 131072, maxOutputTokens: 8192 } }],
  });
  const anthropic = { type: "anthropic", auth, models: [catalog[0]] } as never;
  assert.deepEqual(withModels(anthropic, ["claude-haiku-5-5", "unknown"], catalog), { type: "anthropic", auth, models: [catalog[1]] });
  assert.throws(() => withModels(anthropic, ["unknown"], catalog));
});
