import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE_OUT } from '../motion'
import { Icon, type IconName } from '../icons'
import { Link } from '../router'
import { Reveal, Section } from './Section'

function Bar({ label, value, max, text, tone, delay = 0 }: { label: ReactNode; value: number; max: number; text: string; tone: 'anvil' | 'base' | 'before'; delay?: number }) {
  const color = tone === 'anvil' ? 'bg-ember-500' : tone === 'before' ? 'bg-gray-400' : 'bg-gray-300'
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,10rem)_1fr_4.5rem]">
      <span className={`truncate text-sm ${tone === 'anvil' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
      <span className="h-3 overflow-hidden rounded-full bg-gray-100">
        <motion.span
          className={`block h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(1.5, (value / max) * 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay, ease: EASE_OUT }}
        />
      </span>
      <span className={`text-right font-mono text-sm tabular-nums ${tone === 'anvil' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{text}</span>
    </div>
  )
}

function Runs({ label, before, after, good }: { label: string; before: number; after: number; good: boolean }) {
  const row = (count: number, on: string, delay: number) => (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 14 }, (_, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0.4, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: delay + i * 0.025, ease: EASE_OUT }}
          className={`size-4 rounded-[5px] sm:size-5 ${i < count ? on : 'bg-gray-100 ring-1 ring-inset ring-gray-200'}`}
        />
      ))}
    </div>
  )
  const on = good ? 'bg-emerald-500' : 'bg-rose-400'
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <div className="mt-4 grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
        <span className="text-xs text-gray-500">Before</span>
        {row(before, 'bg-gray-400', 0)}
        <span className="font-mono text-sm tabular-nums text-gray-500">{before}/14</span>
        <span className="text-xs font-semibold text-gray-900">After</span>
        {row(after, on, 0.25)}
        <span className="font-mono text-sm font-medium tabular-nums text-gray-900">{after}/14</span>
      </div>
    </div>
  )
}

function Closer({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900">
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.25, ease: EASE_OUT }} className="grid size-5 place-items-center rounded-full bg-gray-100 text-gray-600">
          <Icon name="arrow" size={12} />
        </motion.span>
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }} className="overflow-hidden">
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const taskBPicks: [string, 'target' | 'test' | 'docs'][] = [
  ['src/flask/cli.py', 'target'],
  ['tests/test_cli.py', 'test'],
  ['docs/cli.rst', 'docs'],
]

const unseen: [string, string, string, string, string][] = [
  ['A right file in the top 5', 'hit@5', '85%', '83%', '70%'],
  ['Every right file in the top 5', 'all@5', '52%', '47%', '37%'],
  ['Ranking score (MRR)', 'MRR', '0.72', '0.70', '0.53'],
]

function FilesCloser() {
  return (
    <Closer label="The fixed task, and 103 commits it never saw">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200/70 p-4">
          <p className="text-sm font-medium text-gray-900">Task B: add a <span className="font-mono text-[0.85em]">flask config</span> command</p>
          <p className="mt-1 text-xs text-gray-500">No files named. Anvil’s top three picks:</p>
          <ol className="mt-3 space-y-1.5">
            {taskBPicks.map(([file, role], i) => (
              <li key={file} className="flex items-center gap-2.5 text-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ember-500 font-mono text-[10px] text-white">{i + 1}</span>
                <span className="truncate font-mono text-[0.82rem] text-gray-900">{file}</span>
                <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{role}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            All three are the files the change needs. Keyword search ranked <span className="font-mono text-gray-900">0 of 3</span> in its top three. In every live run, each file the agent edited was in Anvil’s top five.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/70 p-4">
          <p className="text-sm font-medium text-gray-900">103 real Flask commits, never used for tuning</p>
          <p className="mt-1 text-xs text-gray-500">The request is the commit message; the answer is the files it changed.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[260px] text-left text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-1.5 pr-2 font-medium" />
                  <th className="px-1.5 py-1.5 text-right font-semibold text-gray-900">Anvil</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Before co-change</th>
                  <th className="py-1.5 pl-1.5 text-right font-medium">Keyword</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unseen.map(([text, , anvil, before, base]) => (
                  <tr key={text}>
                    <td className="py-2 pr-2 text-gray-600">{text}</td>
                    <td className="px-1.5 py-2 text-right font-mono font-medium tabular-nums text-ember-600">{anvil}</td>
                    <td className="px-1.5 py-2 text-right font-mono tabular-nums text-gray-500">{before}</td>
                    <td className="py-2 pl-1.5 text-right font-mono tabular-nums text-gray-500">{base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">“Co-change” ranks files that usually change together in git history. It lifted every score.</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">
        How Anvil ranks: keyword match, symbol definitions, the import graph, files that change together, and matching tests and docs. The best fit into a 6,000-token pack, each with its reason shown.
      </p>
    </Closer>
  )
}

const slips: [string, number][] = [
  ['No slip', 100],
  ['Trailing spaces', 100],
  ['Tabs instead of spaces', 100],
  ['Wrong indentation', 100],
  ['Windows line endings', 100],
  ['Missing blank line', 100],
  ['One-character typo', 83.3],
]

function EditsCloser() {
  return (
    <Closer label="By the kind of slip">
      <div className="overflow-hidden rounded-2xl border border-gray-200/70">
        <div className="grid grid-cols-[1fr_4.5rem_4.5rem] bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <span>Slip in the model’s copy of the code</span>
          <span className="text-right">Exact</span>
          <span className="text-right font-semibold text-gray-900">Anvil</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {slips.map(([slip, anvil]) => {
            const exact = slip === 'No slip' ? 100 : 0
            return (
              <li key={slip} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center px-4 py-2 text-sm">
                <span className="text-gray-700">{slip}</span>
                <span className={`text-right font-mono tabular-nums text-gray-400`}>{exact}%</span>
                <span className="text-right font-mono font-medium tabular-nums text-gray-900">{anvil}%</span>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        Anvil tries exact, then whitespace-tolerant, then indentation-tolerant, then fuzzy matching. When the code is missing and only a similar-looking function remains, it refuses and shows the model the closest lines to retry with. That trap was set 60 times; it never edited the wrong function.
      </p>
    </Closer>
  )
}

function Tally({ label, count, total, note, delay = 0 }: { label: string; count: number; total: number; note: string; delay?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <span className="font-mono text-sm font-medium tabular-nums text-gray-900">
          {count}/{total}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: delay + i * 0.025, ease: EASE_OUT }}
            className={`size-4 rounded-[5px] sm:size-5 ${i < count ? 'bg-ember-500' : 'bg-gray-100 ring-1 ring-inset ring-gray-200'}`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">{note}</p>
    </div>
  )
}

const failover = ['Model fails', 'Anvil names the cause', 'Next model in your list', 'Same request, answered']

function SafeBody() {
  return (
    <div className="space-y-3">
      <Tally label="Stop mid-run: code left exactly as it was" count={14} total={14} note="Pending edits are dropped and any running command is killed, with its child processes." />
      <Tally label="Undo a message and its code: tree back to clean" count={14} total={14} delay={0.15} note="Rewind the chat, the code, or both. Undo history survives a window reload." />
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-gray-900">Broken model key: the next model takes over</p>
          <span className="font-mono text-sm font-medium tabular-nums text-gray-900">10/10</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {failover.map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${i === failover.length - 1 ? 'bg-ember-500 text-white' : 'bg-gray-100 text-gray-700'}`}>{step}</span>
              {i < failover.length - 1 && <Icon name="arrow" size={12} className="text-gray-400" />}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Every hosted model, two runs each, with no click from you, and <span className="font-mono">git status</span> clean after. A model that keeps failing rests for 60 seconds.
        </p>
      </div>
    </div>
  )
}

type MetricKey = 'failed' | 'verified' | 'tokens' | 'secs' | 'tools'

const perModel: { name: string; v: Record<MetricKey, [number, number]> }[] = [
  { name: 'Claude Haiku 5.5', v: { failed: [4.5, 0.5], tokens: [267711, 313313], secs: [52, 49], tools: [21.5, 26.0], verified: [0, 2] } },
  { name: 'Claude Sonnet 5.5', v: { failed: [3.5, 0.0], tokens: [130523, 95238], secs: [37, 27], tools: [14.5, 11.0], verified: [0, 2] } },
  { name: 'Claude Opus 5.5', v: { failed: [3.0, 0.0], tokens: [130572, 101838], secs: [44, 29], tools: [12.0, 12.0], verified: [0, 2] } },
  { name: 'GPT-5.4 mini', v: { failed: [6.0, 1.5], tokens: [610034, 361568], secs: [117, 69], tools: [41.5, 33.5], verified: [0, 2] } },
  { name: 'GPT-6.1-sol', v: { failed: [5.0, 0.0], tokens: [157084, 104626], secs: [62, 41], tools: [17.5, 19.0], verified: [0, 2] } },
]

const metricInfo: Record<MetricKey, { label: string; fmt: (v: number) => string; read: string }> = {
  failed: { label: 'Failed test runs', fmt: (v) => v.toFixed(1), read: 'Lower is better. Before, tests failed for setup reasons and models burned turns on it.' },
  verified: { label: 'Proved it works', fmt: (v) => `${v}/2`, read: 'Runs that ended with a passing check as proof. Before, no model could.' },
  tokens: { label: 'Tokens sent', fmt: (v) => `${Math.round(v / 1000)}k`, read: 'Lower is better. Fewer failed test loops, less sent to the model.' },
  secs: { label: 'Seconds', fmt: (v) => `${v}s`, read: 'Lower is better. Less time chasing failed test runs.' },
  tools: { label: 'Tool calls', fmt: (v) => v.toFixed(1), read: 'Tool calls per run, before and after.' },
}

function ModelsBody() {
  const [m, setM] = useState<MetricKey>('failed')
  const info = metricInfo[m]
  const max = m === 'verified' ? 2 : Math.max(...perModel.map((r) => Math.max(...r.v[m]))) || 1
  return (
    <div>
      <div role="tablist" aria-label="Measure" className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {(Object.keys(metricInfo) as MetricKey[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={m === key}
            onClick={() => setM(key)}
            className={`relative shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${m === key ? 'border-gray-900 text-white' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'}`}
          >
            {m === key && <motion.span layoutId="model-metric" className="absolute inset-0 rounded-full bg-gray-900" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />}
            <span className="relative">{metricInfo[key].label}</span>
          </button>
        ))}
      </div>
      <div key={m} className="space-y-3.5">
        {perModel.map((row, i) => (
          <div key={row.name}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">{row.name}</span>
            </div>
            <div className="grid grid-cols-[1fr_3.5rem] items-center gap-x-3 gap-y-1">
              {[0, 1].map((k) => (
                <div key={k} className="contents">
                  <span className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <motion.span
                      className={`block h-full rounded-full ${k === 0 ? 'bg-gray-300' : 'bg-ember-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(1.5, (row.v[m][k] / max) * 100)}%` }}
                      transition={{ duration: 0.7, delay: i * 0.04 + k * 0.08, ease: EASE_OUT }}
                    />
                  </span>
                  <span className={`text-right font-mono text-xs tabular-nums ${k ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{info.fmt(row.v[m][k])}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-gray-500">
        <span className="mr-3 inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-gray-300" /> before</span>
        <span className="mr-3 inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-ember-500" /> after</span>
        {info.read}
      </p>
    </div>
  )
}

const tabs: { id: string; icon: IconName; label: string; headline: string; note: string; body: ReactNode }[] = [
  {
    id: 'files',
    icon: 'target',
    label: 'Finding files',
    headline: '96% of the files a change needs land in the top five picks.',
    note: '12 hand-labelled tasks on Flask. On 103 real commits it had never seen: 85% versus 70% for keyword search.',
    body: (
      <div className="space-y-4">
        <Bar label="Anvil" value={96} max={100} text="96%" tone="anvil" />
        <Bar label="Keyword search" value={71} max={100} text="71%" tone="base" delay={0.1} />
        <Bar label="File path only" value={21} max={100} text="21%" tone="base" delay={0.2} />
        <FilesCloser />
      </div>
    ),
  },
  {
    id: 'edits',
    icon: 'fileEdit',
    label: 'Edits that land',
    headline: '97.5% of slightly-off model edits still apply, and none in the wrong place.',
    note: '198 edits with the slips models make: stray spaces, tabs, wrong indentation, Windows line endings.',
    body: (
      <div className="space-y-4">
        <Bar label="Anvil" value={97.5} max={100} text="97.5%" tone="anvil" />
        <Bar label="Exact match" value={15.2} max={100} text="15.2%" tone="base" delay={0.1} />
        <p className="pt-2 text-sm text-gray-500">
          Wrong-place edits: <span className="font-mono font-medium text-gray-900">0 of 60</span>
        </p>
        <EditsCloser />
      </div>
    ),
  },
  {
    id: 'finish',
    icon: 'test',
    label: 'Finishing the job',
    headline: 'The agent proves its change before it stops.',
    note: 'The same multi-file task, before and after the agent work. Seven models, two runs each.',
    body: (
      <div className="grid gap-3 lg:grid-cols-2">
        <Runs label="Ended with untested edits" before={11} after={0} good={false} />
        <Runs label="Finished with a passing check" before={0} after={10} good />
      </div>
    ),
  },
  {
    id: 'safe',
    icon: 'shield',
    label: 'Fails safely',
    headline: 'A broken model, a stop or an undo leaves your code as it was.',
    note: 'Stop, undo and model failover, each checked with git status after every run. Seven models, two runs each.',
    body: <SafeBody />,
  },
  {
    id: 'models',
    icon: 'robot',
    label: 'Every model',
    headline: 'The gains hold across providers, not just one model.',
    note: 'The multi-file task on each model, before and after the agent work. Averages of two runs. Pick a measure.',
    body: <ModelsBody />,
  },
  {
    id: 'cost',
    icon: 'speed',
    label: 'Cost and speed',
    headline: 'Less sent to the model, fewer wasted test runs.',
    note: 'Context per request, tokens per task and failed test runs per task, measured on the same suite.',
    body: (
      <div className="space-y-4">
        <Bar label="Context, whole files" value={42.7} max={42.7} text="42.7k" tone="before" />
        <Bar label="Context, Anvil pack" value={4.5} max={42.7} text="4.5k" tone="anvil" delay={0.1} />
        <div className="h-px bg-gray-100" />
        <Bar label="Tokens per task, before" value={193} max={193} text="193k" tone="before" delay={0.15} />
        <Bar label="Tokens per task, after" value={141} max={193} text="141k" tone="anvil" delay={0.25} />
        <div className="h-px bg-gray-100" />
        <Bar label="Failed test runs, before" value={3.1} max={3.1} text="3.1" tone="before" delay={0.3} />
        <Bar label="Failed test runs, after" value={0.3} max={3.1} text="0.3" tone="anvil" delay={0.4} />
      </div>
    ),
  },
]

export default function Benchmarks() {
  const [active, setActive] = useState(tabs[0].id)
  const tab = tabs.find((item) => item.id === active)!
  return (
    <Section id="results" title="Measured on a real codebase." description="Every number reruns from the repo with one command, on Flask 3.1.3." className="bg-gradient-to-b from-white to-gray-50/80">
      <Reveal>
        <div className="overflow-hidden rounded-[1.75rem] border border-gray-200/70 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]">
          <div role="tablist" aria-label="Benchmarks" className="flex gap-1 overflow-x-auto border-b border-gray-100 p-2">
            {tabs.map((item) => {
              const on = item.id === active
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(item.id)}
                  className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${on ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {on && <motion.span layoutId="bench-tab" className="absolute inset-0 -z-0 rounded-xl bg-gray-100" transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }} />}
                  <span className="relative">
                    <Icon name={item.icon} size={16} />
                  </span>
                  <span className="relative">{item.label}</span>
                </button>
              )
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={tab.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12 lg:p-10">
              <div>
                <p className="font-heading text-2xl font-semibold leading-snug tracking-tight text-gray-900 sm:text-3xl">{tab.headline}</p>
                <p className="mt-4 text-sm leading-relaxed text-gray-500">{tab.note}</p>
                <div className="mt-6 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-full bg-ember-500" /> Anvil
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-full bg-gray-300" /> Baseline
                  </span>
                </div>
              </div>
              <div className="self-center">{tab.body}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
      <Reveal className="mt-8 text-center">
        <Link to="/docs/benchmarks" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline">
          Method and raw data
          <Icon name="arrow" size={15} />
        </Link>
      </Reveal>
    </Section>
  )
}
