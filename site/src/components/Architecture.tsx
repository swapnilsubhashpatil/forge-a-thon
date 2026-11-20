import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../icons'
import { Link } from '../router'
import { Reveal, Section } from './Section'

const hand = "'Caveat', cursive"
const ink = '#1f2937'
const ember = '#ea580c'

type Box = { x: number; y: number; w: number; h: number; fill: string }

const jitter = (seed: number) => ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * 2.2

function rough({ x, y, w, h }: Box, seed: number) {
  const j = (n: number) => jitter(seed + n)
  return `M${x + j(1)} ${y + j(2)} L${x + w + j(3)} ${y + j(4)} L${x + w + j(5)} ${y + h + j(6)} L${x + j(7)} ${y + h + j(8)} Z`
}

function Sketch({ box, seed, active, children }: { box: Box; seed: number; active: boolean; children?: ReactNode }) {
  return (
    <g>
      <path d={rough(box, seed)} fill={box.fill} stroke="none" />
      <path d={rough(box, seed)} fill="none" stroke={active ? ember : ink} strokeWidth={active ? 2.4 : 1.6} strokeLinejoin="round" />
      <path d={rough(box, seed + 9)} fill="none" stroke={active ? ember : ink} strokeWidth={1} opacity={0.5} strokeLinejoin="round" />
      {children}
    </g>
  )
}

const label = (x: number, y: number, text: string, size = 26, weight = 600, color = ink) => (
  <text x={x} y={y} fontFamily={hand} fontSize={size} fontWeight={weight} fill={color}>
    {text}
  </text>
)

const boxes = {
  you: { x: 30, y: 200, w: 170, h: 110, fill: '#f8fafc' },
  anvil: { x: 260, y: 40, w: 320, h: 440, fill: '#fff7ed' },
  context: { x: 285, y: 95, w: 270, h: 88, fill: '#ffffff' },
  review: { x: 285, y: 213, w: 270, h: 88, fill: '#ffffff' },
  tools: { x: 285, y: 331, w: 270, h: 88, fill: '#ffffff' },
  forge: { x: 640, y: 120, w: 170, h: 290, fill: '#eef2ff' },
  models: { x: 860, y: 120, w: 120, h: 290, fill: '#f0fdf4' },
}

const steps = [
  { title: 'You ask', detail: 'A request from the panel or an inline edit.', path: 'M200 240 C 240 220, 250 150, 285 140', at: [232, 178], focus: ['you', 'context'] },
  { title: 'Anvil picks context', detail: 'Every file ranked on your machine in about 6 ms.', path: 'M555 140 C 600 140, 610 170, 640 180', at: [598, 128], focus: ['context', 'forge'] },
  { title: 'TrueForge runs the model', detail: 'The first healthy model in your chain answers.', path: 'M810 220 C 830 210, 840 210, 860 220', at: [826, 196], focus: ['forge', 'models'] },
  { title: 'The model uses tools', detail: 'Search, read, edit and run, served by Anvil over MCP.', path: 'M640 330 C 610 350, 600 370, 555 375', at: [596, 395], focus: ['forge', 'tools'] },
  { title: 'Edits become a review', detail: 'Nothing is written until you keep it.', path: 'M420 331 C 430 320, 430 312, 420 301', at: [440, 322], focus: ['tools', 'review'] },
  { title: 'You decide', detail: 'Your choice goes back to the model as its next step.', path: 'M285 257 C 250 262, 230 262, 200 262', at: [212, 288], focus: ['review', 'you'] },
] as const

export default function Architecture() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || paused) return
    const id = window.setInterval(() => setActive((value) => (value + 1) % steps.length), 2600)
    return () => window.clearInterval(id)
  }, [visible, paused])

  const step = steps[active]
  const on = (key: string) => (step.focus as readonly string[]).includes(key)

  return (
    <Section id="how" title="How it fits together." description="TrueForge runs the agent. Anvil gives it context, tools and your judgement." className="bg-gray-50/80">
      <Reveal>
        <div ref={ref} onMouseLeave={() => setPaused(false)} className="rounded-[1.75rem] border border-gray-200/70 bg-white p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] sm:p-8">
          <div className="overflow-x-auto">
            <svg viewBox="0 0 1000 500" className="min-w-[640px]" role="img" aria-label="Anvil architecture: you, Anvil, TrueForge and models">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10" fill="none" stroke={ember} strokeWidth="1.8" />
                </marker>
              </defs>
              <Sketch box={boxes.you} seed={1} active={on('you')}>
                {label(52, 245, 'You')}
                {label(52, 275, 'VS Code', 20, 500, '#6b7280')}
              </Sketch>
              <Sketch box={boxes.anvil} seed={2} active={false}>
                {label(282, 76, 'Anvil, on your machine', 26, 700, ember)}
              </Sketch>
              <Sketch box={boxes.context} seed={3} active={on('context')}>
                {label(305, 132, 'Context engine')}
                {label(305, 162, 'ranks every file', 20, 500, '#6b7280')}
              </Sketch>
              <Sketch box={boxes.review} seed={4} active={on('review')}>
                {label(305, 250, 'Review')}
                {label(305, 280, 'every edit, hunk by hunk', 20, 500, '#6b7280')}
              </Sketch>
              <Sketch box={boxes.tools} seed={5} active={on('tools')}>
                {label(305, 368, 'Tool server (MCP)')}
                {label(305, 398, 'search · read · edit · run', 20, 500, '#6b7280')}
              </Sketch>
              <Sketch box={boxes.forge} seed={6} active={on('forge')}>
                {label(660, 160, 'TrueForge', 28, 700, '#4338ca')}
                {['agent loop', 'sessions', 'approvals', 'subagents'].map((text, i) => label(662, 205 + i * 34, text, 21, 500, '#4b5563'))}
              </Sketch>
              <Sketch box={boxes.models} seed={7} active={on('models')}>
                {label(878, 160, 'Models', 26, 700, '#15803d')}
                {['Claude', 'GPT', 'Ollama'].map((text, i) => label(880, 210 + i * 46, text, 21, 500, '#4b5563'))}
                <path d="M905 218 L905 236 M905 264 L905 282" stroke="#15803d" strokeWidth="1.4" strokeDasharray="3 3" />
              </Sketch>
              {steps.map((item, i) => (
                <g key={item.title} opacity={i === active ? 1 : 0.18}>
                  <path d={item.path} fill="none" stroke={ember} strokeWidth={i === active ? 2.6 : 1.8} strokeLinecap="round" markerEnd="url(#arrow)" />
                  <circle cx={item.at[0]} cy={item.at[1]} r="13" fill={i === active ? ember : '#fff'} stroke={ember} strokeWidth="1.6" />
                  <text x={item.at[0]} y={item.at[1] + 6} textAnchor="middle" fontFamily={hand} fontSize="20" fontWeight="700" fill={i === active ? '#fff' : ember}>
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <ol className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((item, i) => (
              <li key={item.title}>
                <button
                  onMouseEnter={() => {
                    setPaused(true)
                    setActive(i)
                  }}
                  onFocus={() => {
                    setPaused(true)
                    setActive(i)
                  }}
                  onClick={() => setActive(i)}
                  className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${i === active ? 'bg-ember-50' : 'hover:bg-gray-50'}`}
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${i === active ? 'bg-ember-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{item.title}</span>
                    <span className="block text-sm leading-snug text-gray-500">{item.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
      <Reveal className="mt-8 text-center">
        <Link to="/docs/architecture" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline">
          Read the architecture
          <Icon name="arrow" size={15} />
        </Link>
      </Reveal>
    </Section>
  )
}
