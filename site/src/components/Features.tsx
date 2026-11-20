import { Icon, type IconName } from '../icons'
import { Link } from '../router'
import { Reveal, Section } from './Section'

const features: { icon: IconName; title: string; body: string; doc: string }[] = [
  { icon: 'edit', title: 'Edit in place', body: 'Select code, press Ctrl+Alt+K, say what to change. The diff appears right there, and you keep, reject or keep both.', doc: 'inline-edit' },
  { icon: 'route', title: 'Hand off whole tasks', body: 'Describe the goal in the side panel. Anvil reads, edits several files, runs your tests and shows the proof.', doc: 'agent-mode' },
  { icon: 'layers', title: 'Context you can see', body: 'Every request shows which files Anvil picked, why it picked them, and how much of the budget they use.', doc: 'context' },
  { icon: 'undo', title: 'Undo anything', body: 'Nothing is saved until you approve it. Rewind a chat, the code, or both, from any message.', doc: 'review-and-undo' },
  { icon: 'repeat', title: 'Keeps going when a model fails', body: 'Put several models in a chain. If one is down or rate limited, the next takes over and says why.', doc: 'models' },
  { icon: 'puzzle', title: 'Skills and MCP tools', body: 'Teach it your workflows with skill files, and plug in MCP servers like docs search or your notes.', doc: 'skills' },
]

export default function Features() {
  return (
    <Section id="features" title="Everything you would check yourself." description="Anvil does the work, and leaves every decision with you. These six habits make that possible.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <Reveal key={feature.title} delay={0.05 * i}>
            <Link
              to={`/docs/${feature.doc}`}
              className="group flex h-full flex-col rounded-3xl border border-gray-200/70 bg-gray-50/60 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-200 hover:bg-white hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] sm:p-7"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-gray-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-gray-200/70">
                <Icon name={feature.icon} size={21} />
              </span>
              <h3 className="mt-5 font-heading text-xl font-semibold tracking-tight text-gray-900">{feature.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-gray-600">{feature.body}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 opacity-70 transition group-hover:opacity-100">
                Learn more
                <Icon name="arrow" size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
