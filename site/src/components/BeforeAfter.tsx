import { useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, Database, ShieldAlert, LifeBuoy } from 'lucide-react'
import { EASE_OUT } from '../motion'
import { Disclosure, Dumbbell, Flow, Legend, SectionHead, AFTER } from './charts'

type Metric = { label: string; b: number | null; a: number; max: number; fmt: (v: number) => string }
type Row = { tag: string; term: string; gloss: string; before: string; after: string; metric?: string }
type Trait = {
  id: string; icon: typeof BadgeCheck; name: string; flow: string
  metrics: Metric[]; callout?: [string, string][]; note?: string; rows: Row[]
}

const of14 = (v: number) => `${v}/14`
const dec1 = (v: number) => v.toFixed(1)
const dec3 = (v: number) => v.toFixed(3)
const k = (v: number) => `${Math.round(v / 1000)}k`

// Numbers: docs/benchmarks/agent-mode.md ("By harness trait"), agent-mode-findings.md, context-history.md.
const traits: Trait[] = [
  {
    id: 'verify', icon: BadgeCheck, name: 'Verification loops',
    flow: 'You ask for a feature → agent edits → runs the detected test command → passes → finish_task(verified) → green chip.',
    metrics: [
      { label: 'Ended Task B with untested edits', b: 11, a: 0, max: 14, fmt: of14 },
      { label: 'Finished with a verified claim', b: 0, a: 10, max: 14, fmt: of14 },
      { label: 'Failed test runs per Task B', b: 3.1, a: 0.3, max: 3.1, fmt: dec1 },
      { label: 'Task B fully passed', b: 9, a: 10, max: 14, fmt: of14 },
    ],
    rows: [
      {
        tag: 'M8', term: 'Completion gate (finish_task)', gloss: 'A “done” call the model must make, which checks its claim.',
        before: 'TrueForge ends a turn as soon as the model replies without a tool call, so the agent could stop after editing and never test.',
        after: 'verified:true is rejected unless a command ran after the last accepted edit. A turn ending with edits and no finish_task gets one follow-up. The change set shows a green “verified” or amber “not verified: reason” chip.',
        metric: 'verified finish 0/14 → 10/14',
      },
      {
        tag: 'M5', term: 'Detected test command', gloss: 'Anvil works out how the repo runs its tests and tells the agent.',
        before: 'The agent guessed python -m pytest, which failed on Flask’s src/ layout; a lowercase Windows drive letter broke 7 unrelated tests.',
        after: '“Verify with: …” goes into the context pack. run_command sets PYTHONPATH=src for src/ layouts and upper-cases the drive letter.',
        metric: 'failed test runs 3.1 → 0.3',
      },
      {
        tag: '15', term: 'Follow-up after edits that never applied', gloss: 'If every edit attempt missed, the agent is asked to retry or explain.',
        before: 'GPT-5.4-mini proposed 4 edits whose old_string did not match, then ended silently.',
        after: 'One follow-up: re-read and retry, or finish_task with verified=false and a reason. Your own rejections do not count.',
        metric: 'GPT-5.4-mini Task B 1/2 → 2/2',
      },
    ],
  },
  {
    id: 'guard', icon: ShieldAlert, name: 'Guardrails',
    flow: 'The agent edits a function outside your selection → amber badge on the hunk → the model is told why.',
    metrics: [],
    callout: [['9/9', 'guard scenarios pass with a scripted misbehaving model'], ['0 → 0', 'warnings fired on Task B: real models stayed in scope']],
    rows: [
      {
        tag: 'G2', term: 'Scope badges', gloss: 'Flags changes outside your selection or on lines the agent never read.',
        before: 'Every hunk looked the same in review, wherever it landed.',
        after: 'Amber “outside selection” (inline) and “edited without reading” (agent). Never blocks Accept; the model is told which hunks were flagged.',
      },
      {
        tag: 'G3', term: 'Grounding badges', gloss: 'Flags calls and imports of names that exist nowhere in the project.',
        before: 'A call to a made-up helper looked like any other line.',
        after: 'Names are checked against the workspace symbol index, the file’s definitions, builtins and imports. Unknown names get a red badge and the model is told.',
      },
      {
        tag: 'M7', term: 'Loop guard', gloss: 'Notices when the agent repeats itself and stops it.',
        before: 'No stuck or loop detection, in Anvil or in TrueForge.',
        after: 'An identical call or a short A→B→A cycle gets a nudge at 3 repeats and a stop at 5.',
      },
      {
        tag: 'M3', term: 'Rejection feedback', gloss: 'Reject part of an edit and the model gets the file as it now is.',
        before: 'Only the rejected diff came back, so the model kept a stale picture of the file.',
        after: '“Accepted hunks are already written; this was the user’s decision, not a tool failure,” plus the current region (±4 lines, ≤60 lines).',
      },
      {
        tag: 'M1 · M6', term: 'Phased prompt and plan checklist', gloss: 'A fixed working order and a visible to-do list.',
        before: 'A 6-step prompt; the plan was free text that scrolled away.',
        after: 'Explore → Plan → (Edit → Verify)* → Summarise. A compact prompt for Ollama models. update_plan renders a live checklist.',
      },
    ],
  },
  {
    id: 'context', icon: Database, name: 'Context and state',
    flow: 'You type a request → Anvil ranks every file, adds co-changed tests and your AGENTS.md → the model starts with the right slice.',
    metrics: [
      { label: 'Input tokens per Task B', b: 193349, a: 141477, max: 193349, fmt: k },
      { label: 'read_file calls per Task B', b: 5.21, a: 4.29, max: 5.21, fmt: dec1 },
      { label: 'Held-out hit@5 (103 commits)', b: 0.825, a: 0.854, max: 1, fmt: dec3 },
      { label: 'Held-out all@5', b: 0.466, a: 0.515, max: 1, fmt: dec3 },
    ],
    note: 'Edited files inside Anvil’s top-5 prediction: 100% on both builds.',
    rows: [
      {
        tag: 'Pack', term: 'Context pack + git co-change', gloss: 'Every file is scored; the best slices are packed under a token budget.',
        before: 'Path match, BM25, symbol definitions, sibling symbols, test/docs companions, import-graph PageRank.',
        after: 'Adds git co-change companions and demotes requirements, CI, changelog and community files unless asked about.',
        metric: 'hit@5 0.825 → 0.854',
      },
      {
        tag: 'Rules', term: 'Project rules in the pack', gloss: 'The repo’s own notes for AI agents are read automatically.',
        before: 'AGENTS.md, CLAUDE.md, .cursorrules and similar files were ignored.',
        after: 'Placed at the top of the pack within a 1,200-token budget; the Context card lists which were used.',
      },
      {
        tag: 'G1', term: 'Live scorecard and context gauge', gloss: 'Predicted vs read vs edited files, and how full the window is.',
        before: 'The Context card listed chosen files; token totals appeared only at the end.',
        after: 'Three live lists, “edited files in top-5 predicted: n/m”, and a gauge against the 60k compaction trigger with cache-hit %.',
      },
      {
        tag: 'M2', term: 'Read-only subagents', gloss: 'Helper agents that can look but not touch.',
        before: 'TrueForge subagents get the parent’s tools, including propose_edit.',
        after: 'Write tools and nested subagents are denied; a read-only command allowlist is allowed.',
      },
      {
        tag: 'M11', term: 'Queued and steered messages', gloss: 'Keep typing while the agent works.',
        before: 'The composer was locked; in TrueForge a new message cancels the running turn.',
        after: 'Messages queue as chips and arrive in the next tool result as a <user_note>. “Stop and send” cancels first.',
      },
      {
        tag: '16 · 17', term: 'Selection or terminal output to chat', gloss: 'Point the agent at exact lines or the last command’s output.',
        before: 'Context came from @mentions and ranking only.',
        after: 'Ctrl+Alt+L sends a selection as numbered lines with its own 4k budget; terminal output can be sent too.',
      },
    ],
  },
  {
    id: 'safety', icon: LifeBuoy, name: 'Safe execution',
    flow: 'You press Stop mid pytest → the whole process tree is killed → nothing half-applied reaches disk.',
    metrics: [
      { label: 'Cancel left the tree clean', b: 14, a: 14, max: 14, fmt: of14 },
      { label: 'Dead endpoint → automatic failover', b: 10, a: 10, max: 14, fmt: of14 },
      { label: 'Restore (message + code) left the tree clean', b: null, a: 14, max: 14, fmt: of14 },
    ],
    rows: [
      {
        tag: 'M4', term: 'run_command that can always be stopped', gloss: 'Clear summaries, timeouts, and the whole process tree killed.',
        before: 'Output clipped at 12k chars, a timeout reported as “timeout”, and only the shell was killed.',
        after: '“exit N · summary · wall time” first; head/tail trimming; no pager, stdin closed; inactivity timeout plus hard cap; process-tree kill.',
      },
      {
        tag: 'M10', term: 'Step-limit wrap-up', gloss: 'Out of steps? Summarise instead of crashing.',
        before: 'The iteration-limit error tripped the circuit breaker and re-ran the task on the next model.',
        after: 'Its own failure kind: no failover, a notice, and one wrap-up turn via finish_task. A turn-budget hint from half way.',
      },
      {
        tag: '18', term: 'Restore to any message', gloss: 'Rewind the conversation, with or without its code.',
        before: 'Only “Undo Last Agent Change”.',
        after: '“Restore message” or “Restore message and code” on any message; files you edited by hand are skipped and listed.',
        metric: 'tree clean 14/14',
      },
    ],
  },
]

export default function BeforeAfter() {
  const [active, setActive] = useState(traits[0].id)
  const t = traits.find((x) => x.id === active) ?? traits[0]

  return (
    <section id="before-after" className="py-20 md:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHead eyebrow="02 · What we implemented" title="Before and after, by harness trait." />

        <div role="tablist" aria-label="Harness trait" className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 mb-6 [scrollbar-width:none]">
          {traits.map((x) => (
            <button key={x.id} role="tab" aria-selected={active === x.id} onClick={() => setActive(x.id)}
              className={`relative shrink-0 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${active === x.id ? 'text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'}`}>
              {active === x.id && <motion.span layoutId="trait-pill" className="absolute inset-0 rounded-full bg-gray-900" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
              <x.icon className="relative w-4 h-4" strokeWidth={1.75} />
              <span className="relative whitespace-nowrap">{x.name}</span>
            </button>
          ))}
        </div>

        <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT }}
          className="grid lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-6 items-start">
          {/* Chart card */}
          <div className="rounded-[2rem] bg-white border border-gray-100 p-5 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-2xl font-bold font-heading tracking-tight text-gray-900">{t.name}</h4>
              {t.metrics.length > 0 && <Legend items={[['bg-gray-300', 'before · main'], [AFTER, 'after · branch']]} />}
            </div>

            {t.metrics.length > 0 && (
              <div className="flex flex-col gap-5">
                {t.metrics.map((m, i) => <Dumbbell key={m.label} label={m.label} before={m.b} after={m.a} max={m.max} fmt={m.fmt} delay={i * 0.08} />)}
              </div>
            )}
            {t.callout && (
              <div className="grid sm:grid-cols-2 gap-3">
                {t.callout.map(([v, l]) => (
                  <div key={l} className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                    <div className="text-4xl font-heading font-extrabold tracking-tighter text-gray-900 tabular-nums">{v}</div>
                    <div className="text-sm text-gray-500 mt-1 leading-snug">{l}</div>
                  </div>
                ))}
              </div>
            )}
            {t.note && <p className="text-xs text-gray-500">{t.note}</p>}

            <div className="border-t border-gray-100 pt-5"><Flow>{t.flow}</Flow></div>
            <Disclosure label="How we measured">
              {t.id === 'guard'
                ? <p>A scripted OpenAI-compatible “fake model”, registered in TrueForge as a custom provider, misbehaves on purpose while the real extension, TrueForge and MCP tool server run. 9 scenarios, 9 pass. Details in Results below.</p>
                : <p>7 models × 2 runs per build (14 Task B runs) on Flask 3.1.3, <code className="font-mono text-xs">main</code> vs the branch.{t.id === 'context' && ' hit@5 / all@5: held-out test split of 103 real Flask commits.'}</p>}
            </Disclosure>
          </div>

          {/* Feature list */}
          <ul className="flex flex-col gap-3">
            {t.rows.map((r, i) => (
              <motion.li key={r.term} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.04 * i, ease: EASE_OUT }}
                className="rounded-[1.5rem] bg-white border border-gray-100 p-4 sm:p-5 hover:border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full border border-ember-100 bg-ember-50 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-ember-600 mt-0.5">{r.tag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h5 className="text-base font-bold font-heading tracking-tight text-gray-900 leading-snug">{r.term}</h5>
                      {r.metric && <span className="rounded-lg bg-gray-900 text-white px-2 py-0.5 text-[11px] font-mono whitespace-nowrap">{r.metric}</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{r.gloss}</p>
                    <Disclosure className="mt-3">
                      <p><b className="text-gray-400 text-xs uppercase tracking-widest mr-1">Before</b>{r.before}</p>
                      <p><b className="text-emerald-600 text-xs uppercase tracking-widest mr-1">After</b>{r.after}</p>
                    </Disclosure>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
