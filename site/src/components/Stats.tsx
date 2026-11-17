import { motion } from 'framer-motion'
import { EASE_OUT } from '../motion'
import { Disclosure, Flow, PairBars, RunDots } from './charts'

// Every number: docs/benchmarks/agent-mode.md ("By harness trait") and agent-mode-findings.md (trait re-run table).
// 7 models whose provider answered × 2 runs = 14 Task B runs per build.

type Kpi = {
  label: string; value: string; was: string; delta?: string; flow: string
  visual: React.ReactNode
}

const kpis: Kpi[] = [
  {
    label: 'Runs that ended with untested edits', value: '0/14', was: '11/14',
    flow: 'Agent edits 3 files → stops without a test → Anvil sends one follow-up → it runs pytest.',
    visual: <RunDots before={11} after={0} tone="bad" />,
  },
  {
    label: '“Done” backed by a passing check', value: '10/14', was: '0/14',
    flow: 'Agent edits → runs pytest → it passes → only then may finish_task say “verified”.',
    visual: <RunDots before={0} after={10} tone="good" />,
  },
  {
    label: 'Failed test runs per task', value: '0.3', was: '3.1',
    flow: 'Agent runs pytest → PYTHONPATH=src is already set → a failure means the code, not the setup.',
    visual: <PairBars label="failed runs / Task B" before={3.1} after={0.3} max={3.1} fmt={(v) => v.toFixed(1)} />,
  },
  {
    label: 'Input tokens per task', value: '141k', was: '193k', delta: '−27%',
    flow: 'Fewer failing test loops → fewer file reads (5.2 → 4.3) → less sent to the model.',
    visual: <PairBars label="tokens / Task B" before={193} after={141} max={193} fmt={(v) => `${v}k`} />,
  },
]

const unchanged: [string, string][] = [
  ['Task A inline edit', '10/14'],
  ['Task C failover', '10/14'],
  ['Cancel left tree clean', '14/14'],
  ['Task B passed', '9 → 10/14'],
]

export default function Stats() {
  return (
    <section className="py-20 md:py-28 relative bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-10 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-heading font-bold text-gray-900 tracking-tighter max-w-2xl leading-[1.05]">
            Same models.<br />
            <span className="text-gray-400">Better behaviour.</span>
          </h2>
          <p className="text-base md:text-lg text-gray-500 font-medium max-w-sm md:text-right">
            <code className="font-mono text-sm bg-white px-1.5 py-0.5 rounded border border-gray-200">main</code> vs the agent-mode branch, 14 runs each.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {kpis.map((k, i) => (
            <motion.div key={k.label}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: EASE_OUT }}
              className="rounded-[2rem] bg-white border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col gap-5 hover:shadow-xl transition-shadow duration-500">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 leading-snug mb-2">{k.label}</h3>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-5xl font-heading font-extrabold text-black tracking-tighter tabular-nums">{k.value}</span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-500 tabular-nums">was {k.was}</span>
                  {k.delta && <span className="rounded-full bg-ember-50 border border-ember-100 px-2.5 py-0.5 text-xs font-bold text-ember-600 tabular-nums">{k.delta}</span>}
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center">{k.visual}</div>
              <div className="border-t border-gray-100 pt-4"><Flow>{k.flow}</Flow></div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <ul className="flex flex-wrap gap-2" aria-label="Pass rates (before → after)">
            {unchanged.map(([l, v]) => (
              <li key={l} className="rounded-full bg-white border border-gray-200 px-3 py-1 text-xs text-gray-500">
                {l} <b className="font-mono text-gray-900">{v}</b>
              </li>
            ))}
          </ul>
          <Disclosure label="How we measured">
            <p>Before = branch <code className="font-mono text-xs">main</code>, after = <code className="font-mono text-xs">feat/agent-mode-behaviour</code>. The same end-to-end suite drove both builds on Flask 3.1.3.</p>
            <p>7 models whose provider answered (Claude Haiku, Sonnet and Opus 5.5, GPT-5.4-mini, GPT-6.1-sol, two local Ollama models) × 2 runs = 14 runs per build.</p>
            <p>Task B: the agent adds a <code className="font-mono text-xs">flask config</code> command; it passes on pytest, <code className="font-mono text-xs">flask --help</code>, masked JSON and ≥3 files changed. Pass rates barely moved; behaviour did.</p>
          </Disclosure>
        </div>
      </div>
    </section>
  )
}
