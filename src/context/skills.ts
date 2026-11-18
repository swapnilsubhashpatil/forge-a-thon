import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { SkillSummary } from "../shared/protocol.ts";
import { estimateTokens } from "./tokens.ts";

export const SKILL_FILE = "SKILL.md";
export const SKILLS_INDEX_BUDGET_TOKENS = 400;
export const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_SUPPORTING_FILES = 40;

export interface SkillRoot {
  dir: string;
  source: SkillSummary["source"];
}

export interface Skill extends SkillSummary {
  dir: string;
  body: string;
}

export function skillRoots(workspace: string | undefined, home = homedir()): SkillRoot[] {
  const project: SkillRoot[] = workspace
    ? [{ dir: join(workspace, ".anvil", "skills"), source: "project" }, { dir: join(workspace, ".claude", "skills"), source: "project" }]
    : [];
  return [...project, { dir: join(home, ".anvil", "skills"), source: "user" }, { dir: join(home, ".claude", "skills"), source: "user" }];
}

export function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const match = /^﻿?---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { data: {}, body: text.replace(/^﻿/, "").trim() };
  const data: Record<string, string> = {};
  let key: string | undefined;
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(line);
    if (pair) {
      key = pair[1];
      data[key] = /^[|>][+-]?$/.test(pair[2].trim()) ? "" : unquote(pair[2].trim());
    } else if (key && /^\s+\S/.test(line)) {
      data[key] = `${data[key]} ${line.trim()}`.trim();
    }
  }
  return { data, body: text.slice(match[0].length).trim() };
}

function unquote(value: string): string {
  if (/^".*"$/.test(value)) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return /^'.*'$/.test(value) ? value.slice(1, -1).replaceAll("''", "'") : value;
}

export function discoverSkills(roots: SkillRoot[], disabled: string[] = []): Skill[] {
  const skills = new Map<string, Skill>();
  for (const root of roots) {
    for (const entry of listDir(root.dir).sort()) {
      const dir = join(root.dir, entry);
      const path = join(dir, SKILL_FILE);
      if (!isFile(path)) continue;
      const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
      const name = (data.name || entry).trim();
      if (skills.has(name)) continue;
      const description = data.description || body.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#"))?.trim() || "";
      skills.set(name, { name, description, source: root.source, path, dir, body, enabled: !disabled.includes(name) });
    }
  }
  return [...skills.values()];
}

export function skillsIndex(skills: Skill[], budgetTokens = SKILLS_INDEX_BUDGET_TOKENS): string | undefined {
  const enabled = skills.filter((skill) => skill.enabled);
  if (!enabled.length) return undefined;
  const lines = ["Available skills (when a request matches one, call use_skill with its name first and follow it):"];
  for (const [index, skill] of enabled.entries()) {
    const line = `- ${skill.name}: ${clip(skill.description, 200)}`;
    if (estimateTokens([...lines, line].join("\n")) > budgetTokens - 12) {
      lines.push(`- (${enabled.length - index} more; call use_skill with a name to load one)`);
      break;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function parseSlashCommand(text: string): { name: string; rest: string } | undefined {
  const match = /^\/([a-z0-9][\w-]*)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return match ? { name: match[1], rest: (match[2] ?? "").trim() } : undefined;
}

export function renderSkill(skill: Skill, workspace: string | undefined): string {
  const files = supportingFiles(skill.dir).map((path) => `- ${readablePath(path, workspace)}`);
  return [
    `<skill name="${skill.name}" source="${skill.source}">`,
    skill.body,
    files.length ? `\nSupporting files (open them with read_file when a step needs them):\n${files.join("\n")}` : "",
    "</skill>",
  ].filter(Boolean).join("\n");
}

export function resolveSkillFile(path: string, workspace: string | undefined, skills: Skill[]): string | undefined {
  const absolute = resolve(workspace ?? "", path);
  const inside = skills.some((skill) => {
    const rel = relative(skill.dir, absolute);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });
  return inside && isFile(absolute) ? absolute : undefined;
}

export function skillTemplate(name: string, description: string): string {
  const title = name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const yaml = /^[\w ,.()/-]*$/.test(description) ? description : JSON.stringify(description);
  return [
    "---",
    `name: ${name}`,
    `description: ${yaml}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## When to use",
    "",
    "Describe the requests this skill is for. The agent reads the description above to decide when to load it.",
    "",
    "## Steps",
    "",
    "1. First thing the agent should do.",
    "2. Next step, with the commands or files involved.",
    "3. How to check the result.",
    "",
    "## Examples",
    "",
    "- A request that should use this skill, and what a good result looks like.",
    "",
  ].join("\n");
}

function supportingFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of listDir(dir).sort()) {
    if (out.length >= MAX_SUPPORTING_FILES) break;
    const path = join(dir, entry);
    if (isFile(path)) {
      if (!(dir === base && entry === SKILL_FILE)) out.push(path);
    } else if (!entry.startsWith(".")) {
      out.push(...supportingFiles(path, base).slice(0, MAX_SUPPORTING_FILES - out.length));
    }
  }
  return out;
}

function readablePath(path: string, workspace: string | undefined): string {
  const rel = workspace ? relative(workspace, path) : "";
  return (rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : path).replaceAll("\\", "/");
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
