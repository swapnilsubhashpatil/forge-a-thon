# Skills

A skill is a reusable set of instructions the agent loads only when it needs them: how your team cuts a release, how a
migration is written, which checks a PR must pass. Anvil uses the same format and folders as Claude Code, so an existing
Claude Code skill works unchanged.

## Set up your first skill

1. Open the Anvil panel, click the gear (Settings) and scroll to **Skills**.
2. Click **New skill**, enter a name such as `release-notes` and one line on when to use it, for example
   `Use when writing release notes from merged PRs`.
3. Choose **This project** (`.anvil/skills`, shared through git) or **All my projects** (`~/.anvil/skills`).
4. Press `Enter` or click **Create**. Anvil writes `SKILL.md` from a template and opens it.
5. Fill in the sections and save. The skill shows up in Settings and in the `/` menu straight away.

The same flow is available from the Command Palette (`Ctrl+Shift+P`): **Anvil: New Skill**. **Anvil: Open Skills
Folder** reveals the project or user skills folder.

## File format

```
.anvil/skills/release-notes/
├── SKILL.md
└── template.md        optional supporting files
```

`SKILL.md` starts with YAML frontmatter, followed by markdown instructions:

```markdown
---
name: release-notes
description: Use when writing release notes from merged PRs
---

# Release Notes

## When to use
The user asks for release notes, a changelog entry or a summary of what shipped.

## Steps
1. Run `git log --merges --oneline <last-tag>..HEAD` with run_command.
2. Group the PRs into Features, Fixes and Internal.
3. Write the notes in the style of template.md.

## Examples
- "Draft the notes for 2.4.0" → a CHANGELOG.md section with three groups.
```

| Field | Required | Notes |
|---|---|---|
| `name` | no | Lowercase letters, numbers and hyphens. Defaults to the folder name. This is what you type after `/`. |
| `description` | recommended | The agent decides whether to load the skill from this line alone, so say when to use it. Without it Anvil uses the first line of the body. |

Other frontmatter keys (for example Claude Code's `allowed-tools`) are accepted and ignored.

## Where skills live

Anvil scans these folders, in this order. When two skills share a name, the first one wins.

| Priority | Folder | Scope |
|---|---|---|
| 1 | `<workspace>/.anvil/skills/<name>/SKILL.md` | project |
| 2 | `<workspace>/.claude/skills/<name>/SKILL.md` | project |
| 3 | `~/.anvil/skills/<name>/SKILL.md` | user |
| 4 | `~/.claude/skills/<name>/SKILL.md` | user |

Project folders are watched, so adding, editing or deleting a skill there updates the list at once. User folders are
re-scanned when the panel opens and before every message.

## How the agent uses skills

- Every Agent and Ask message carries a short **Available skills** list inside the `<context>` block: one line per
  enabled skill (`name: description`), capped at about 400 tokens.
- When a request matches a description, the agent calls the read-only `use_skill` tool with the name. It gets the body of
  `SKILL.md` plus a list of supporting files, then follows the steps.
- The agent can open any listed supporting file with `read_file`, including files of a user skill in your home folder.
  `read_file` still refuses everything else outside the workspace.
- The tool call shows in the transcript as **Used skill release-notes**.

## Run a skill yourself

1. Type `/` at the start of the composer. A menu lists the enabled skills.
2. Keep typing to filter, move with `↑` / `↓`, pick with `Enter` or `Tab`. `Esc` closes the menu.
3. Anvil inserts `/release-notes `. Add the request after it, for example `/release-notes for 2.4.0`, and press `Enter`.

Anvil puts the whole skill into that message, so the agent does not need to call `use_skill`. The Context card shows a
pinned **skill: release-notes** chip. A `/name` that matches no enabled skill is sent as plain text.

## Manage skills

Settings → **Skills** lists every skill with its scope (`project` or `user`):

| Control | What it does |
|---|---|
| Switch | Turns the skill on or off. Off skills are left out of the list the agent sees, `use_skill` refuses them and `/` hides them. Stored in `anvil.skills.disabled`. |
| Pencil | Opens `SKILL.md` in the editor. |
| Bin, then **Move to trash** | Moves the whole skill folder to the OS trash. |
| **New skill** | Creates a skill from the template, see above. |

## Claude Code compatibility

- Same file name, frontmatter and folder layout, and Anvil also reads `.claude/skills` in the workspace and in your home
  folder. Skills you already use with Claude Code appear in Anvil without changes.
- To share a skill with both tools, keep it under `.claude/skills`. Put Anvil-only variants under `.anvil/skills`: on a
  name clash the `.anvil` copy wins.
- Claude Code features that Anvil does not apply: `allowed-tools` restrictions and running bundled scripts on its own.
  The agent can still run a skill's script with `run_command`, which asks for your approval as usual.
