import { useState } from 'react'
import DemoPlayer from '../demo/Player'
import { films } from '../demo/films'
import { tour } from '../demo/tour'
import { Icon, type IconName } from '../icons'
import { Link } from '../router'
import { Reveal, Section } from './Section'

const items: { id: string; label: string; line: string; icon: IconName; film: keyof typeof films | 'tour'; chapter?: string; doc: string }[] = [
  { id: 'edit', label: 'Inline edit', line: 'Change code where it sits.', icon: 'edit', film: 'tour', chapter: 'edit', doc: 'inline-edit' },
  { id: 'agent', label: 'Agent mode', line: 'Hand off a whole task.', icon: 'route', film: 'tour', chapter: 'agent', doc: 'agent-mode' },
  { id: 'context', label: 'Context', line: 'See what it read, and why.', icon: 'layers', film: 'context', doc: 'context' },
  { id: 'undo', label: 'Undo', line: 'Rewind chat, code, or both.', icon: 'undo', film: 'undo', doc: 'review-and-undo' },
  { id: 'skills', label: 'Skills', line: 'Teach it your way of working.', icon: 'book', film: 'skills', doc: 'skills' },
  { id: 'mcp', label: 'MCP servers', line: 'Plug in tools like your notes.', icon: 'plug', film: 'mcp', doc: 'mcp' },
  { id: 'failover', label: 'Failover', line: 'Keep going when a model fails.', icon: 'repeat', film: 'tour', chapter: 'failover', doc: 'models' },
]

export default function FeatureFilms() {
  const [active, setActive] = useState(items[0].id)
  const item = items.find((entry) => entry.id === active)!
  const film = item.film === 'tour' ? tour : films[item.film]
  return (
    <Section id="features" title="Watch every part work." description="Short films of the real product, recreated from its code. Pick a feature.">
      <Reveal>
        <div className="grid gap-5 lg:grid-cols-[17rem_1fr] lg:gap-8">
          <div role="tablist" aria-label="Features" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {items.map((entry) => {
              const on = entry.id === active
              return (
                <button
                  key={entry.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(entry.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all lg:w-full ${on ? 'border-gray-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${on ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Icon name={entry.icon} size={17} />
                  </span>
                  <span>
                    <span className={`block text-sm font-semibold ${on ? 'text-gray-900' : 'text-gray-600'}`}>{entry.label}</span>
                    <span className="hidden text-xs text-gray-500 lg:block">{entry.line}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div>
            <DemoPlayer key={item.id} film={film} only={item.chapter ?? film.chapters[0].id} label={`${item.label} demo`} />
            <Link to={`/docs/${item.doc}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline">
              Read about {item.label.toLowerCase()}
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
