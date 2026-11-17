import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { EASE_OUT } from '../motion'
import { AFTER, BASE, BEFORE, Bar, Disclosure, Flow, Legend, PairBars, SectionHead, card } from './charts'

/* ---------- Per model: docs/benchmarks/agent-mode.md ("Per model") ---------- */

type ModelRow = { name: string; local?: boolean; v: Record<MetricKey, [number, number]> }
type MetricKey = 'failed' | 'tokens' | 'secs' | 'tools' | 'verified'

const models: ModelRow[] = [
  { name: 'Claude Haiku 5.5', v: { failed: [4.5, 0.5], tokens: [267711, 313313], secs: [52, 49], tools: [21.5, 26.0], verified: [0, 2] } },
  { name: 'Claude Sonnet 5.5', v: { failed: [3.5, 0.0], tokens: [130523, 95238], secs: [37, 27], tools: [14.5, 11.0], verified: [0, 2] } },
  { name: 'Claude Opus 5.5', v: { failed: [3.0, 0.0], tokens: [130572, 101838], secs: [44, 29], tools: [12.0, 12.0], verified: [0, 2] } },
  { name: 'GPT-5.4-mini', v: { failed: [6.0, 1.5], tokens: [610034, 361568], secs: [117, 69], tools: [41.5, 33.5], verified: [0, 2] } },
  { name: 'GPT-6.1-sol', v: { failed: [5.0, 0.0], tokens: [157084, 104626], secs: [62, 41], tools: [17.5, 19.0], verified: [0, 2] } },
  { name: 'qwen3-8b-16k', local: true, v: { failed: [0.0, 0.0], tokens: [50629, 6900], secs: [271, 86], tools: [5.0, 1.0], verified: [0, 0] } },
  { name: 'qwen2.5-coder-7b-16k', local: true, v: { failed: [0.0, 0.0], tokens: [6889, 6860], secs: [41, 43], tools: [0.0, 0.0], verified: [0, 0] } },
]

const metrics: Record<MetricKey, { label: string; fmt: (v: number) => string; flow: string }> = {
  failed: { label: 'Failed test runs', fmt: (v) => v.toFixed(1), flow: 'Every hosted model: pytest fails for setup reasons → turns burned → after, 0 to 1.5 failures per run.' },
  verified: { label: 'Verified finish', fmt: (v) => `${v}/2`, flow: 'Every hosted model: edits → passing check → “verified” on both runs; before, no model could say so.' },
  tokens: { label: 'Input tokens', fmt: (v) => `${Math.round(v / 1000)}k`, flow: 'Fewer failing loops → fewer tokens for Sonnet, Opus and the GPT models; Haiku used more (more tool calls).' },
  secs: { label: 'Seconds', fmt: (v) => `${v}s`, flow: 'Less time chasing setup failures → shorter Task B runs for every hosted model.' },
  tools: { label: 'Tool calls', fmt: (v) => v.toFixed(1), flow: 'Fewer calls for Sonnet and GPT-5.4-mini; Haiku and GPT-6.1-sol made more.' },
}

/* ---------- Retrieval: docs/benchmarks/context-history.md (test split, 103 tasks) ---------- */

const retrieval: [string, string, [number, number, number]][] = [
  // [metric, gloss, [anvil after, anvil before, bm25]]
  ['hit@5', 'a right file in the top 5', [0.854, 0.825, 0.699]],
  ['all@5', 'every right file in the top 5', [0.515, 0.466, 0.369]],
  ['recall@5', 'share of right files in the top 5', [0.685, 0.647, 0.521]],
  ['MRR', '1 / rank of the first right file', [0.716, 0.699, 0.532]],
]
const series: [string, string][] = [[AFTER, 'Anvil after'], [BEFORE, 'Anvil before'], [BASE, 'BM25']]

/* ---------- Edits: docs/benchmarks/edits.md ---------- */

const edits: [string, number, number][] = [
  ['none', 100, 100],
  ['trailing whitespace', 0, 100],
  ['tabs instead of spaces', 0, 100],
  ['wrong indentation', 0, 100],
  ['CRLF file, LF old_string', 0, 100],
  ['one-character typo', 0, 83.3],
  ['missing blank line', 0, 100],
]

/* ---------- Guard scenarios: agent-mode-findings.md ("Guard scenarios with a scripted model") ---------- */

const scenarios: [string, string, string][] = [
  ['G3 + G2 · agent', 'Edits lines it never read, calling get_secret_keys()', 'Its tool result carries both the grounding and the “edited without reading” warning'],
  ['G2 · inline', 'Selection is get_debug_flag, edits get_load_dotenv', '“outside selection” reaches the model'],
  ['M7 · loop', 'Repeats the same read_file', 'Nudge at 3, turn stopped at 5, tree clean'],
  ['M8 · finish', 'Edits, then says “Done, it should work.”', 'Exactly one follow-up, a test run, finish_task verified'],
  ['M3 · rejection', 'One edit, two hunks; the first is rejected', 'The model receives “new baseline” and the current text'],
  ['M11 · steering', 'Slow reads; a note is sent mid-turn', 'The note arrives inside the next tool result, not as a new turn'],
  ['M10 · step limit', 'Distinct searches past iterationLimit=5', 'No failover, a notice, one wrap-up turn with finish_task'],
  ['Attachments', 'Nothing; the test attaches a selection', 'The selection is in the request and on the Context card'],
  ['M2 · subagent', 'Child edits, runs pytest, runs git log', 'Edit and pytest refused as read-only; git log allowed'],
]

const bugs: [string, string][] = [
  ['Turn budget counted ~15× too high', 'Each streamed delta re-emitted the model message; Haiku quit at “116/60”.'],
  ['Ollama truncated prompts', 'A 4k default context silently cut the pack; local models now run as *-16k variants.'],
  ['Lowercase drive letter', 'c:\\… in the command cwd made 7 unrelated Flask tests fail.'],
  ['G2 selection slack', 'A one-line change just past the selection was treated as an insertion and not flagged.'],
  ['M7 missed a loop', 'A failing test re-run alternating with rejected finish_task calls was not caught.'],
  ['Settings never reached TrueForge', 'Changing iterationLimit or reasoning effort mid-session had no effect; now part of the spec key.'],
  ['M10 wrapped up the wrong turn', 'The wrap-up continued from the turn before the limited one; it now continues from the limited turn.'],
]

export default function Benchmarks() {
  const [m, setM] = useState<MetricKey>('failed')
  const reduce = useReducedMotion()
  const meta = metrics[m]
  const max = Math.max(...models.map((r) => Math.max(...r.v[m]))) || 1

  return (
    <section id="benchmarks" className="py-20 md:py-28 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHead eyebrow="03 · Results" title="Receipts, not adjectives."
          sub={<>Measured on Flask 3.1.3. Scripts and raw rows live in <code className="font-mono text-sm">docs/benchmarks/</code>.</>} />

        {/* Per model */}
        <div className={`${card} mb-4 lg:mb-6`}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h4 className="text-2xl font-bold font-heading tracking-tight">Per model, Task B</h4>
              <p className="text-sm text-gray-500 mt-1">Average of 2 runs per build.</p>
            </div>
            <Legend items={[[BEFORE, 'before · main'], [AFTER, 'after · branch']]} />
          </div>

          <div role="tablist" aria-label="Metric" className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-6 [scrollbar-width:none]">
            {(Object.keys(metrics) as MetricKey[]).map((key) => (
              <button key={key} role="tab" aria-selected={m === key} onClick={() => setM(key)}
                className={`relative shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${m === key ? 'text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900'}`}>
                {m === key && <motion.span layoutId="model-metric" className="absolute inset-0 rounded-full bg-gray-900" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
                <span className="relative">{metrics[key].label}</span>
              </button>
            ))}
          </div>

          <div key={m} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
            {models.map((r, i) => (
              <PairBars key={r.name} label={r.name} sub={r.local ? 'local · fails Tasks A–C on both builds' : undefined}
                before={r.v[m][0]} after={r.v[m][1]} max={m === 'verified' ? 2 : max} fmt={meta.fmt} delay={i * 0.05} dim={r.local} />
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-gray-200/70 flex flex-col gap-4">
            <Flow>{meta.flow}</Flow>
            <Disclosure label="How we measured">
              <p>Each model ran Task B twice on each build; values are per-run averages from <code className="font-mono text-xs">agent-mode.md</code>. Hosted models: Anthropic and OpenAI. Local: Ollama on a 6 GB RTX 4050, which fail Tasks A–C on both builds, so their numbers say nothing about Anvil.</p>
              <p>Task B passed per model: all hosted models 2/2 after; GPT-5.4-mini went 1/2 → 2/2.</p>
            </Disclosure>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-6">
          {/* Retrieval */}
          <div className={card}>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div>
                <h4 className="text-2xl font-bold font-heading tracking-tight">Finding the right files</h4>
                <p className="text-sm text-gray-500 mt-1">Held out: 103 real Flask commits.</p>
              </div>
              <Legend items={series} />
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-6">
              {retrieval.map(([name, gloss, vals], gi) => (
                <div key={name} role="img" aria-label={`${name}: Anvil after ${vals[0]}, Anvil before ${vals[1]}, BM25 ${vals[2]}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900">{name}</span>
                    <span className="text-[11px] text-gray-400 text-right">{gloss}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {vals.map((v, i) => (
                      <div key={i} className="grid grid-cols-[1fr_3rem] items-center gap-2">
                        <Bar pct={v * 100} cls={series[i][0]} delay={gi * 0.08 + i * 0.1} />
                        <span className={`font-mono text-xs tabular-nums text-right ${i === 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>{v.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-gray-200/70 flex flex-col gap-4">
              <Flow>A commit subject becomes the request → Anvil ranks every file → is a file the commit changed in its top 5?</Flow>
              <Disclosure label="How we measured">
                <p>200 non-merge Flask commits since May 2021: the subject is the request, the files it changed are the answer, the index is built at the parent commit. Tuned on a dev split; reported on the 103-commit test split.</p>
                <p>“After” adds git co-change companions and demotes requirements/CI/changelog files. BM25 is classic keyword scoring over the same index.</p>
              </Disclosure>
            </div>
          </div>

          {/* Edits */}
          <div className={card}>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div>
                <h4 className="text-2xl font-bold font-heading tracking-tight">Edits that land</h4>
                <p className="text-sm text-gray-500 mt-1">198 perturbed edits from 30 Flask functions.</p>
              </div>
              <Legend items={[['bg-gray-300', 'exact match only'], [AFTER, 'Anvil cascade']]} />
            </div>
            <div className="flex flex-col gap-3.5">
              {edits.map(([name, exact, cascade], i) => (
                <div key={name} role="img" aria-label={`${name}: exact match ${exact}%, Anvil cascade ${cascade}%`}
                  className="grid grid-cols-[minmax(0,8.5rem)_1fr_3.25rem] sm:grid-cols-[11rem_1fr_3.25rem] items-center gap-3">
                  <span className="text-xs sm:text-sm text-gray-700 leading-tight">{name}</span>
                  <div className="flex flex-col gap-1">
                    <Bar pct={exact} cls="bg-gray-300" delay={i * 0.05} h="h-1.5" />
                    <Bar pct={cascade} cls={AFTER} delay={0.1 + i * 0.05} h="h-1.5" />
                  </div>
                  <span className="font-mono text-xs sm:text-sm tabular-nums text-gray-900 text-right">{cascade}%</span>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 text-center">
              {[['15.2%', 'plain search/replace'], ['97.5%', 'Anvil cascade'], ['0/60', 'wrong-location edits']].map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-white border border-gray-100 p-3">
                  <div className="text-lg sm:text-2xl font-heading font-extrabold tracking-tight">{v}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-gray-200/70 flex flex-col gap-4">
              <Flow>Model sends old_string with tabs instead of spaces → exact match fails → the cascade re-indents and applies it.</Flow>
              <Disclosure label="How it works">
                <p>The matcher tries exact → whitespace → indentation → fuzzy. Fuzzy needs 4+ non-blank lines, each ≥80% similar, and a clear lead over any runner-up, so near-identical siblings are rejected.</p>
                <p>Typo misses are short lines that fall under the 80% floor; they fail with a hint showing the closest lines. Perturbations are synthetic and applied one at a time.</p>
              </Disclosure>
            </div>
          </div>
        </div>

        {/* Guard scenarios */}
        <div className={card}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h4 className="text-2xl font-bold font-heading tracking-tight">Guards, forced to fire</h4>
              <p className="text-sm text-gray-500 mt-1">A scripted model misbehaves on purpose, through the real extension and TrueForge.</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-heading font-extrabold tracking-tighter text-emerald-600 tabular-nums">9/9</span>
              <span className="text-sm text-gray-500">pass</span>
            </div>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scenarios.map(([tag, does, passes], i) => (
              <motion.li key={tag}
                initial={reduce ? false : { opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.4, delay: reduce ? 0 : (i % 3) * 0.06, ease: EASE_OUT }}
                className="rounded-2xl bg-white border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-mono font-semibold text-ember-600">{tag}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="w-4 h-4" aria-hidden />pass</span>
                </div>
                <p className="text-sm text-gray-700 leading-snug"><span className="text-gray-400">Model: </span>{does}</p>
                <p className="text-sm text-gray-900 leading-snug mt-1"><span className="text-emerald-600 font-semibold">→ </span>{passes}</p>
              </motion.li>
            ))}
          </ul>
          <div className="mt-6 pt-5 border-t border-gray-200/70 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            <Disclosure label="How we measured">
              <p><code className="font-mono text-xs">scripts/fake-model.mjs</code> is an OpenAI-compatible server registered in TrueForge as a custom provider; <code className="font-mono text-xs">scripts/e2e-guards.mjs</code> drives the real extension, TrueForge and MCP tool server against it.</p>
              <p>This proves the mechanism, not how often real models need it: on Task B real models triggered 0 guard warnings in both builds. The terminal-to-chat command is unit-tested only. 83 unit tests pass.</p>
            </Disclosure>
            <Disclosure label={`${bugs.length} bugs these runs found, then fixed`}>
              <ul className="space-y-1.5">
                {bugs.map(([t, d]) => <li key={t}><b className="text-gray-900">{t}.</b> {d}</li>)}
              </ul>
            </Disclosure>
          </div>
        </div>
      </div>
    </section>
  )
}
