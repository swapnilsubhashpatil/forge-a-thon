import { AlertTriangle, CircleSlash, FlaskConical } from 'lucide-react'

// Sources: docs/benchmarks/agent-mode-findings.md ("Limits", "Excluded"), docs/benchmarks/context.md ("Limitations"),
// conductor/tracks/t8-standout/agent-mode-comparison.md §4 (gaps 13–15).
const notProven = [
  ['Guardrails are not shown end to end', 'Scope badges (G2), grounding badges (G3) and the loop guard (M7) fired 0 times in both builds. The models that pass Task B stay in scope, call real functions and do not loop, so Task B cannot exercise them. They are covered by unit tests only. A scripted misbehaving “fake model” is the way to test them end to end, and it is not built yet.'],
  ['Pass rates barely moved', 'Task A and Task C passed 10/14 on both builds, cancel 14/14 on both. Task B went 9/14 → 10/14. The gain is in behaviour (testing, honest finishes, fewer wasted runs), not in what the models can solve.'],
  ['Local models are not meaningful yet', 'The 7–8B Ollama models on a 6 GB RTX 4050 fail Tasks A–C on both builds: they do not produce a usable propose_edit. Their “after” numbers say nothing about Anvil.'],
  ['Task B is easy for retrieval', 'Both builds predicted 100% of the edited files, so Task B cannot show a retrieval gain. That is why retrieval is measured on 200 real commits instead. The older 12-query set was written while tuning the ranker: a sanity check, not a held-out score.'],
  ['Small sample, one repository', '2 runs per build per model, on one Python repository (Flask 3.1.3). Not every metric improved: Haiku used more tokens after (313k vs 268k), and the prompt-cache hit rate went from 76% to 73%.'],
]

const excluded = [
  ['Groq gpt-oss-120b', '400: “reasoning_content is unsupported”. TrueForge echoes reasoning back in assistant messages and Groq rejects it (harness bug).'],
  ['Groq qwen3.8-27b', 'Called a non-existent tool; Groq rejects invalid tool calls server-side before the harness can recover.'],
  ['OpenRouter free models (north-mini-code, gemma-4, nemotron)', '429 free-models-per-day: the account’s free daily quota was used up.'],
  ['OpenRouter Jev Router', '402: requires more credits than the account had.'],
]

const notBuilt = [
  'Diagnostics (lint / type errors) fed back after an edit',
  'Chat history that survives a window reload',
  'Parallel read-only tool calls',
]

export default function Limits() {
  return (
    <section id="limits" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-12 md:mb-16 gap-6">
          <div className="max-w-3xl">
            <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">05 · Honest limits</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">
              What is not proven yet.
            </h3>
          </div>
          <p className="max-w-sm text-lg text-gray-500">The numbers above are real, and so are these gaps. Read them together.</p>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 lg:gap-8">
          <div className="flex flex-col gap-3">
            {notProven.map(([t, d]) => (
              <div key={t} className="rounded-[1.5rem] border border-amber-100 bg-amber-50/40 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div>
                    <h4 className="text-lg font-bold font-heading tracking-tight text-gray-900">{t}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed mt-1">{d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[2rem] border border-gray-100 bg-gray-50/60 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-2">
                <CircleSlash className="w-5 h-5 text-gray-700" strokeWidth={1.75} />
                <h4 className="text-xl font-bold font-heading tracking-tight">Excluded runs, and why</h4>
              </div>
              <p className="text-sm text-gray-500 mb-5">6 of the 13 models tried never got a fair run: provider or account errors, not Anvil behaviour. They are left out of every number above.</p>
              <ul className="flex flex-col gap-4">
                {excluded.map(([m, c]) => (
                  <li key={m}>
                    <div className="text-sm font-semibold text-gray-900">{m}</div>
                    <div className="text-sm text-gray-500 leading-relaxed">{c}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50/60 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <FlaskConical className="w-5 h-5 text-gray-700" strokeWidth={1.75} />
                <h4 className="text-xl font-bold font-heading tracking-tight">Not built</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                {notBuilt.map((n) => (
                  <li key={n} className="flex gap-2"><span className="text-gray-300 select-none">—</span><span>{n}</span></li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-gray-400">Common in other agents (opencode, Cline, Cursor, Codex, Claude Code); not part of this round.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
