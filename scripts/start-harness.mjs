import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const baseUrl = process.env.TRUEFORGE_URL ?? "http://localhost:8790";
const port = new URL(baseUrl).port || "8790";

const providers = [
  { env: "OPENAI_API_KEY", manifest: (apiKey) => ({ type: "openai", auth: { api_key: apiKey }, models: [] }) },
  { env: "ANTHROPIC_API_KEY", manifest: (apiKey) => ({ type: "anthropic", auth: { api_key: apiKey }, models: [] }) },
  { env: "GEMINI_API_KEY", manifest: (apiKey) => ({ type: "google-gemini", auth: { api_key: apiKey }, models: [] }) },
];

async function ping() {
  try {
    return (await fetch(`${baseUrl}/api/v1/models`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}

async function put(path, body) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
}

async function catalogModels(type) {
  const response = await fetch(`${baseUrl}/api/v1/catalogs/model-providers`);
  const catalog = await response.json();
  const entry = catalog.data.find((provider) => provider.type === type);
  return (entry?.models ?? []).map((model) => ({ model_id: model.model_id, name: model.name, properties: model.properties ?? {} }));
}

let child;
if (!(await ping())) {
  console.log(`Starting TrueForge on port ${port} with loopback MCP access allowed…`);
  child = spawn("npx", ["-y", "@truefoundry/trueforge@0.185.1"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, PORT: port, OUTBOUND_URL_ALLOWED_HOSTS: '["127.0.0.1","localhost"]' },
  });
  for (let waited = 0; !(await ping()); waited += 1) {
    if (waited > 120) throw new Error("TrueForge did not start within two minutes");
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }
}

for (const provider of providers) {
  const apiKey = process.env[provider.env];
  if (!apiKey) continue;
  const manifest = provider.manifest(apiKey);
  manifest.models = await catalogModels(manifest.type);
  await put("/settings/model-providers", { manifest });
  console.log(`Registered ${manifest.type} provider (${manifest.models.length} models)`);
}

const slug = (modelId) => modelId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
const list = (value) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

if (process.env.OLLAMA_MODEL) {
  const models = list(process.env.OLLAMA_MODEL).map((modelId) => ({
    model_id: modelId,
    name: slug(modelId),
    properties: { context_length: 32768, max_output_tokens: 8192, reasoning_efforts: ["none", "low", "medium", "high"] },
  }));
  await put("/settings/model-providers", {
    manifest: { type: "custom", name: "ollama", base_url: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1", models },
  });
  console.log(`Registered local Ollama models: ${models.map((model) => `ollama/${model.name}`).join(", ")}`);
}

// OpenAI-compatible hosted providers used for the model test matrix. Each needs a key and a comma-separated model list.
const compatible = [
  { name: "openrouter", keyEnv: "OPENROUTER_API_KEY", modelsEnv: "OPENROUTER_MODELS", baseUrl: "https://openrouter.ai/api/v1" },
  { name: "xai", keyEnv: "XAI_API_KEY", modelsEnv: "XAI_MODELS", baseUrl: "https://api.x.ai/v1" },
  { name: "groq", keyEnv: "GROQ_API_KEY", modelsEnv: "GROQ_MODELS", baseUrl: "https://api.groq.com/openai/v1" },
];
for (const provider of compatible) {
  const apiKey = process.env[provider.keyEnv];
  const ids = list(process.env[provider.modelsEnv]);
  if (!apiKey || !ids.length) continue;
  const models = ids.map((modelId) => ({ model_id: modelId, name: slug(modelId), properties: { context_length: 131072, max_output_tokens: 8192 } }));
  await put("/settings/model-providers", {
    manifest: { type: "custom", name: provider.name, base_url: provider.baseUrl, auth: { api_key: apiKey }, models },
  });
  console.log(`Registered ${provider.name}: ${models.map((model) => `${provider.name}/${model.name}`).join(", ")}`);
}

if (process.env.BROKEN_PROVIDER_FOR_DEMO === "1") {
  await put("/settings/model-providers", {
    manifest: {
      type: "custom",
      name: "broken",
      base_url: "http://127.0.0.1:9/v1",
      auth: { api_key: "invalid" },
      models: [{ model_id: "unreachable", name: "unreachable", properties: { context_length: 32768, max_output_tokens: 4096 } }],
    },
  });
  console.log("Registered broken/unreachable to demonstrate model failover");
}

const models = await (await fetch(`${baseUrl}/api/v1/models`)).json();
console.log(`TrueForge ready at ${baseUrl}. Models: ${models.data.map((model) => model.name).join(", ") || "none"}`);
if (child) console.log("Leave this terminal open; press Ctrl+C to stop TrueForge.");
