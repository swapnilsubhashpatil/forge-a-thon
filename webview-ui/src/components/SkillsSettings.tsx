import { useState } from "react";
import type { SkillSummary } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, IconButton, inputClass, ListToolbar, Segmented, Switch } from "./primitives.tsx";

type Scope = "project" | "user";

const scopes: Array<{ value: Scope; label: string; title: string }> = [
  { value: "project", label: "This project", title: ".anvil/skills in this workspace" },
  { value: "user", label: "All my projects", title: "~/.anvil/skills, every workspace" },
];

function SkillRow({ skill }: { skill: SkillSummary }) {
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-md px-1 py-1 hover:bg-hover">
      <div className="flex items-center gap-1.5">
        <span className={cx("min-w-0 truncate font-mono text-xs", skill.enabled ? "text-fg" : "text-muted")}>{skill.name}</span>
        <span className="shrink-0 rounded-sm bg-badge/30 px-1 text-[10px] text-muted">{skill.source}</span>
        <span className="flex-1" />
        <Switch
          on={skill.enabled}
          label={`${skill.enabled ? "Turn off" : "Turn on"} ${skill.name}`}
          title={skill.enabled ? "On: the agent can use it" : "Off: hidden from the agent"}
          onChange={(enabled) => post({ type: "toggleSkill", name: skill.name, enabled })}
        />
        {confirming ? (
          <>
            <button type="button" onClick={() => post({ type: "deleteSkill", name: skill.name })} className="btn btn-secondary text-red">
              Move to trash
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn">
              Cancel
            </button>
          </>
        ) : (
          <>
            <IconButton icon="edit" label={`Open ${skill.name} SKILL.md`} onClick={() => post({ type: "openSkill", name: skill.name })} />
            <IconButton icon="trash" label={`Delete ${skill.name}`} onClick={() => setConfirming(true)} />
          </>
        )}
      </div>
      {skill.description && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex w-full min-w-0 items-start gap-1 text-left text-xs text-muted hover:text-fg">
          <Icon name={expanded ? "chevron-down" : "chevron-right"} size={12} className="mt-0.5" />
          <span className={cx("min-w-0 flex-1", !expanded && "truncate")}>{skill.description}</span>
        </button>
      )}
    </li>
  );
}

function NewSkillForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>("project");
  const slug = name.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const valid = /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug);
  const create = () => {
    if (!valid) return;
    post({ type: "createSkill", name: slug, description: description.trim(), scope });
    onDone();
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
      <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} placeholder="release-notes" aria-label="Skill name" className={cx(inputClass, "font-mono")} />
      <input value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} placeholder="Use when writing release notes from merged PRs" aria-label="When to use it" className={inputClass} />
      <Segmented label="Where it lives" options={scopes} value={scope} onChange={setScope} />
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 text-xs text-muted">{name && !valid ? "Lowercase letters, numbers and hyphens" : "Opens SKILL.md to fill in"}</span>
        <button type="button" onClick={onDone} className="btn">
          Cancel
        </button>
        <button type="button" disabled={!valid} onClick={create} className="btn btn-primary">
          Create
        </button>
      </div>
    </div>
  );
}

export function SkillsSettings({ skills }: { skills: SkillSummary[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <ListToolbar summary={`${skills.length} ${skills.length === 1 ? "skill" : "skills"}`}>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-secondary">
            <Icon name="plus" />
            New skill
          </button>
        )}
      </ListToolbar>
      {adding && <NewSkillForm onDone={() => setAdding(false)} />}
      {skills.length === 0 ? (
        <p className="text-xs text-muted">
          No skills yet. A skill is a folder with a <code className="font-mono text-fg">SKILL.md</code> in <code className="font-mono text-fg">.anvil/skills</code> or{" "}
          <code className="font-mono text-fg">.claude/skills</code>, in this workspace or your home folder. Claude Code skills work as they are.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {skills.map((skill) => (
            <SkillRow key={skill.name} skill={skill} />
          ))}
        </ul>
      )}
    </div>
  );
}
