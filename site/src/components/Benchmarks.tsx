import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bug } from 'lucide-react'
import { EASE_OUT } from '../motion'

/* ---------- Agent mode: docs/benchmarks/agent-mode.md ---------- */

const traitTable: [string, string, string, boolean?][] = [
  ['Task A inline edit passed', '10/14', '10/14'],
  ['Task C dead endpoint → failover', '10/14', '10/14'],
  ['Cancel left the tree clean', '14/14', '14/14'],
  ['Task B fully passed', '9/14', '10/14', true],
  ['Task B ended with untested edits', '11/14', '0/14', true],
  ['Finished with a verified claim', '0/14', '10/14', true],
  ['Failed test runs per Task B', '3.14', '0.29', true],
  ['Tool calls per Task B', '16.0', '14.6', true],
  ['read_file calls per Task B', '5.21', '4.29', true],
  ['Input tokens per Task B', '193,349', '141,477', true],
  ['Prompt-cache hit', '76%', '73%'],
  ['Restore (message + code) left the tree clean', '–', '14/14', true],
]

// [model, untested edits b/a, verified b/a, failed test runs b/a, input tokens b/a]
const perModel: [string, string, string, string, string, string, string, string, string][] = [
  ['Claude Haiku 5.5', '2/2', '0/2', '0/2', '2/2', '4.5', '0.5', '267,711', '313,313'],
  ['Claude Sonnet 5.5', '2/2', '0/2', '0/2', '2/2', '3.5', '0.0', '130,523', '95,238'],
  ['Claude Opus 5.5', '2/2', '0/2', '0/2', '2/2', '3.0', '0.0', '130,572', '101,838'],
  ['GPT-5.4-mini', '2/2', '0/2', '0/2', '2/2', '6.0', '1.5', '610,034', '361,568'],
  ['GPT-6.1-sol', '2/2', '0/2', '0/2', '2/2', '5.0', '0.0', '157,084', '104,626'],
  ['qwen3-8b-16k (Ollama)', '1/2', '0/2', '0/2', '0/2', '0.0', '0.0', '50,629', '6,900'],
  ['qwen2.5-coder-7b-16k (Ollama)', '0/2', '0/2', '0/2', '0/2', '0.0', '0.0', '6,889', '6,860'],
]

/* ---------- Retrieval: docs/benchmarks/context-history.md + commit f5f66f2 ---------- */

const retrieval = {
  hit5: { label: 'hit@5', gloss: 'a right file is in the top 5', rows: [['Anvil · after', 0.854], ['Anvil · before', 0.825], ['BM25', 0.699]] as const },
  all5: { label: 'all@5', gloss: 'every right file is in the top 5', rows: [['Anvil · after', 0.515], ['Anvil · before', 0.466], ['BM25', 0.369]] as const },
  recall5: { label: 'recall@5', gloss: 'share of right files in the top 5', rows: [['Anvil · after', 0.685], ['Anvil · before', 0.647], ['BM25', 0.521]] as const },
  mrr: { label: 'MRR', gloss: '1 / rank of the first right file', rows: [['Anvil · after', 0.716], ['Anvil · before', 0.699], ['BM25', 0.532]] as const },
}

/* ---------- Edits: docs/benchmarks/edits.md ---------- */

const edits = [
  ['none', 100, 100],
  ['trailing whitespace', 0, 100],
  ['tabs instead of spaces', 0, 100],
  ['wrong indentation', 0, 100],
  ['CRLF file, LF old_string', 0, 100],
  ['one-character typo', 0, 83.3],
  ['missing blank line', 0, 100],
] as const

const bugs = [
  ['Turn-budget count inflated ~15×', 'Each streamed delta re-emitted the same model message, so steps were over-counted; Haiku stopped at “116/60” without editing.'],
  ['Ollama truncated prompts', 'Ollama defaults to a 4k context and silently cut the prompt and context pack. Local models now run as *-16k variants.'],
  ['Lowercase drive letter', 'VS Code reports c:\\…; Flask’s CLI tests compare paths case-sensitively, so 7 unrelated tests failed whenever the agent ran pytest.'],
  ['Step limit triggered failover', 'TrueForge’s iteration-limit error was classified as a model failure, tripping the breaker and re-running on the next model.'],
]

export default function Benchmarks() {
  const [view, setView] = useState<'trait' | 'model'>('trait')
  const [metric, setMetric] = useState<keyof typeof retrieval>('hit5')
  const data = retrieval[metric]

  return (
    <section id="benchmarks" className="py-24 md:py-32 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
          <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">03 · What we did well</h2>
          <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">Receipts, not adjectives.</h3>
          <p className="mt-6 text-lg text-gray-500">Measured on Flask 3.1.3. The scripts and raw rows live in the repo (<code className="font-mono text-sm">docs/benchmarks/</code>), so every number here can be reproduced.</p>
        </div>

        {/* Agent mode before/after */}
        <div className="rounded-[2rem] border border-gray-100 bg-gray-50/60 p-6 sm:p-8 mb-6 lg:mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="max-w-2xl">
              <h4 className="text-2xl font-bold font-heading tracking-tight">Agent mode: main vs branch</h4>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Same e2e suite on both builds. Task A: inline edit. Task C: dead endpoint → failover. Cancel mid-run.
                Task B: the agent adds <code className="font-mono text-xs">flask config</code>, checked by pytest, <code className="font-mono text-xs">flask --help</code>, masked JSON and ≥3 files changed.
                7 models × 2 runs per build.
              </p>
            </div>
            <div role="tablist" className="relative flex rounded-full bg-white border border-gray-200 p-1 text-xs font-semibold">
              {([['trait', 'All models'], ['model', 'Per model']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                  className={`relative px-3 py-1.5 rounded-full transition-colors ${view === k ? 'text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  {view === k && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-gray-900" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
                  <span className="relative">{l}</span>
                </button>
              ))}
            </div>
          </div>

          {view === 'trait' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {traitTable.map(([m, b, a, changed]) => (
                <div key={m} className={`rounded-2xl border px-4 py-3 ${changed ? 'border-gray-200 bg-white' : 'border-gray-100 bg-white/60'}`}>
                  <div className="text-xs text-gray-500 mb-1">{m}</div>
                  <div className="flex items-baseline gap-2 font-mono tabular-nums">
                    <span className="text-gray-400 text-sm">{b}</span>
                    <span className="text-gray-300">→</span>
                    <span className={`font-bold text-lg ${changed ? 'text-gray-900' : 'text-gray-500'}`}>{a}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold tracking-widest uppercase text-gray-400 border-b border-gray-200">
                    <th className="py-3 pr-4 font-bold">Model</th>
                    <th className="py-3 pr-4 font-bold">Untested edits</th>
                    <th className="py-3 pr-4 font-bold">Verified finish</th>
                    <th className="py-3 pr-4 font-bold">Failed test runs</th>
                    <th className="py-3 font-bold">Input tokens / Task B</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono tabular-nums">
                  {perModel.map(([name, ub, ua, vb, va, fb, fa, tb, ta]) => (
                    <tr key={name} className="hover:bg-white">
                      <td className="py-3 pr-4 font-sans font-semibold text-gray-900 whitespace-nowrap">{name}</td>
                      <td className="py-3 pr-4 whitespace-nowrap"><span className="text-gray-400">{ub}</span> → <b>{ua}</b></td>
                      <td className="py-3 pr-4 whitespace-nowrap"><span className="text-gray-400">{vb}</span> → <b>{va}</b></td>
                      <td className="py-3 pr-4 whitespace-nowrap"><span className="text-gray-400">{fb}</span> → <b>{fa}</b></td>
                      <td className="py-3 whitespace-nowrap"><span className="text-gray-400">{tb}</span> → <b>{ta}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs text-gray-500 font-sans">The two Ollama models (RTX 4050) fail Tasks A–C on both builds, so their “after” numbers are not meaningful. Haiku used more tokens after (more tool calls); the overall drop comes from Sonnet, Opus and the GPT models.</p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Retrieval */}
          <div className="lg:col-span-2 rounded-[2rem] border border-gray-100 bg-gray-50/60 p-6 sm:p-8 flex flex-col">
            <div className="mb-6">
              <h4 className="text-2xl font-bold font-heading tracking-tight">Context retrieval, held out</h4>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                200 real Flask commits: the commit subject is the request, the files it changed are the answer, the index is built at the parent commit.
                Tuned on a dev split, reported on the 103-commit test split.
              </p>
            </div>
            <div role="tablist" className="relative flex flex-wrap self-start rounded-full bg-white border border-gray-200 p-1 text-xs font-semibold mb-2">
              {(Object.keys(retrieval) as (keyof typeof retrieval)[]).map((k) => (
                <button key={k} role="tab" aria-selected={metric === k} onClick={() => setMetric(k)}
                  className={`relative px-3 py-1.5 rounded-full transition-colors ${metric === k ? 'text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  {metric === k && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-gray-900 -z-0" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
                  <span className="relative">{retrieval[k].label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-6">{data.label}: {data.gloss}</p>

            <div className="flex flex-col gap-6 flex-1 justify-center">
              {data.rows.map(([name, v], i) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className={`font-semibold ${i === 0 ? 'text-gray-900' : 'text-gray-500'}`}>{name}</span>
                    <motion.span key={`${metric}-${name}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="font-mono tabular-nums text-gray-700">{v.toFixed(3)}</motion.span>
                  </div>
                  <div className="h-3 rounded-full bg-white border border-gray-100 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${i === 0 ? 'bg-gradient-to-r from-gray-900 to-gray-700' : i === 1 ? 'bg-gray-400' : 'bg-gray-200'}`}
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
            <p className="mt-8 text-sm text-gray-500 border-t border-gray-200 pt-5 leading-relaxed">
              <b className="text-gray-900">BM25</b> = classic keyword scoring, the baseline. On the older 12-query hand-written set, Anvil scores recall@5 0.958 and MRR 0.854 (BM25 0.708 / 0.432),
              and the context pack averages <b className="text-gray-900">4,469 tokens</b> against 42,696 for the top eight files sent whole.
            </p>
          </div>

          {/* Edit robustness */}
          <div className="lg:col-span-3 rounded-[2rem] border border-gray-100 bg-gray-50/60 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <h4 className="text-2xl font-bold font-heading tracking-tight">Edit matcher robustness</h4>
                <p className="text-sm text-gray-500 mt-1">198 perturbed edits from 30 Flask functions. The matcher cascade tries exact → whitespace → indentation → fuzzy.</p>
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
              {[['15.2%', 'plain search/replace'], ['97.5%', 'Anvil cascade'], ['0/60', 'wrong-location edits']].map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-white border border-gray-100 p-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <div className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight">{v}</div>
                  <div className="text-[11px] sm:text-xs text-gray-500 mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bugs found by the benchmark */}
        <div className="mt-6 lg:mt-8 rounded-[2rem] border border-gray-100 bg-gray-50/60 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-white p-3 rounded-2xl shadow-sm"><Bug className="w-6 h-6 text-black" strokeWidth={1.5} /></div>
            <div>
              <h4 className="text-2xl font-bold font-heading tracking-tight">Bugs the benchmark found, then fixed</h4>
              <p className="text-sm text-gray-500">Running 7 models end to end exposed problems no single-model demo would. 78 unit tests pass on the branch.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {bugs.map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white border border-gray-100 p-4">
                <h5 className="font-semibold text-gray-900 mb-1">{t}</h5>
                <p className="text-sm text-gray-500 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
