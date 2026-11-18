import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ZodRawShape } from "zod";

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  annotations: ToolAnnotations;
  run(args: Record<string, unknown>): Promise<string>;
}

export interface RunningToolServer {
  url: string;
  token: string;
  close(): Promise<void>;
}

const MAX_BODY_BYTES = 4 * 1024 * 1024;

/** Post-processes every successful tool result, e.g. to deliver messages the user sent mid-turn. */
export type ResultDecorator = (name: string, args: Record<string, unknown>, result: string) => string;

export async function startToolServer(tools: ToolDefinition[], log: (line: string) => void, decorate?: ResultDecorator): Promise<RunningToolServer> {
  const token = randomBytes(24).toString("hex");
  const expected = Buffer.from(`Bearer ${token}`);

  const buildServer = () => {
    const server = new McpServer({ name: "anvil-editor", version: "0.1.0" });
    for (const tool of tools) {
      server.registerTool(
        tool.name,
        { title: tool.title, description: tool.description, inputSchema: tool.inputSchema, annotations: tool.annotations },
        async (args: Record<string, unknown>) => {
          try {
            const result = await tool.run(args);
            return { content: [{ type: "text" as const, text: decorate ? decorate(tool.name, args, result) : result }] };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Tool ${tool.name} failed: ${message}`);
            return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
          }
        },
      );
    }
    return server;
  };

  const isAuthorized = (header: string | undefined) => {
    if (!header) return false;
    const given = Buffer.from(header);
    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  const httpServer = http.createServer(async (request, response) => {
    try {
      if (!request.url?.startsWith("/mcp")) {
        response.writeHead(404).end();
        return;
      }
      if (!isAuthorized(request.headers.authorization)) {
        response.writeHead(401).end();
        return;
      }
      const body = await readJsonBody(request);
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      response.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch (error) {
      log(`Tool server request failed: ${error instanceof Error ? error.message : String(error)}`);
      if (!response.headersSent) response.writeHead(500).end();
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address() as AddressInfo;
  log(`Tool server listening on 127.0.0.1:${port}`);

  return {
    url: `http://127.0.0.1:${port}/mcp`,
    token,
    close: () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
  };
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  if (request.method !== "POST") return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}
