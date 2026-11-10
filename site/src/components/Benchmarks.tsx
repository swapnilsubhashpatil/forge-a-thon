import { useState } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT } from '../motion'

const retrieval = {
  recall: { label: 'recall@5', rows: [['Anvil', 1.0], ['BM25', 0.71], ['Path-only', 0.21]] as const },
  mrr: { label: 'MRR', rows: [['Anvil', 0.85], ['BM25', 0.43], ['Path-only', 0.14]] as const },
}

const edits = [
  ['none', 100, 100],
  ['trailing whitespace', 0, 100],
  ['tabs instead of spaces', 0, 100],
  ['wrong indentation', 0, 100],
  ['CRLF file, LF old_string', 0, 100],
  ['one-character typo', 0, 83.3],
  ['missing blank line', 0, 100],
] as const

export default function Benchmarks() {
  const [metric, setMetric] = useState<keyof typeof retrieval>('recall')
  const data = retrieval[metric]

  return (
    <section id="benchmarks" className="py-24 md:py-32 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
          <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">Benchmarks</h2>
          <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">Receipts, not adjectives.</h3>
          <p className="mt-6 text-lg text-gray-500">Measured on Flask 3.1.3. The scripts live in the repo, so every number here can be reproduced.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Retrieval */}
          <div className="lg:col-span-2 rounded-[2rem] border border-gray-100 bg-gray-50/60 p-8 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <h4 className="text-2xl font-bold font-heading tracking-tight">Context retrieval</h4>
                <p className="text-sm text-gray-500 mt-1">12 hand-labelled tasks</p>
              </div>
              <div role="tablist" className="relative flex rounded-full bg-white border border-gray-200 p-1 text-xs font-semibold">
                {(Object.keys(retrieval) as (keyof typeof retrieval)[]).map((k) => (
                  <button key={k} role="tab" aria-selected={metric === k} onClick={() => setMetric(k)}
                    className={`relative px-3 py-1.5 rounded-full transition-colors ${metric === k ? 'text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                    {metric === k && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-gray-900 -z-0" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
                    <span className="relative">{retrieval[k].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6 flex-1 justify-center">
              {data.rows.map(([name, v], i) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className={`font-semibold ${i === 0 ? 'text-gray-900' : 'text-gray-500'}`}>{name}</span>
                    <motion.span key={`${metric}-${name}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="font-mono tabular-nums text-gray-700">{v.toFixed(2)}</motion.span>
                  </div>
                  <div className="h-3 rounded-full bg-white border border-gray-100 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${i === 0 ? 'bg-gradient-to-r from-gray-900 to-gray-700' : 'bg-gray-300'}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${v * 100}%` }}
                      animate={{ width: `${v * 100}%` }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 1.1, delay: i * 0.12, ease: EASE_OUT }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-gray-500 border-t border-gray-200 pt-5">
              Context pack averages <b className="text-gray-900">~4.2k tokens</b> vs ~38k for the top eight files sent whole.
            </p>
          </div>

          {/* Edit robustness */}
          <div className="lg:col-span-3 rounded-[2rem] border border-gray-100 bg-gray-50/60 p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <h4 className="text-2xl font-bold font-heading tracking-tight">Edit matcher robustness</h4>
                <p className="text-sm text-gray-500 mt-1">198 perturbed edits from 30 Flask functions</p>
              </div>
              <div className="flex gap-4 text-xs font-semibold text-gray-500">
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-gray-300" /> exact only</span>
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-ember-500" /> Anvil cascade</span>
              </div>
            </div>

            <div className="divide-y divide-gray-200/70">
              {edits.map(([name, exact, cascade], i) => (
                <div key={name} className="group grid grid-cols-[1fr_auto] sm:grid-cols-[180px_1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-white -mx-3 px-3 rounded-xl transition-colors">
                  <span className="text-sm font-medium text-gray-700 col-span-2 sm:col-span-1">{name}</span>
                  <div className="flex flex-col gap-1">
                    <div className="h-1.5 rounded-full bg-white overflow-hidden">
                      <motion.div className="h-full bg-gray-300 rounded-full" initial={{ width: 0 }} whileInView={{ width: `${exact}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.06 }} />
                    </div>
                    <div className="h-1.5 rounded-full bg-white overflow-hidden">
                      <motion.div className="h-full bg-ember-500 rounded-full group-hover:bg-ember-600" initial={{ width: 0 }} whileInView={{ width: `${cascade}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.1 + i * 0.06, ease: EASE_OUT }} />
                    </div>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-gray-900 w-14 text-right">{cascade}%</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[['15.2%', 'plain search/replace'], ['97.5%', 'Anvil cascade'], ['6.8 ms', 'worst-case per edit']].map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-white border border-gray-100 p-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <div className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight">{v}</div>
                  <div className="text-[11px] sm:text-xs text-gray-500 mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
