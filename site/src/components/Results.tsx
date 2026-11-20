import { Icon, type IconName } from '../icons'
import { Link } from '../router'
import { Reveal, Section } from './Section'

const results: { icon: IconName; value: string; label: string; detail: string }[] = [
  { icon: 'target', value: '96%', label: 'of the files a change needs are in Anvil’s top five picks', detail: '12 hand-labelled Flask tasks. Plain keyword search finds 71%.' },
  { icon: 'layers', value: '89%', label: 'less code sent to the model', detail: '4.5k tokens of focused context instead of 42.7k for the same files whole.' },
  { icon: 'test', value: '0 of 14', label: 'runs ended with untested edits', detail: 'Down from 11 of 14. The agent now proves its change before it stops.' },
  { icon: 'fileEdit', value: '97.5%', label: 'of model edits land where intended', detail: 'Exact match alone manages 15.2%. Zero edits went to the wrong place.' },
  { icon: 'flash', value: '5 s', label: 'to switch models when one fails', detail: 'Measured live: a dead model, then Claude Sonnet finishing the same edit.' },
  { icon: 'shield', value: '115', label: 'automated checks on every change', detail: 'Unit tests, ten safety scenarios in real VS Code, and live model runs.' },
]

export default function Results() {
  return (
    <Section
      id="results"
      title="Measured, not promised."
      description="Every number below comes from a benchmark you can rerun from the repo, on the real Flask codebase."
      className="bg-gradient-to-b from-white to-gray-50/80"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((item, i) => (
          <Reveal key={item.value + item.label} delay={0.05 * i}>
            <article className="h-full rounded-3xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] sm:p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-ember-50 text-ember-600">
                <Icon name={item.icon} size={20} />
              </span>
              <p className="mt-5 font-heading text-4xl font-semibold tracking-tighter text-gray-900 sm:text-5xl">{item.value}</p>
              <p className="mt-2 text-base font-medium leading-snug text-gray-900">{item.label}</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.detail}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10 text-center">
        <Link to="/docs/benchmarks" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline">
          See how we measured
          <Icon name="arrow" size={15} />
        </Link>
      </Reveal>
    </Section>
  )
}
