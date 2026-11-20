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
