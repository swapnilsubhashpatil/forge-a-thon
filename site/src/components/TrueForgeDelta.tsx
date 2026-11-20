import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE_OUT } from '../motion'
import { Icon, type IconName } from '../icons'
import { Link } from '../router'
import { Reveal, Section } from './Section'

const ember = '#f97316'
const ink = '#1f2937'
const hand = "'Caveat', cursive"

type Node = { area: string; icon: IconName; tf: string; anvil: string }

const left: Node[] = [
  { area: 'Finding code', icon: 'fileSearch', tf: 'Not included', anvil: 'Ranks every file and shows why' },
  { area: 'Model failure', icon: 'offline', tf: 'Retries the same model', anvil: 'Hands off to your next model' },
  { area: 'Stopping', icon: 'stop', tf: 'Waits for tools to finish', anvil: 'Kills commands, drops pending edits' },
  { area: 'Stuck agents', icon: 'repeat', tf: 'Not included', anvil: 'Nudge at 3 repeats, stop at 5' },
  { area: 'Review', icon: 'diff', tf: 'Allow or deny the whole call', anvil: 'Keep or reject each hunk' },
  { area: 'Saying “done”', icon: 'test', tf: 'Ends when the model stops', anvil: 'Only after a passing check' },
]

const right: Node[] = [
  { area: 'Typing mid-run', icon: 'message', tf: 'Cancels the running turn', anvil: 'Steers the running turn' },
  { area: 'Step limit', icon: 'clock', tf: 'Ends with a bare error', anvil: 'One wrap-up turn' },
  { area: 'Editor tools', icon: 'server', tf: 'Bring your own MCP server', anvil: 'Local MCP server, new key each start' },
  { area: 'Subagents', icon: 'layers', tf: 'Helpers can write files', anvil: 'Helpers are read-only' },
  { area: 'Compaction', icon: 'files', tf: 'At 80% of the window', anvil: 'Earlier, marked on the gauge' },
  { area: 'Tool loading', icon: 'plug', tf: 'Looked up on demand', anvil: 'Editor tools ready up front' },
]

const nodes = [...left, ...right]

const W = 1000
const H = 560
const NODE_W = 210
const rowY = (i: number) => 60 + i * 88
const CORE = { x: 395, y: 160, w: 210, h: 240 }

const jitter = (seed: number) => ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * 2.4

function rough(x: number, y: number, w: number, h: number, seed: number) {
  const j = (n: number) => jitter(seed + n)
  return `M${x + j(1)} ${y + j(2)} L${x + w + j(3)} ${y + j(4)} L${x + w + j(5)} ${y + h + j(6)} L${x + j(7)} ${y + h + j(8)} Z`
}

function beamPath(i: number) {
  const isLeft = i < left.length
  const row = i % left.length
  const y = rowY(row)
  const coreY = CORE.y + 40 + row * 32
  if (isLeft) {
    const x0 = 20 + NODE_W
    const x1 = CORE.x
    return `M ${x0} ${y} C ${x0 + 90} ${y + jitter(i) * 3}, ${x1 - 90} ${coreY}, ${x1} ${coreY}`
  }
  const x0 = W - 20 - NODE_W
  const x1 = CORE.x + CORE.w
  return `M ${x0} ${y} C ${x0 - 90} ${y + jitter(i) * 3}, ${x1 + 90} ${coreY}, ${x1} ${coreY}`
}

function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold })
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

function NodePill({ node, on, anvil, onPick }: { node: Node; on: boolean; anvil: boolean; onPick: () => void }) {
  return (
    <button
      onMouseEnter={onPick}
      onFocus={onPick}
      onClick={onPick}
      className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-all duration-500 ${
        anvil
          ? on
            ? 'bg-gray-900 text-white shadow-[0_14px_30px_-14px_rgba(234,88,12,0.55)]'
            : 'bg-white text-gray-900 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.4)] ring-1 ring-gray-200/80 hover:ring-gray-300'
          : 'border border-dashed border-gray-200 bg-transparent text-gray-300'
      }`}
    >
      <span className={`grid size-7 shrink-0 place-items-center rounded-lg transition-colors duration-500 ${anvil ? (on ? 'bg-ember-500 text-white' : 'bg-gray-100 text-gray-700') : 'text-gray-300'}`}>
        <Icon name={node.icon} size={15} />
      </span>
      <span className="truncate text-[13px] font-semibold">{node.area}</span>
    </button>
  )
}

function Beams() {
  const [anvil, setAnvil] = useState(false)
  const [touched, setTouched] = useState(false)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ref, inView] = useInView<HTMLDivElement>(0.35)

  useEffect(() => {
    if (!inView || touched) return
    const id = window.setTimeout(() => setAnvil(true), 1200)
    return () => window.clearTimeout(id)
  }, [inView, touched])

  useEffect(() => {
    if (!inView || paused || !anvil) return
    const id = window.setInterval(() => setActive((v) => (v + 1) % nodes.length), 2400)
    return () => window.clearInterval(id)
  }, [inView, paused, anvil])

  const pick = (i: number) => {
    setPaused(true)
    setActive(i)
  }
  const node = nodes[active]

  return (
    <div ref={ref} onMouseLeave={() => setPaused(false)}>
      <div className="mb-8 flex justify-center">
        <div role="tablist" aria-label="Compare" className="flex rounded-full bg-gray-100 p-1">
          {[
            { on: false, label: 'TrueForge alone' },
            { on: true, label: 'With Anvil' },
          ].map((item) => {
            const selected = anvil === item.on
            return (
              <button
                key={item.label}
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setTouched(true)
                  setAnvil(item.on)
                }}
                className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-colors ${selected ? (item.on ? 'text-white' : 'text-gray-900') : 'text-gray-500 hover:text-gray-900'}`}
              >
                {selected && <motion.span layoutId="delta-switch" className={`absolute inset-0 rounded-full ${item.on ? 'bg-gray-900' : 'bg-white shadow-sm'}`} transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
                <span className="relative">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative mx-auto hidden aspect-[1000/560] w-full md:block">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ember} stopOpacity="0.16" />
              <stop offset="100%" stopColor={ember} stopOpacity="0" />
            </radialGradient>
          </defs>
          <motion.circle cx={W / 2} cy={CORE.y + CORE.h / 2} r={230} fill="url(#core-glow)" initial={false} animate={{ opacity: anvil ? 1 : 0 }} transition={{ duration: 0.8 }} />
          {nodes.map((n, i) => {
            const d = beamPath(i)
            const on = anvil && i === active
            return (
              <g key={n.area}>
                <path d={d} fill="none" stroke={anvil ? '#d1d5db' : '#e5e7eb'} strokeWidth={1.4} strokeDasharray={anvil ? undefined : '4 7'} />
                {anvil && (
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={ember}
                    strokeWidth={on ? 3 : 1.8}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="0.16 0.84"
                    initial={{ strokeDashoffset: 1, opacity: 0 }}
                    animate={{ strokeDashoffset: [1, 0], opacity: on ? 1 : 0.4 }}
                    transition={{
                      strokeDashoffset: { duration: on ? 1.3 : 2.6, repeat: Infinity, ease: 'linear', delay: (i % 6) * 0.2 },
                      opacity: { duration: 0.4 },
                    }}
                  />
                )}
              </g>
            )
          })}
          <g>
            <path d={rough(CORE.x, CORE.y, CORE.w, CORE.h, 11)} fill={anvil ? '#fff7ed' : '#f9fafb'} stroke="none" style={{ transition: 'fill 0.5s' }} />
            <path d={rough(CORE.x, CORE.y, CORE.w, CORE.h, 11)} fill="none" stroke={anvil ? ember : '#9ca3af'} strokeWidth={anvil ? 2.4 : 1.6} strokeLinejoin="round" style={{ transition: 'stroke 0.5s' }} />
            <text x={CORE.x + 26} y={CORE.y + 52} fontFamily={hand} fontSize={34} fontWeight={700} fill={ink}>
              TrueForge
            </text>
            {['agent loop', 'sessions', 'approvals', 'streaming'].map((t, i) => (
              <text key={t} x={CORE.x + 28} y={CORE.y + 92 + i * 30} fontFamily={hand} fontSize={22} fontWeight={500} fill="#6b7280">
                {t}
              </text>
            ))}
            <motion.text
              x={CORE.x + 28}
              y={CORE.y + CORE.h - 18}
              fontFamily={hand}
              fontSize={24}
              fontWeight={700}
              fill={ember}
              initial={false}
              animate={{ opacity: anvil ? 1 : 0 }}
              transition={{ duration: 0.4, delay: anvil ? 0.4 : 0 }}
            >
              + 12 from Anvil
            </motion.text>
          </g>
        </svg>

        {nodes.map((n, i) => {
          const isLeft = i < left.length
          const row = i % left.length
          return (
            <motion.div
              key={n.area}
              className="absolute"
              style={{
                left: `${((isLeft ? 20 : W - 20 - NODE_W) / W) * 100}%`,
                top: `${((rowY(row) - 22) / H) * 100}%`,
                width: `${(NODE_W / W) * 100}%`,
              }}
              initial={false}
              animate={{ x: anvil ? 0 : isLeft ? -10 : 10, opacity: anvil ? 1 : 0.9 }}
              transition={{ duration: 0.5, delay: anvil ? row * 0.07 : 0, ease: EASE_OUT }}
            >
              <NodePill node={n} on={anvil && i === active} anvil={anvil} onPick={() => pick(i)} />
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 md:hidden">
        <div className={`col-span-2 mb-2 rounded-2xl p-4 text-center transition-colors ${anvil ? 'bg-ember-50 ring-2 ring-ember-400' : 'bg-gray-50 ring-1 ring-gray-200'}`}>
          <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: hand }}>
            TrueForge
          </p>
          <p className="text-xs text-gray-500">agent loop · sessions · approvals · streaming</p>
        </div>
        {nodes.map((n, i) => (
          <NodePill key={n.area} node={n} on={anvil && i === active} anvil={anvil} onPick={() => pick(i)} />
        ))}
      </div>

      <div className="mx-auto mt-6 min-h-[3rem] max-w-2xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${anvil}-${active}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-center sm:gap-3"
          >
            <span className="text-sm font-semibold text-gray-900">{node.area}</span>
            <span className={`text-sm ${anvil ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-500'}`}>{node.tf}</span>
            {anvil && (
              <>
                <Icon name="arrow" size={14} className="hidden text-ember-500 sm:block" />
                <span className="text-sm font-semibold text-ember-600">{node.anvil}</span>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function TrueForgeDelta() {
  return (
    <Section id="adds" title="What Anvil adds to TrueForge." description="TrueForge runs the loop. Flip the switch and watch what plugs into it.">
      <Reveal>
        <Beams />
      </Reveal>
      <Reveal className="mt-8 text-center">
        <Link to="/docs/benchmarks" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline">
          Every difference, in detail
          <Icon name="arrow" size={15} />
        </Link>
      </Reveal>
    </Section>
  )
}
