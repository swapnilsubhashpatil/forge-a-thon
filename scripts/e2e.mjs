import { execSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { runTests } from "@vscode/test-electron";

const root = resolve(import.meta.dirname, "..");
const flask = process.env.FLASK_REPO ?? resolve(root, "..", "flask-3.1.3");
if (!existsSync(flask)) throw new Error(`Flask checkout not found at ${flask}. Set FLASK_REPO.`);

// The matrix builds the suite once and runs many copies in parallel, so it skips this step.
if (!process.env.ANVIL_E2E_SKIP_BUILD) await build({
  entryPoints: [join(root, `test/e2e/${process.env.ANVIL_E2E_SUITE ?? "suite"}.ts`)],
  bundle: true,
  outfile: join(root, `dist/test/${process.env.ANVIL_E2E_SUITE ?? "suite"}.js`),
  platform: "node",
  format: "cjs",
  external: ["vscode"],
});

const workspace = join(mkdtempSync(join(tmpdir(), "anvil-e2e-")), "flask");
execSync(`git clone --quiet "${flask}" "${workspace}"`);

await runTests({
  vscodeExecutablePath: process.env.VSCODE_PATH,
  // ANVIL_E2E_EXTENSION points at another build of Anvil (e.g. a worktree of main) to benchmark it with this suite.
  extensionDevelopmentPath: process.env.ANVIL_E2E_EXTENSION ?? root,
  extensionTestsPath: join(root, `dist/test/${process.env.ANVIL_E2E_SUITE ?? "suite"}.js`),
  launchArgs: [workspace, "--disable-extensions", "--skip-welcome", "--skip-release-notes", ...(process.env.ANVIL_E2E_USER_DATA ? ["--user-data-dir", process.env.ANVIL_E2E_USER_DATA] : [])],
});
