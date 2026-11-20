import { Icon, type IconName } from '../icons'
import { Link } from '../router'
import { Reveal, Section } from './Section'

const steps: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'fileSearch',
    title: 'Anvil picks the context',
    body: 'Before each request it ranks every file in your repo, on your machine, in a few milliseconds. Only the parts that matter go to the model.',
  },
  {
    icon: 'activity',
    title: 'TrueForge runs the agent',
    body: 'The open agent harness from TrueFoundry drives the model. Anvil gives it editor tools, your skills and any MCP servers you add.',
  },
  {
    icon: 'check',
    title: 'You approve what lands',
    body: 'Each edit opens as a review in the editor. The agent runs your tests and only says done when they pass.',
  },
]

export default function HowItWorks() {
  return (
    <Section id="how" title="How it works." description="Three parts, each doing one job well. Your code stays on your machine except what the model needs to see." className="bg-gray-50/80">
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={0.06 * i}>
            <li className="relative h-full rounded-3xl border border-gray-200/70 bg-white p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-gray-900 text-white">
                  <Icon name={step.icon} size={19} />
                </span>
                <span className="font-mono text-sm text-gray-400">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-heading text-xl font-semibold tracking-tight text-gray-900">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{step.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
      <Reveal className="mt-10 text-center">
        <Link to="/docs/architecture" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline">
          Read the architecture
          <Icon name="arrow" size={15} />
        </Link>
      </Reveal>
    </Section>
  )
}
