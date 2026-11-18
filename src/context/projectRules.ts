import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { estimateTokens } from "./tokens.ts";

export const RULE_FILES = ["AGENTS.md", "CLAUDE.md", ".anvil/rules.md", ".cursorrules", ".clinerules", ".github/copilot-instructions.md"];
export const RULES_BUDGET_TOKENS = 1_200;

export interface ProjectRules {
  sources: string[];
  text: string;
  tokens: number;
  trimmed: boolean;
}

export function loadProjectRules(root: string, budgetTokens = RULES_BUDGET_TOKENS): ProjectRules | undefined {
  const parts: string[] = [];
  const sources: string[] = [];
  let remaining = budgetTokens;
  let trimmed = false;
  const seen = new Set<string>();
  for (const name of RULE_FILES) {
    const path = join(root, name);
    try {
      if (!existsSync(path) || !statSync(path).isFile()) continue;
    } catch {
      continue;
    }
    const body = readFileSync(path, "utf8").trim();
    if (!body || seen.has(body)) continue;
    seen.add(body);
    const header = `From ${name}:`;
    let text = body;
    if (estimateTokens(`${header}\n${text}`) > remaining) {
      const keep = Math.max(0, remaining * 4 - header.length - 40);
      if (keep < 200) {
        trimmed = true;
        break;
      }
      text = `${body.slice(0, keep)}\n… (trimmed; read_file ${name} for the rest)`;
      trimmed = true;
    }
    parts.push(`${header}\n${text}`);
    sources.push(name);
    remaining -= estimateTokens(`${header}\n${text}`);
    if (remaining <= 0) break;
  }
  if (!parts.length) return undefined;
  const text = `Project rules (follow them):\n${parts.join("\n\n")}`;
  return { sources, text, tokens: estimateTokens(text), trimmed };
}
