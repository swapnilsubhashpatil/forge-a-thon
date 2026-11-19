import { AlertTriangle, CircleSlash, FlaskConical } from 'lucide-react'
import { Disclosure, SectionHead } from './charts'

// Sources: docs/benchmarks/agent-mode-findings.md ("Limits", "Excluded", guard scenarios), docs/benchmarks/context.md ("Limitations").
const notProven: [string, string][] = [
  ['Guards proven with a scripted model, not real ones', 'Real models triggered 0 scope, grounding or loop warnings on Task B in both builds. The scripted model (9/9 pass) proves the mechanism, not how often real models need it. Terminal-to-chat is unit-tested only.'],
  ['Pass rates barely moved', 'Task A and C 10/14 on both builds, cancel 14/14 on both, Task B 9/14 → 10/14. The gain is in behaviour, not in what models can solve.'],
  ['Local models are not meaningful yet', 'The 7–8B Ollama models on a 6 GB RTX 4050 fail Tasks A–C on both builds; they do not produce a usable propose_edit.'],
  ['Task B is easy for retrieval', 'Both builds predicted 100% of the edited files, so retrieval is measured on 200 real commits instead.'],
  ['Small sample, one repository', '2 runs per model per build on Flask 3.1.3. Haiku used more tokens after (313k vs 268k); prompt-cache hit went 76% → 73%.'],
]

const excluded: [string, string][] = [
  ['Groq gpt-oss-120b', '400: reasoning_content unsupported (TrueForge echoes reasoning back; harness bug).'],
  ['Groq qwen3.8-27b', 'Called a non-existent tool; Groq rejects it server-side.'],
  ['OpenRouter free models (3)', '429: free daily quota used up.'],
  ['OpenRouter Jev Router', '402: not enough credits.'],
]

const notBuilt = ['Diagnostics (lint / type errors) fed back after an edit', 'Chat history that survives a window reload', 'Parallel read-only tool calls']

export default function Limits() {
  return (
    <section id="limits" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHead eyebrow="05 · Honest limits" title="What is not proven yet." />

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 lg:gap-6 items-start">
          <ul className="flex flex-col gap-3">
            {notProven.map(([t, d]) => (
              <li key={t} className="rounded-[1.5rem] border border-amber-100 bg-amber-50/40 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
                  <div className="min-w-0">
                    <h4 className="text-base font-bold font-heading tracking-tight text-gray-900">{t}</h4>
                    <Disclosure label="Why" className="mt-2"><p>{d}</p></Disclosure>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <div className="rounded-[1.5rem] border border-gray-100 bg-gray-50/60 p-5">
              <div className="flex items-center gap-3">
                <CircleSlash className="w-5 h-5 text-gray-700" strokeWidth={1.75} aria-hidden />
                <h4 className="text-base font-bold font-heading tracking-tight">6 of 13 models excluded</h4>
              </div>
              <p className="text-sm text-gray-500 mt-1">Provider or account errors, not Anvil behaviour.</p>
              <Disclosure label="Which, and why" className="mt-3">
                <ul className="space-y-1.5">{excluded.map(([m, c]) => <li key={m}><b className="text-gray-900">{m}:</b> {c}</li>)}</ul>
              </Disclosure>
            </div>
            <div className="rounded-[1.5rem] border border-gray-100 bg-gray-50/60 p-5">
              <div className="flex items-center gap-3">
                <FlaskConical className="w-5 h-5 text-gray-700" strokeWidth={1.75} aria-hidden />
                <h4 className="text-base font-bold font-heading tracking-tight">Not built this round</h4>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {notBuilt.map((n) => <li key={n} className="flex gap-2"><span className="text-gray-300 select-none">—</span><span>{n}</span></li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
