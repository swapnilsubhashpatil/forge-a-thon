import { homedir } from "node:os";
import { join } from "node:path";
import * as vscode from "vscode";
import type { ConversationStore } from "../agent/conversationStore.ts";
import { discoverSkills, parseSlashCommand, renderSkill, resolveSkillFile, SKILL_FILE, SKILL_NAME, skillRoots, skillsIndex, skillTemplate, type Skill } from "../context/skills.ts";
import type { WebviewMessage } from "../shared/protocol.ts";

type SkillMessage = Extract<WebviewMessage, { type: "createSkill" | "toggleSkill" | "openSkill" | "deleteSkill" }>;
type Scope = "project" | "user";

const DISABLED_KEY = "skills.disabled";

export class SkillManager {
  private skills: Skill[] = [];
  private readonly folder: vscode.Uri;
  private readonly store: ConversationStore;

  constructor(folder: vscode.Uri, store: ConversationStore) {
    this.folder = folder;
    this.store = store;
    this.refresh();
  }

  refresh(): Skill[] {
    const disabled = vscode.workspace.getConfiguration("anvil").get<string[]>(DISABLED_KEY, []);
    this.skills = discoverSkills(skillRoots(this.folder.fsPath), disabled);
    this.store.update((state) => {
      state.skills = this.skills.map(({ name, description, source, path, enabled }) => ({ name, description, source, path, enabled }));
    });
    return this.skills;
  }

  index(): string | undefined {
    return skillsIndex(this.skills);
  }

  use(name: string): string {
    const skill = this.find(name);
    if (!skill) return `No skill named ${name}. Available: ${this.skills.filter((entry) => entry.enabled).map((entry) => entry.name).join(", ") || "none"}.`;
    if (!skill.enabled) return `The skill ${name} is turned off in Anvil settings.`;
    return renderSkill(skill, this.folder.fsPath);
  }

  invocation(text: string): { name: string; request: string; preamble: string } | undefined {
    const slash = parseSlashCommand(text);
    const skill = slash && this.find(slash.name);
    if (!slash || !skill?.enabled) return undefined;
    return {
      name: skill.name,
      request: slash.rest || `Follow the ${skill.name} skill.`,
      preamble: `The user invoked the ${skill.name} skill for this request. Follow it:\n${renderSkill(skill, this.folder.fsPath)}\n\n`,
    };
  }

  file(path: string): string | undefined {
    return resolveSkillFile(path, this.folder.fsPath, this.skills);
  }

  register(): vscode.Disposable[] {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.refresh(), 150);
    };
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.folder, "{.anvil,.claude}/skills/**"));
    return [
      watcher,
      watcher.onDidCreate(later),
      watcher.onDidChange(later),
      watcher.onDidDelete(later),
      vscode.workspace.onDidChangeConfiguration((event) => event.affectsConfiguration(`anvil.${DISABLED_KEY}`) && this.refresh()),
      vscode.commands.registerCommand("anvil.newSkill", () => this.promptNew()),
      vscode.commands.registerCommand("anvil.openSkillsFolder", () => this.openFolder()),
      { dispose: () => clearTimeout(timer) },
    ];
  }

  async handle(message: SkillMessage): Promise<void> {
    switch (message.type) {
      case "createSkill":
        return this.create(message.name, message.description, message.scope);
      case "toggleSkill":
        return this.toggle(message.name, message.enabled);
      case "openSkill": {
        const skill = this.find(message.name);
        if (skill) await vscode.window.showTextDocument(vscode.Uri.file(skill.path));
        return;
      }
      case "deleteSkill":
        return this.remove(message.name);
    }
  }

  private find(name: string): Skill | undefined {
    return this.skills.find((skill) => skill.name === name);
  }

  private dir(scope: Scope): vscode.Uri {
    return scope === "project" ? vscode.Uri.joinPath(this.folder, ".anvil", "skills") : vscode.Uri.file(join(homedir(), ".anvil", "skills"));
  }

  private async create(rawName: string, description: string, scope: Scope): Promise<void> {
    const name = rawName.trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (!SKILL_NAME.test(name)) {
      void vscode.window.showWarningMessage("Anvil: skill names use lowercase letters, numbers and hyphens, for example release-notes.");
      return;
    }
    if (this.refresh().some((skill) => skill.name === name)) {
      void vscode.window.showWarningMessage(`Anvil: a skill named ${name} already exists.`);
      return;
    }
    const file = vscode.Uri.joinPath(this.dir(scope), name, SKILL_FILE);
    await vscode.workspace.fs.writeFile(file, new TextEncoder().encode(skillTemplate(name, description.trim() || `Describe when to use ${name}.`)));
    this.refresh();
    await vscode.window.showTextDocument(file);
  }

  private async toggle(name: string, enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration("anvil");
    const current = config.get<string[]>(DISABLED_KEY, []);
    const next = enabled ? current.filter((entry) => entry !== name) : [...new Set([...current, name])];
    const target = config.inspect(DISABLED_KEY)?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    await config.update(DISABLED_KEY, next, target);
  }

  private async remove(name: string): Promise<void> {
    const skill = this.find(name);
    if (!skill) return;
    await vscode.workspace.fs.delete(vscode.Uri.file(skill.dir), { recursive: true, useTrash: true });
    this.refresh();
  }

  private async promptNew(): Promise<void> {
    const name = await vscode.window.showInputBox({
      title: "Anvil · New skill",
      prompt: "Skill name: lowercase letters, numbers and hyphens",
      placeHolder: "release-notes",
      validateInput: (value) => (SKILL_NAME.test(value.trim()) ? undefined : "Use lowercase letters, numbers and hyphens"),
    });
    if (!name) return;
    const description = await vscode.window.showInputBox({ title: "Anvil · New skill", prompt: "When should the agent use it?", placeHolder: "Use when writing release notes from merged PRs" });
    if (description === undefined) return;
    const scope = await this.pickScope("Where should the skill live?");
    if (scope) await this.create(name, description, scope);
  }

  private async openFolder(): Promise<void> {
    const scope = await this.pickScope("Open which skills folder?");
    if (!scope) return;
    const dir = this.dir(scope);
    await vscode.workspace.fs.createDirectory(dir);
    await vscode.commands.executeCommand(scope === "project" ? "revealInExplorer" : "revealFileInOS", dir);
  }

  private async pickScope(title: string): Promise<Scope | undefined> {
    const picks: Array<vscode.QuickPickItem & { scope: Scope }> = [
      { label: "Project", description: ".anvil/skills in this workspace, shared through git", scope: "project" },
      { label: "User", description: "~/.anvil/skills, available in every workspace", scope: "user" },
    ];
    return (await vscode.window.showQuickPick(picks, { title: `Anvil · ${title}` }))?.scope;
  }
}
