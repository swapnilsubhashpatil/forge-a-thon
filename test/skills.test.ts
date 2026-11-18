import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills, parseFrontmatter, parseSlashCommand, renderSkill, resolveSkillFile, skillRoots, skillsIndex, skillTemplate } from "../src/context/skills.ts";

const tree = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "anvil-skills-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
};

test("frontmatter: plain, quoted, folded and missing", () => {
  const parsed = parseFrontmatter("---\nname: lint-fix\ndescription: \"Fix lint: all of it\"\n---\n# Lint\nRun it.");
  assert.deepEqual(parsed.data, { name: "lint-fix", description: "Fix lint: all of it" });
  assert.equal(parsed.body, "# Lint\nRun it.");
  const folded = parseFrontmatter("---\r\ndescription: >\r\n  Use when\r\n  releasing.\r\nallowed-tools: 'it''s'\r\n---\r\nBody");
  assert.deepEqual(folded.data, { description: "Use when releasing.", "allowed-tools": "it's" });
  assert.deepEqual(parseFrontmatter("No frontmatter here"), { data: {}, body: "No frontmatter here" });
  assert.deepEqual(parseFrontmatter("---\n---\nonly body").body, "only body");
});

test("discovery: project beats user, .anvil beats .claude, disabled flagged, folder name and body fallbacks", () => {
  const workspace = tree({
    ".anvil/skills/release/SKILL.md": "---\nname: release\ndescription: project anvil\n---\nA",
    ".claude/skills/release/SKILL.md": "---\nname: release\ndescription: project claude\n---\nB",
    ".claude/skills/no-meta/SKILL.md": "# Title\nCut a build first.",
    ".claude/skills/empty-dir/notes.md": "not a skill",
  });
  const home = tree({
    ".anvil/skills/release/SKILL.md": "---\ndescription: user\n---\nC",
    ".claude/skills/review/SKILL.md": "---\nname: review\ndescription: user review\n---\nD",
  });
  const skills = discoverSkills(skillRoots(workspace, home), ["review"]);
  assert.deepEqual(skills.map((skill) => [skill.name, skill.source, skill.description, skill.enabled]), [
    ["release", "project", "project anvil", true],
    ["no-meta", "project", "Cut a build first.", true],
    ["review", "user", "user review", false],
  ]);
  const index = skillsIndex(skills) ?? "";
  assert.match(index, /- release: project anvil/);
  assert.doesNotMatch(index, /review/);
  assert.equal(skillsIndex(skills.map((skill) => ({ ...skill, enabled: false }))), undefined);
});

test("skills index stays within its budget", () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ name: `skill-${i}`, description: "x ".repeat(80), source: "user" as const, path: "", dir: "", body: "", enabled: true }));
  const index = skillsIndex(many, 400) ?? "";
  assert.ok(index.length / 4 <= 400, String(index.length));
  assert.match(index, /more; call use_skill/);
});

test("supporting files are listed and readable only inside skill folders", () => {
  const workspace = tree({
    ".anvil/skills/deploy/SKILL.md": "---\nname: deploy\ndescription: d\n---\nSteps",
    ".anvil/skills/deploy/scripts/check.sh": "echo ok",
    "secret.txt": "no",
  });
  const skills = discoverSkills(skillRoots(workspace, tree({})));
  const rendered = renderSkill(skills[0], workspace);
  assert.match(rendered, /<skill name="deploy" source="project">\nSteps/);
  assert.match(rendered, /- \.anvil\/skills\/deploy\/scripts\/check\.sh/);
  assert.ok(resolveSkillFile(".anvil/skills/deploy/scripts/check.sh", workspace, skills));
  assert.equal(resolveSkillFile("secret.txt", workspace, skills), undefined);
  assert.equal(resolveSkillFile(".anvil/skills/deploy/../../../secret.txt", workspace, skills), undefined);
});

test("slash commands and the template round-trip", () => {
  assert.deepEqual(parseSlashCommand("/release cut 1.2.0\nnow"), { name: "release", rest: "cut 1.2.0\nnow" });
  assert.deepEqual(parseSlashCommand("  /review"), { name: "review", rest: "" });
  assert.equal(parseSlashCommand("fix /etc/hosts"), undefined);
  assert.equal(parseSlashCommand("/ nothing"), undefined);
  const parsed = parseFrontmatter(skillTemplate("api-docs", "Use when: docs change"));
  assert.deepEqual(parsed.data, { name: "api-docs", description: "Use when: docs change" });
  assert.match(parsed.body, /^# Api Docs[\s\S]*## When to use[\s\S]*## Steps[\s\S]*## Examples/);
});
