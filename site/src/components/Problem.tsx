import { motion } from 'framer-motion'
import { Crosshair, ScanEye, SearchCheck } from 'lucide-react'
import { EASE_OUT } from '../motion'
import { Disclosure, Flow, SectionHead } from './charts'

const guards = [
  {
    icon: ScanEye, id: 'G1', complaint: 'It loses track of the file you care about.',
    name: 'Live context scorecard',
    flow: 'You ask for a change → Anvil predicts the files → the card shows predicted · read · edited, live.',
    proof: ['100%', 'edited files inside the top-5 prediction (Task B)'],
    how: [
      'Context card: predicted (top 10 of the context pack) · read · edited, plus “edited files in top-5 predicted: n/m”.',
      'Context gauge: input tokens against the 60k compaction trigger, with prompt-cache hit %.',
      'Held out on 103 real Flask commits: a right file is in the top 5 for 85.4% of them.',
    ],
  },
  {
    icon: Crosshair, id: 'G2', complaint: 'It rewrites a function you did not ask it to touch.',
    name: 'Scope badges',
    flow: 'You select get_debug_flag → the agent edits get_load_dotenv → amber “outside selection” badge, and the model is told.',
    proof: ['9/9', 'guard scenarios pass with a scripted misbehaving model'],
    how: [
      'Inline edit: “outside selection” on hunks beyond the selected range. Agent: “edited without reading” on lines no read_file or pack slice covered.',
      'Never blocks Accept; the tool result tells the model which hunks were flagged.',
      'Real models never triggered it on Task B (0 warnings in both builds).',
    ],
  },
  {
    icon: SearchCheck, id: 'G3', complaint: 'It confidently edits a symbol that does not exist.',
    name: 'Grounding badges',
    flow: 'The agent calls get_secret_keys() → no such name anywhere → red badge on the hunk, and the model is told.',
    proof: ['9/9', 'guard scenarios pass with a scripted misbehaving model'],
    how: [
      'Each hunk’s calls and imports are checked against the workspace symbol index, the file’s own definitions, Python builtins and imports.',
      'Only flags when confident; skips attribute access on unknown objects.',
      'Real models never triggered it on Task B (0 warnings in both builds).',
    ],
  },
]

export default function Problem() {
  return (
    <section id="problem" className="py-20 md:py-28 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHead eyebrow="01 · What we did" title="Three complaints. Three guards you can see." />

        <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
          {guards.map((g, i) => (
            <motion.div key={g.id}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE_OUT }}
              className="group rounded-[2rem] border border-gray-100 bg-gray-50/60 p-5 sm:p-7 flex flex-col gap-5 hover:bg-white hover:border-gray-200 hover:shadow-xl transition-all duration-500">
              <blockquote className="text-xl font-heading font-semibold text-gray-900 tracking-tight leading-snug">“{g.complaint}”</blockquote>

              <div className="flex items-center gap-3">
                <div className="bg-white p-2.5 rounded-2xl shadow-sm group-hover:-rotate-6 transition-transform">
                  <g.icon className="w-5 h-5 text-black" strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-xs font-mono font-semibold text-ember-600">{g.id}</span>
                  <h4 className="text-lg font-bold font-heading tracking-tight text-gray-900 leading-tight">{g.name}</h4>
                </div>
              </div>

              <Flow>{g.flow}</Flow>

              <div className="mt-auto flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <span className="text-2xl font-heading font-extrabold text-emerald-700 tabular-nums">{g.proof[0]}</span>
                <span className="text-xs text-emerald-900 leading-snug">{g.proof[1]}</span>
              </div>

              <Disclosure>
                <ul className="space-y-1.5">
                  {g.how.map((s) => <li key={s} className="flex gap-2"><span className="text-gray-300 select-none">—</span><span>{s}</span></li>)}
                </ul>
              </Disclosure>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
