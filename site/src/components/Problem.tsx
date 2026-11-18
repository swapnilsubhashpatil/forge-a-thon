import { motion } from 'framer-motion'
import { Crosshair, ScanEye, SearchCheck } from 'lucide-react'
import { EASE_OUT } from '../motion'

const guards = [
  {
    icon: ScanEye, id: 'G1', complaint: 'It loses track of the file you care about.',
    name: 'Live context scorecard',
    gloss: 'A running list of what Anvil predicted, what the agent actually read, and what it edited.',
    shows: [
      'Context card: predicted (top 10 of the context pack) · read · edited',
      'Final line: “edited files in top-5 predicted: n/m”',
      'Context gauge: input tokens vs the 60k compaction trigger, plus prompt-cache hit %',
    ],
    proof: 'Edited files inside the top-5 prediction: 100% on Task B. Held-out: a right file in the top 5 for 85.4% of 103 real Flask commits.',
    proven: true,
  },
  {
    icon: Crosshair, id: 'G2', complaint: 'It rewrites a function you did not ask it to touch.',
    name: 'Scope badges',
    gloss: 'A warning on any change that lands somewhere you did not point at, or that the agent never looked at.',
    shows: [
      'Inline edit: amber “outside selection” on hunks beyond the selected range',
      'Agent: amber “edited without reading” on lines no read_file or pack slice covered',
      'Never blocks Accept; the model is told which hunks were flagged',
    ],
    proof: 'Shown end to end with a scripted misbehaving model (fake-model guard suite, 9/9 pass). Real models never triggered it on Task B (0 warnings in both builds).',
    proven: true,
  },
  {
    icon: SearchCheck, id: 'G3', complaint: 'It confidently edits a symbol that does not exist.',
    name: 'Grounding badges',
    gloss: 'A check that every function or import the new code uses really exists somewhere.',
    shows: [
      'Names in each hunk are checked against the workspace symbol index, the file’s own definitions, Python builtins and imports',
      'Unknown name → red “`name` is not defined anywhere” badge',
      'Only flags when confident; skips attribute access on unknown objects',
    ],
    proof: 'Shown end to end with a scripted misbehaving model (fake-model guard suite, 9/9 pass). Real models never triggered it on Task B (0 warnings in both builds).',
    proven: true,
  },
]

export default function Problem() {
  return (
    <section id="problem" className="py-24 md:py-32 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-20 mb-16 md:mb-20 items-end">
          <div>
            <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">01 · What we did</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">
              Three complaints. Three guards you can see.
            </h3>
          </div>
          <div className="text-lg text-gray-500 leading-relaxed space-y-4">
            <p>
              The brief opens with three things engineers dislike about AI coding tools. Anvil on <code className="font-mono text-sm">main</code> already
              passed the three fixed tasks. The agent-mode work kept that, gave each complaint a visible guard in the editor, and changed
              how the agent explores, verifies and finishes.
            </p>
            <p>
              Then we measured it: the same end-to-end suite against both builds, on every model whose provider answered.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {guards.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: EASE_OUT }}
              className="group rounded-[2rem] border border-gray-100 bg-gray-50/60 p-7 sm:p-8 flex flex-col hover:bg-white hover:border-gray-200 hover:shadow-xl transition-all duration-500"
            >
              <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">The complaint</p>
              <blockquote className="text-xl font-heading font-semibold text-gray-900 tracking-tight leading-snug mb-6">“{g.complaint}”</blockquote>

              <div className="flex items-center gap-3 mb-3">
                <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:-rotate-6 transition-transform">
                  <g.icon className="w-6 h-6 text-black" strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-xs font-mono font-semibold text-ember-600">{g.id}</span>
                  <h4 className="text-xl font-bold font-heading tracking-tight text-gray-900 leading-tight">{g.name}</h4>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{g.gloss}</p>

              <ul className="space-y-2 mb-6 text-sm text-gray-700">
                {g.shows.map((s) => (
                  <li key={s} className="flex gap-2"><span className="text-gray-300 select-none">—</span><span>{s}</span></li>
                ))}
              </ul>

              <div className={`mt-auto rounded-2xl border px-4 py-3 text-sm leading-relaxed ${g.proven ? 'border-emerald-100 bg-emerald-50/60 text-emerald-900' : 'border-amber-100 bg-amber-50/60 text-amber-900'}`}>
                <span className="font-semibold">{g.proven ? 'Measured. ' : 'Not proven yet. '}</span>{g.proof}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
