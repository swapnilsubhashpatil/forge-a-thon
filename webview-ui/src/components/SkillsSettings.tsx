import { useState } from "react";
import type { SkillSummary } from "../../../src/shared/protocol.ts";
import { cx } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, IconButton, inputClass, Switch } from "./primitives.tsx";

type Scope = "project" | "user";

function SkillRow({ skill }: { skill: SkillSummary }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="rounded-md px-1 py-1 hover:bg-hover">
      <div className="flex items-center gap-1.5">
        <Switch
          on={skill.enabled}
          label={`${skill.enabled ? "Turn off" : "Turn on"} ${skill.name}`}
          title={skill.enabled ? "On: the agent can use it" : "Off: hidden from the agent"}
          onChange={(enabled) => post({ type: "toggleSkill", name: skill.name, enabled })}
        />
        <span className={cx("min-w-0 truncate font-mono text-xs", skill.enabled ? "text-fg" : "text-muted")}>{skill.name}</span>
        <span className="shrink-0 rounded-sm bg-badge/30 px-1 text-[10px] text-muted">{skill.source}</span>
        <span className="flex-1" />
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
      {skill.description && <p className="mt-0.5 pl-8.5 text-xs text-muted">{skill.description}</p>}
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
    <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border p-2">
      <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} placeholder="release-notes" aria-label="Skill name" className={cx(inputClass, "font-mono")} />
      <input value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} placeholder="Use when writing release notes from merged PRs" aria-label="When to use it" className={inputClass} />
      <div role="radiogroup" aria-label="Where it lives" className="flex rounded-lg border border-border bg-editor/40 p-0.5 text-xs">
        {(["project", "user"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            title={value === "project" ? ".anvil/skills in this workspace" : "~/.anvil/skills, every workspace"}
            onClick={() => setScope(value)}
            className={cx("h-6 flex-1 rounded-md font-medium", scope === value ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg")}
          >
            {value === "project" ? "This project" : "All my projects"}
          </button>
        ))}
      </div>
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
    <>
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
      {adding ? (
        <NewSkillForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn mt-2 w-full justify-start border border-dashed border-border text-muted hover:text-fg">
          <Icon name="plus" />
          New skill
        </button>
      )}
    </>
  );
}
