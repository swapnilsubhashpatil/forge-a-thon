import { spawn, spawnSync, type ChildProcess } from "node:child_process";

/**
 * M4: run_command that reports like Codex/Gemini CLI: a summary line first (exit code, test result, first failure,
 * wall time), a tail-weighted clip that says how much was cut, ANSI stripped, an inactivity timeout plus a hard cap,
 * and the whole process tree killed on timeout or cancel (child processes otherwise survive `exec`'s kill).
 */

export interface CommandOptions {
  cwd: string;
  env?: Record<string, string>;
  /** Hard cap on total run time. */
  timeoutMs: number;
  /** Kill when the command prints nothing for this long. */
  idleTimeoutMs?: number;
}

export interface CommandResult {
  exitCode: string;
  output: string;
  wallMs: number;
  timedOut?: "idle" | "total";
}

const HEAD_CHARS = 2_000;
const TAIL_CHARS = 10_000;
const running = new Set<ChildProcess>();

export function runShell(command: string, options: CommandOptions): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: options.cwd,
      shell: true,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PAGER: "cat", GIT_PAGER: "cat", CI: "1", PYTHONUNBUFFERED: "1", ...options.env },
    });
    running.add(child);
    const chunks: string[] = [];
    let timedOut: CommandResult["timedOut"];
    let idle: ReturnType<typeof setTimeout> | undefined;
    const armIdle = () => {
      if (!options.idleTimeoutMs) return;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        timedOut ??= "idle";
        killTree(child);
      }, options.idleTimeoutMs);
    };
    const total = setTimeout(() => {
      timedOut ??= "total";
      killTree(child);
    }, options.timeoutMs);
    armIdle();
    const collect = (data: Buffer) => {
      chunks.push(data.toString("utf8"));
      armIdle();
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    const finish = (code: number | null, signal: NodeJS.Signals | null, error?: Error) => {
      clearTimeout(total);
      if (idle) clearTimeout(idle);
      running.delete(child);
      const exitCode = timedOut ? "timeout" : error ? "spawn-error" : code === null ? `signal ${signal ?? "?"}` : String(code);
      resolve({ exitCode, output: (error ? `${error.message}\n` : "") + chunks.join(""), wallMs: Date.now() - started, timedOut });
    };
    child.on("error", (error) => finish(null, null, error));
    child.on("close", (code, signal) => finish(code, signal));
  });
}

/** Kills every command still running, e.g. when the user cancels the turn. */
export function killAllCommands(): void {
  for (const child of running) killTree(child);
}

function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
    else process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)/g, "").replace(/\r(?!\n)/g, "\n");
}

/** Keeps the head and (mostly) the tail, where test summaries and tracebacks end up. */
export function clipOutput(text: string, head = HEAD_CHARS, tail = TAIL_CHARS): string {
  if (text.length <= head + tail) return text;
  const lines = text.split("\n").length;
  const kept = text.slice(0, head) + text.slice(-tail);
  const keptLines = kept.split("\n").length;
  return `${text.slice(0, head)}\n… ${text.length - head - tail} characters omitted (output had ${lines} lines, ~${keptLines} shown) …\n${text.slice(-tail)}`;
}

/** One-line digest of test-runner output: counts and the first failure location. */
export function summarizeTests(output: string): string | undefined {
  const pytest = [...output.matchAll(/^=*\s*((?:\d+ (?:failed|passed|errors?|skipped|xfailed|xpassed|deselected|warnings?)(?:, )?)+) in [\d.]+s/gm)].at(-1);
  if (pytest) {
    const failure = /^FAILED (\S+)/m.exec(output)?.[1] ?? /^(\S+\.py:\d+): \w*Error/m.exec(output)?.[1] ?? /^ERROR (\S+)/m.exec(output)?.[1];
    return failure ? `${pytest[1]} · first failure ${failure}` : pytest[1];
  }
  const jest = /^Tests:\s+(.+total)/m.exec(output);
  if (jest) {
    const failure = /●\s+(.+?)\s*$/m.exec(output)?.[1];
    return failure ? `${jest[1]} · first failure ${failure}` : jest[1];
  }
  const nodePass = /^ℹ pass (\d+)/m.exec(output);
  const nodeFail = /^ℹ fail (\d+)/m.exec(output);
  if (nodePass && nodeFail) {
    const failure = /^not ok \d+ - (.+)$/m.exec(output)?.[1];
    return `${nodeFail[1]} failed, ${nodePass[1]} passed${failure ? ` · first failure ${failure}` : ""}`;
  }
  return undefined;
}

export function formatCommandResult(command: string, result: CommandResult, idleTimeoutMs?: number): string {
  const output = stripAnsi(result.output).trim();
  const seconds = (result.wallMs / 1000).toFixed(1);
  const timeout =
    result.timedOut === "idle"
      ? `timed out: no output for ${Math.round((idleTimeoutMs ?? 0) / 1000)}s (process tree killed)`
      : result.timedOut === "total"
        ? `timed out after ${seconds}s (process tree killed)`
        : undefined;
  const header = [`exit ${result.exitCode}`, summarizeTests(output), timeout, `${seconds}s`].filter(Boolean).join(" · ");
  return `$ ${command}\n${header}\n${output ? clipOutput(output) : "(no output)"}`;
}
