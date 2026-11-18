// Scripted, deliberately misbehaving "model" for end-to-end guard tests (ticket 00).
// An OpenAI-compatible /v1/chat/completions server that TrueForge calls like any provider. The scenario is chosen by a
// marker in the conversation ("SCENARIO=loop") and each reply is decided from the transcript alone (how many tool
// results came back, what they said), so runs are deterministic and need no state.
//
//   node scripts/fake-model.mjs [port]      (default 8799)
import http from "node:http";

const port = Number(process.argv[2] ?? process.env.FAKE_MODEL_PORT ?? 8799);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const text = (content) => ({ content });
const call = (name, args) => ({ tool: name, args });

/** Picks the reply for a request. `tools` are the names TrueForge offered (possibly prefixed with the server name). */
function decide(allMessages, tools) {
  const content = (message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? ""));
  // The agent session is shared across scenarios: start from the latest user message that names a scenario.
  let start = 0;
  allMessages.forEach((message, i) => {
    if (message.role === "user" && /SCENARIO=\w+/.test(content(message))) start = i;
  });
  const messages = allMessages.slice(start);
  const all = messages.map(content).join("\n");
  const scenario = [...all.matchAll(/SCENARIO=(\w+)/g)].at(-1)?.[1] ?? "none";
  const results = messages.filter((message) => message.role === "tool").map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content)));
  const users = messages.filter((message) => message.role === "user").map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content)));
  const lastUser = users.at(-1) ?? "";
  const step = results.length;
  const has = (pattern) => results.some((result) => pattern.test(result));
  const tool = (name) => tools.find((candidate) => candidate === name || candidate.endsWith(`__${name}`) || candidate.endsWith(`.${name}`)) ?? name;
  const t = (name, args) => call(tool(name), args);

  switch (scenario) {
    // G3 + G2: an edit that calls a function that exists nowhere, on lines the agent never read.
    case "grounding":
      if (step === 0) {
        return t("propose_edit", {
          path: "src/flask/helpers.py",
          old_string: "def get_debug_flag() -> bool:",
          new_string: "def get_debug_flag() -> bool:\n    _secrets = get_secret_keys()",
        });
      }
      return text(has(/Grounding check/) && has(/edited without reading/) ? "GROUNDING_SEEN SCOPE_SEEN" : "NOT_SEEN");

    // G2 inline: the selection is get_debug_flag, the edit lands in get_load_dotenv further down.
    case "scope":
      if (step === 0) {
        return t("propose_edit", {
          path: "src/flask/helpers.py",
          old_string: "def get_load_dotenv(default: bool = True) -> bool:",
          new_string: "def get_load_dotenv(default: bool = True) -> bool:  # touched outside the selection",
        });
      }
      return text(has(/outside selection/) ? "SCOPE_SEEN" : "NOT_SEEN");

    // M7: the same read forever.
    case "loop":
      return t("read_file", { path: "src/flask/helpers.py", start_line: 1, end_line: 5, fresh: true });

    // M8: edit, then claim done without verifying; on the follow-up, test and finish properly.
    case "earlystop":
      if (/did not call finish_task/.test(lastUser)) {
        if (results.at(-1)?.startsWith("Not accepted")) {
          return t("finish_task", { summary: "Edited get_debug_flag docstring", files_changed: ["src/flask/helpers.py"], verification: "The test run failed; see the output above.", verified: false });
        }
        if (!results.slice(-1)[0]?.startsWith("$ ")) return t("run_command", { command: "python -m pytest tests/test_cli.py -q" });
        return t("finish_task", { summary: "Edited get_debug_flag docstring", files_changed: ["src/flask/helpers.py"], verification: "pytest tests/test_cli.py", verified: true });
      }
      if (step === 0) return t("read_file", { path: "src/flask/helpers.py", start_line: 20, end_line: 40 });
      if (step === 1) {
        return t("propose_edit", {
          path: "src/flask/helpers.py",
          old_string: '    """Get whether debug mode should be enabled for the app, indicated by the',
          new_string: '    """Get whether debug mode should be enabled for the app (Anvil fake edit), indicated by the',
        });
      }
      return text("Done, it should work.");

    // M3: one propose_edit that produces two separate hunks; the test rejects the first and accepts the second.
    case "partial":
      if (step === 0) return t("read_file", { path: "src/flask/helpers.py", start_line: 1, end_line: 60 });
      if (step === 1) {
        return t("propose_edit", {
          path: "src/flask/helpers.py",
          old_string: 'def get_debug_flag() -> bool:\n    """Get whether debug mode should be enabled for the app, indicated by the\n    :envvar:`FLASK_DEBUG` environment variable. The default is ``False``.\n    """\n    val = os.environ.get("FLASK_DEBUG")\n    return bool(val and val.lower() not in {"0", "false", "no"})',
          new_string: 'def get_debug_flag() -> bool:  # hunk one\n    """Get whether debug mode should be enabled for the app, indicated by the\n    :envvar:`FLASK_DEBUG` environment variable. The default is ``False``.\n    """\n    val = os.environ.get("FLASK_DEBUG")\n    return bool(val and val.lower() not in {"0", "false", "no", "off"})',
        });
      }
      return text(has(/new baseline/) && has(/Current text of src\/flask\/helpers\.py/) ? "BASELINE_SEEN" : "NOT_SEEN");

    // M11: three slow reads so the test can queue a note; report whether a tool result carried it.
    case "note":
      if (step < 3) return { ...t("read_file", { path: "src/flask/helpers.py", start_line: 1 + step * 10, end_line: 10 + step * 10 }), delayMs: 2500 };
      return text(has(/<user_note sent_mid_task>[\s\S]*NOTE_PAYLOAD/) ? "NOTE_SEEN" : "NOTE_MISSING");

    // M10: distinct searches until TrueForge's iteration limit; on the wrap-up, finish without claiming verification.
    case "limit":
      if (/reached the step limit/.test(lastUser)) {
        return t("finish_task", { summary: "Stopped at the step limit while searching", verification: "No edits were made; nothing to verify.", verified: false });
      }
      return t("search_code", { query: `limit_probe_${step}` });

    // Attachments: does the request carry the user's selection ahead of the context pack?
    case "attach":
      return text(/Selected by the user: src\/flask\/helpers\.py lines/.test(all) ? "ATTACH_SEEN" : "ATTACH_MISSING");

    // M2: the parent starts a subagent through TrueForge's own subagent tool; the child tries to edit and to run tests.
    case "subagent": {
      const spawn = tools.find((name) => /sub_?agent/i.test(name));
      if (step === 0 && spawn) return { tool: spawn, args: fillArgs(spawn, "SCENARIO=subchild Inspect src/flask/helpers.py and report.") };
      return text(has(/SUB_DENIED_BOTH/) ? "SUBAGENT_SEEN" : `SUBAGENT_MISSING ${spawn ?? "no-subagent-tool"}`);
    }
    case "subchild":
      if (step === 0) return t("propose_edit", { path: "src/flask/helpers.py", old_string: "def get_debug_flag() -> bool:", new_string: "def get_debug_flag() -> bool:  # subagent" });
      if (step === 1) return t("run_command", { command: "python -m pytest tests/test_helpers.py -q" });
      if (step === 2) return t("run_command", { command: "git log --oneline -3" });
      return text(results.filter((result) => /read-only/.test(result)).length >= 2 && results.some((result) => /^\$ git log/.test(result)) ? "SUB_DENIED_BOTH" : `SUB_NOT_DENIED ${results.map((r) => r.slice(0, 40)).join(" | ")}`);

    default:
      return text("ok");
  }
}

/** Arguments for a tool we only know by schema: every required string gets `text`, other required fields a default. */
let toolSchemas = new Map();
function fillArgs(name, value) {
  const schema = toolSchemas.get(name) ?? {};
  const args = {};
  for (const [key, spec] of Object.entries(schema.properties ?? {})) {
    if (!(schema.required ?? []).includes(key) && !/prompt|task|instruction|description|title|name/i.test(key)) continue;
    args[key] = spec.type === "string" || !spec.type ? value : spec.type === "array" ? [] : spec.type === "boolean" ? false : spec.type === "number" || spec.type === "integer" ? 1 : {};
  }
  return args;
}

function completion(reply, model) {
  const id = `chatcmpl-fake-${Date.now()}`;
  const message = reply.tool
    ? { role: "assistant", content: null, tool_calls: [{ id: `call_${Math.random().toString(36).slice(2, 10)}`, type: "function", function: { name: reply.tool, arguments: JSON.stringify(reply.args) } }] }
    : { role: "assistant", content: reply.content };
  return { id, message, finish: reply.tool ? "tool_calls" : "stop", model };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url?.endsWith("/models")) {
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ object: "list", data: [{ id: "fake", object: "model" }] }));
    return;
  }
  if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  const payload = JSON.parse(body);
  const tools = (payload.tools ?? []).map((entry) => entry.function?.name).filter(Boolean);
  toolSchemas = new Map((payload.tools ?? []).map((entry) => [entry.function?.name, entry.function?.parameters]));
  const reply = decide(payload.messages ?? [], tools);
  if (reply.delayMs) await sleep(reply.delayMs);
  const { id, message, finish, model } = completion(reply, payload.model ?? "fake");
  const usage = { prompt_tokens: Math.ceil(body.length / 4), completion_tokens: 20, total_tokens: Math.ceil(body.length / 4) + 20 };
  if (process.env.FAKE_MODEL_LOG) {
    const last = (payload.messages ?? []).at(-1);
    const lastText = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
    console.log(`[fake] ${[...body.matchAll(/SCENARIO=(\w+)/g)].at(-1)?.[1] ?? "-"} <- ${last?.role}: ${lastText.slice(0, 200).replace(/\s+/g, " ")}`);
    console.log(`[fake]   -> ${reply.tool ? `${reply.tool} ${JSON.stringify(reply.args).slice(0, 80)}` : JSON.stringify(reply.content)}`);
  }

  if (!payload.stream) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id, object: "chat.completion", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, message, finish_reason: finish }], usage }));
    return;
  }
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const send = (data) => response.write(`data: ${JSON.stringify(data)}\n\n`);
  const base = { id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model };
  if (message.tool_calls) {
    const [callEntry] = message.tool_calls;
    send({ ...base, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: callEntry.id, type: "function", function: { name: callEntry.function.name, arguments: "" } }] }, finish_reason: null }] });
    send({ ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: callEntry.function.arguments } }] }, finish_reason: null }] });
  } else {
    send({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: message.content }, finish_reason: null }] });
  }
  send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: finish }], usage: payload.stream_options?.include_usage ? usage : undefined });
  if (payload.stream_options?.include_usage) send({ ...base, choices: [], usage });
  response.write("data: [DONE]\n\n");
  response.end();
});

server.listen(port, "127.0.0.1", () => console.log(`fake model listening on http://127.0.0.1:${port}/v1`));
