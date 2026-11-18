import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { Attachment, ChatState, HostMessage, WebviewMessage } from "../shared/protocol.ts";

type PanelView = Extract<HostMessage, { type: "showView" }>["view"];

export class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewId = "anvil.chat";
  private view: vscode.WebviewView | undefined;
  private latest: ChatState | undefined;
  private readonly extensionUri: vscode.Uri;
  private readonly onMessage: (message: WebviewMessage, reply: (message: HostMessage) => void) => void;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri, onMessage: (message: WebviewMessage, reply: (message: HostMessage) => void) => void) {
    this.extensionUri = extensionUri;
    this.onMessage = onMessage;
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    const webviewRoot = vscode.Uri.joinPath(this.extensionUri, "dist", "webview");
    view.webview.options = { enableScripts: true, localResourceRoots: [webviewRoot] };
    view.webview.html = this.html(view.webview, webviewRoot);
    this.disposables.push(
      view.webview.onDidReceiveMessage((message: WebviewMessage) => {
        if (message.type === "ready" && this.latest) this.post({ type: "state", state: this.latest });
        this.onMessage(message, (reply) => this.post(reply));
      }),
      view.onDidDispose(() => {
        this.view = undefined;
      }),
    );
  }

  pushState(state: ChatState): void {
    this.latest = state;
    this.post({ type: "state", state });
  }

  async attach(attachment: Attachment): Promise<void> {
    await this.reveal();
    this.post({ type: "attach", attachment });
  }

  async show(view: PanelView): Promise<void> {
    await this.reveal();
    this.post({ type: "showView", view });
  }

  private async reveal(): Promise<void> {
    await vscode.commands.executeCommand(`${ChatViewProvider.viewId}.focus`);
    for (let tries = 0; !this.view && tries < 20; tries++) await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private post(message: HostMessage): void {
    void this.view?.webview.postMessage(message);
  }

  private html(webview: vscode.Webview, root: vscode.Uri): string {
    const nonce = randomBytes(16).toString("base64");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(root, "index.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(root, "index.css"));
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style}">
<title>Anvil</title>
</head>
<body>
<div id="root"></div>
<script type="module" nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
  }
}
