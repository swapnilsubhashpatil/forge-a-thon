import { useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, Database, ShieldAlert, LifeBuoy } from 'lucide-react'
import { EASE_OUT } from '../motion'

type Row = {
  tag: string          // ticket / guard id
  term: string         // the technical name
  gloss: string        // one-line plain-English meaning
  before: string
  after: string
  why: string
  metric?: string      // measured before → after, only when a doc has it
}

type Trait = {
  id: string; icon: typeof BadgeCheck; name: string; gloss: string
  results: [string, string, string][] // [metric, before, after]
  note?: string
  rows: Row[]
}

// Sources: conductor/tracks/t8-standout/spec.md + tickets/README.md (what was built),
// agent-mode-handoff.md §7 and agent-mode-comparison.md (how main behaved),
// docs/benchmarks/agent-mode.md "By harness trait" and context-history.md (numbers).
const traits: Trait[] = [
  {
    id: 'verify', icon: BadgeCheck, name: 'Objective verification loops',
    gloss: 'The agent has to prove a change works by running something, not by saying so.',
    results: [
      ['Task B ended with untested edits', '11/14', '0/14'],
      ['Finished with a verified claim', '0/14', '10/14'],
      ['Failed test runs per Task B', '3.1', '0.3'],
      ['Task B fully passed', '9/14', '10/14'],
    ],
    rows: [
      {
        tag: 'M8', term: 'Completion gate (finish_task)',
        gloss: 'A “done” button the model must press, which checks its claim.',
        before: 'TrueForge ends a turn as soon as the model replies without a tool call. The agent could stop after editing and never run a test.',
        after: 'finish_task{verified:true} is rejected unless a run_command ran after the last accepted edit. A turn that ends with edits and no finish_task gets exactly one follow-up. The change set shows a green “verified” or amber “not verified: reason” chip.',
        why: 'You can tell at a glance whether “done” means tested.',
        metric: 'verified finish 0/14 → 10/14',
      },
      {
        tag: 'M5', term: 'Detected test command',
        gloss: 'Anvil works out how this repo runs its tests and tells the agent.',
        before: 'The agent guessed python -m pytest, which failed on Flask’s src/ layout. A lowercase Windows drive letter in the working directory also broke 7 unrelated Flask tests.',
        after: '“Verify with: …” is added to the context pack as a hint. run_command sets PYTHONPATH=src for Python src/ layouts and upper-cases the drive letter.',
        why: 'Test failures now mean the code, not the setup, so the agent stops chasing ghosts.',
        metric: 'failed test runs 3.1 → 0.3 per Task B',
      },
      {
        tag: '15', term: 'Follow-up after edits that never applied',
        gloss: 'If every edit attempt missed, the agent is asked to retry or explain.',
        before: 'GPT-5.4-mini proposed 4 edits whose old_string did not match the file, then ended silently. The M8 follow-up only fired after accepted edits.',
        after: 'Such turns get one follow-up: re-read the file and retry, or call finish_task with verified=false and say why. Your own rejections do not count.',
        why: 'A silent “nothing happened” becomes a retry or an honest report.',
        metric: 'GPT-5.4-mini Task B 1/2 → 2/2 in the re-run',
      },
    ],
  },
  {
    id: 'guard', icon: ShieldAlert, name: 'Feed-forward guardrails',
    gloss: 'Warnings and instructions that steer the agent before it does damage, not after.',
    results: [
      ['Scope warnings per run', '0', '0'],
      ['Grounding warnings per run', '0', '0'],
      ['Loop nudges per run', '0', '0'],
    ],
    note: 'Zero in both builds: the models that pass Task B stay in scope, call real functions and do not loop, so this task cannot show the guards working. They are covered by unit tests only.',
    rows: [
      {
        tag: 'G2', term: 'Scope badges',
        gloss: 'Flags a change outside what you selected, or on lines the agent never read.',
        before: 'Every hunk looked the same in review, wherever it landed.',
        after: 'Amber “outside selection” (inline edit) and “edited without reading” (agent) badges. They never block Accept; the tool result tells the model which hunks were flagged.',
        why: 'Answers “it rewrote a function I didn’t ask about”.',
      },
      {
        tag: 'G3', term: 'Grounding badges',
        gloss: 'Flags calls and imports of names that exist nowhere in the project.',
        before: 'A call to a made-up helper looked like any other line.',
        after: 'Each hunk’s calls and imports are checked against the workspace symbol index, the file’s definitions, builtins and imports. Unknown names get a red badge and the model is told.',
        why: 'Answers “it edited a symbol that does not exist”.',
      },
      {
        tag: 'M7', term: 'Loop guard',
        gloss: 'Notices when the agent repeats itself and stops it.',
        before: 'No stuck or loop detection, in Anvil or in TrueForge.',
        after: 'An identical call, or a short A→B→A cycle, gets a nudge at 3 repeats and a stop at 5. Resets after an accepted edit.',
        why: 'Caps wasted tokens when a model gets stuck.',
      },
      {
        tag: 'M3', term: 'Rejection feedback',
        gloss: 'When you reject part of an edit, the model gets the file as it now is.',
        before: 'A partial rejection returned only the rejected diff, so the model kept a stale picture of the file.',
        after: '“Accepted hunks are already written; do not re-send them. This was the user’s decision, not a tool failure,” plus the current region (±4 lines, numbered, ≤60 lines). A failed match says to re-read the file.',
        why: 'Your “no” is respected, and the next edit is based on the real file.',
      },
      {
        tag: 'M1 · M6', term: 'Phased prompt and plan checklist',
        gloss: 'A fixed working order, and a visible to-do list for weaker models.',
        before: 'A 6-step prompt, and the plan was free text that scrolled away.',
        after: 'Explore → Plan → (Edit → Verify)* → Summarise, with “verify by execution, never by assumption”. A compact prompt is chosen for Ollama models. update_plan renders a live checklist.',
        why: 'Smaller models get a shorter path to follow; you see where the agent is.',
      },
    ],
  },
  {
    id: 'context', icon: Database, name: 'Context and state management',
    gloss: 'What the model sees, how much it costs, and what survives between messages.',
    results: [
      ['Input tokens per Task B', '193k', '141k (−27%)'],
      ['read_file calls per Task B', '5.2', '4.3'],
      ['Held-out hit@5 (103 commits)', '0.825', '0.854'],
      ['Held-out all@5', '0.466', '0.515'],
    ],
    rows: [
      {
        tag: 'Pack', term: 'Context pack ranking + git co-change',
        gloss: 'Before each turn, every file is scored and the best slices are packed under a token budget.',
        before: 'Path match, BM25 keyword scoring, symbol definitions, sibling symbols, test/docs companions and PageRank over the import graph.',
        after: 'Adds git co-change (files that changed in the same commits as a top target become companions) and demotes requirements, CI, changelog and community files unless asked about.',
        why: 'Finds the test file that naming alone misses, e.g. app.py → tests/test_basic.py.',
        metric: 'hit@5 0.825 → 0.854 · recall@5 0.647 → 0.685 · MRR 0.699 → 0.716',
      },
      {
        tag: 'Rules', term: 'Project rules in the pack',
        gloss: 'The repo’s own notes for AI agents are read automatically.',
        before: 'AGENTS.md, CLAUDE.md, .cursorrules and similar files were ignored.',
        after: 'They go at the top of the pack within a 1,200-token budget (duplicates sent once, long files trimmed), and the Context card lists which ones were used.',
        why: 'The agent follows the conventions the team already wrote down.',
      },
      {
        tag: 'G1', term: 'Live scorecard and context gauge',
        gloss: 'Predicted vs read vs edited files, and how full the context window is.',
        before: 'The Context card listed chosen files; token totals appeared only at the end of the turn.',
        after: 'Three live lists, an “edited files in top-5 predicted: n/m” line, and a gauge against the 60k compaction trigger with prompt-cache hit % and compaction marks.',
        why: 'You can check whether Anvil’s guess about the files was right.',
        metric: 'edited files in top-5 prediction: 100% → 100%',
      },
      {
        tag: 'M2', term: 'Read-only subagents',
        gloss: 'Helper agents that can look but not touch.',
        before: 'TrueForge subagents get the same tools as the parent, including propose_edit.',
        after: 'Write tools and nested subagents are denied; a read-only command allowlist is allowed.',
        why: 'Exploration in parallel can never edit your files behind the review.',
      },
      {
        tag: 'M11', term: 'Queued and steered messages',
        gloss: 'You can keep typing while the agent works.',
        before: 'The composer was locked, and in TrueForge a new message cancels the running turn.',
        after: 'Messages become “queued” chips, delivered into the next main-thread tool result as a <user_note>. “Stop and send” cancels first and labels the old turn “superseded”.',
        why: 'A correction mid-task is never lost and never kills the work by accident.',
      },
      {
        tag: '16 · 17', term: 'Send selection or terminal output to chat',
        gloss: 'Point the agent at exact lines or the last command’s output.',
        before: 'Context came from @mentions and ranking only.',
        after: 'Ctrl+Alt+L or right-click sends an editor selection as exact numbered lines with its own 4k budget; a terminal selection or last command + output can be sent too.',
        why: 'Less guessing about which lines or which error you mean.',
      },
    ],
  },
  {
    id: 'safety', icon: LifeBuoy, name: 'Safe execution and harness reliability',
    gloss: 'Commands that can be stopped, limits that end gracefully, and a way back.',
    results: [
      ['Cancel left the tree clean', '14/14', '14/14'],
      ['Dead endpoint → automatic failover', '10/14', '10/14'],
      ['Restore (message + code) left the tree clean', 'n/a', '14/14'],
    ],
    rows: [
      {
        tag: 'M4', term: 'run_command: summary, inactivity timeout, process-tree kill',
        gloss: 'Commands report clearly and can always be stopped, including anything they started.',
        before: 'Output clipped 50/50 at 12k characters, a timeout reported as the word “timeout”, and only the shell was killed, so child processes survived.',
        after: 'First line “exit N · summary · wall time”; ~2k head / ~10k tail with “original N lines”; ANSI stripped; no pager, stdin closed; an inactivity timeout plus a hard cap; the whole process tree is killed.',
        why: 'A hung test run cannot keep changing files after you press Stop.',
      },
      {
        tag: 'M10', term: 'Step-limit wrap-up',
        gloss: 'When the agent runs out of steps it summarises instead of crashing.',
        before: 'TrueForge’s iteration-limit error was treated as a model failure: the circuit breaker tripped and the whole task re-ran on the next model.',
        after: 'The limit is its own failure kind: no failover, a clear notice, and one wrap-up turn asking for finish_task with what is done and what remains. From half the budget, tool results carry a turn-budget hint.',
        why: 'No surprise model switch, no half-told story.',
      },
      {
        tag: '18', term: 'Restore to any message',
        gloss: 'Rewind the conversation, with or without the code it produced.',
        before: 'Only “Undo Last Agent Change”.',
        after: '“Restore message” or “Restore message and code” on any past message (newest changes undone first; files you edited by hand are skipped and listed). Each turn also gets “Undo these changes”.',
        why: 'Try a different instruction without cleaning up by hand.',
        metric: 'restore left the tree clean 14/14',
      },
      {
        tag: 'Fixes', term: 'Bugs the benchmark found',
        gloss: 'Problems only a cross-model run exposed.',
        before: 'Turn-budget step count inflated ~15× by streamed deltas (Haiku quit at “116/60”). Ollama’s 4k default context silently truncated prompts.',
        after: 'Model calls counted once per message. Local models run as *-16k variants and compact at 12k input tokens.',
        why: 'Without these, weak and local-model results were not meaningful.',
      },
    ],
  },
]

export default function BeforeAfter() {
  const [active, setActive] = useState(traits[0].id)
  const trait = traits.find((t) => t.id === active) ?? traits[0]

  return (
    <section id="before-after" className="py-24 md:py-32 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-12 md:mb-16 gap-6">
          <div className="max-w-3xl">
            <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">02 · What we implemented</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">
              Before and after, row by row.
            </h3>
          </div>
          <p className="max-w-sm text-lg text-gray-500">Grouped by four harness traits. Each row: how <code className="font-mono text-sm">main</code> behaved, what the branch does, and why you would care.</p>
        </div>

        {/* Trait tabs */}
        <div role="tablist" className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 mb-8 [scrollbar-width:none]">
          {traits.map((t) => (
            <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setActive(t.id)}
              className={`relative shrink-0 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${active === t.id ? 'text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'}`}>
              {active === t.id && <motion.span layoutId="trait-pill" className="absolute inset-0 rounded-full bg-gray-900" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
              <t.icon className="relative w-4 h-4" strokeWidth={1.75} />
              <span className="relative whitespace-nowrap">{t.name}</span>
            </button>
          ))}
        </div>

        <motion.div key={trait.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
          {/* Trait summary + measured results */}
          <div className="rounded-[2rem] bg-white border border-gray-100 p-6 sm:p-8 mb-6 grid lg:grid-cols-[1fr_1.4fr] gap-6 lg:gap-10">
            <div>
              <h4 className="text-2xl md:text-3xl font-bold font-heading tracking-tight text-gray-900">{trait.name}</h4>
              <p className="text-gray-500 mt-2 leading-relaxed">{trait.gloss}</p>
              {trait.note && <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 leading-relaxed">{trait.note}</p>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 content-start">
              {trait.results.map(([m, b, a]) => (
                <div key={m} className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <div className="text-xs text-gray-500 mb-1">{m}</div>
                  <div className="flex items-baseline gap-2 font-mono tabular-nums">
                    <span className="text-gray-400 text-sm">{b}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-gray-900 font-bold text-lg">{a}</span>
                  </div>
                </div>
              ))}
              <p className="sm:col-span-2 text-xs text-gray-400">7 models × 2 runs per build on Flask 3.1.3; retrieval rows: held-out test split of 103 real commits.</p>
            </div>
          </div>

          {/* Column headers (desktop) */}
          <div className="hidden lg:grid grid-cols-[1.15fr_1fr_1fr_0.8fr] gap-6 px-6 pb-3 text-xs font-bold tracking-widest uppercase text-gray-400">
            <span>Feature</span><span>Before · main</span><span>After · branch</span><span>Why it matters</span>
          </div>

          <div className="flex flex-col gap-4">
            {trait.rows.map((r, i) => (
              <motion.div key={r.term}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 * i, ease: EASE_OUT }}
                className="rounded-[1.5rem] bg-white border border-gray-100 p-5 sm:p-6 grid lg:grid-cols-[1.15fr_1fr_1fr_0.8fr] gap-4 lg:gap-6 hover:shadow-lg hover:border-gray-200 transition-shadow">
                <div>
                  <span className="inline-block rounded-full border border-ember-100 bg-ember-50 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-ember-600 mb-2">{r.tag}</span>
                  <h5 className="text-lg font-bold font-heading tracking-tight text-gray-900 leading-snug">{r.term}</h5>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{r.gloss}</p>
                  {r.metric && (
                    <p className="mt-3 inline-block rounded-xl bg-gray-900 text-white px-3 py-1.5 text-xs font-mono">{r.metric}</p>
                  )}
                </div>
                <Cell label="Before · main" tone="before">{r.before}</Cell>
                <Cell label="After · branch" tone="after">{r.after}</Cell>
                <Cell label="Why it matters" tone="why">{r.why}</Cell>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Cell({ label, tone, children }: { label: string; tone: 'before' | 'after' | 'why'; children: React.ReactNode }) {
  const styles = {
    before: 'bg-gray-50 border-gray-100 text-gray-500',
    after: 'bg-emerald-50/50 border-emerald-100 text-gray-800',
    why: 'bg-transparent border-transparent text-gray-900 font-medium',
  }[tone]
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${styles} ${tone === 'why' ? 'lg:px-0' : ''}`}>
      <span className="lg:hidden block text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-1">{label}</span>
      {children}
    </div>
  )
}
