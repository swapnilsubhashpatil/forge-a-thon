import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import type { HarnessClient } from "./harnessClient.ts";

export const HARNESS_PACKAGE = "@truefoundry/trueforge@0.185.1";
export const LOOPBACK_ALLOWLIST = '["127.0.0.1","localhost"]';

const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_500;

export class HarnessProcess {
  private child: ChildProcess | undefined;
  private readonly dataDir: string;
  private readonly log: (line: string) => void;

  constructor(dataDir: string, log: (line: string) => void) {
    this.dataDir = dataDir;
    this.log = log;
  }

  isLocal(url: string): boolean {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  }

  async ensure(client: HarnessClient, autoStart: boolean): Promise<"connected" | "started"> {
    if (await client.ping()) return "connected";
    if (!autoStart || !this.isLocal(client.baseUrl)) {
      throw new Error(`TrueForge is not reachable at ${client.baseUrl}`);
    }
    this.start(new URL(client.baseUrl).port || "8790");
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.child?.exitCode !== null && this.child?.exitCode !== undefined) {
        throw new Error(`TrueForge exited with code ${this.child.exitCode}. See the Anvil output channel.`);
      }
      if (await client.ping()) return "started";
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error("TrueForge did not become ready within two minutes");
  }

  private start(port: string): void {
    if (this.child && this.child.exitCode === null) return;
    mkdirSync(this.dataDir, { recursive: true });
    this.log(`Starting ${HARNESS_PACKAGE} on port ${port}`);
    this.child = spawn("npx", ["-y", HARNESS_PACKAGE], {
      cwd: this.dataDir,
      shell: process.platform === "win32",
      windowsHide: true,
      env: { ...process.env, PORT: port, OUTBOUND_URL_ALLOWED_HOSTS: LOOPBACK_ALLOWLIST },
    });
    this.child.stdout?.on("data", (chunk: Buffer) => this.log(chunk.toString().trimEnd()));
    this.child.stderr?.on("data", (chunk: Buffer) => this.log(chunk.toString().trimEnd()));
    this.child.on("exit", (code) => this.log(`TrueForge exited (${code ?? "signal"})`));
  }

  dispose(): void {
    if (!this.child || this.child.exitCode !== null) return;
    if (process.platform === "win32" && this.child.pid) {
      spawn("taskkill", ["/pid", String(this.child.pid), "/t", "/f"], { windowsHide: true });
    } else {
      this.child.kill();
    }
  }
}
