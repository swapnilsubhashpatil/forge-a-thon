import { spawn } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = process.env.FAKE_MODEL_PORT ?? "8799";
const fake = spawn(process.execPath, [join(root, "scripts/fake-model.mjs"), port], { stdio: "inherit", env: { ...process.env, FAKE_MODEL_LOG: "1" } });
await new Promise((resolveWait) => setTimeout(resolveWait, 800));
const python = process.env.ANVIL_E2E_PYTHON ?? resolve(root, "..", "flask-3.1.3", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const path = `${dirname(python)}${delimiter}${process.env.PATH ?? process.env.Path ?? ""}`;
const run = spawn(process.execPath, [join(root, "scripts/e2e.mjs")], {
  stdio: "inherit",
  env: { ...process.env, ANVIL_E2E_SUITE: "guards", FAKE_MODEL_PORT: port, PATH: path, Path: path, ANVIL_E2E_PYTHON: python },
});
const code = await new Promise((resolveExit) => run.on("close", resolveExit));
fake.kill();
process.exit(code ?? 1);
