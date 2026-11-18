import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../motion'

type Stat = {
  value: number; decimals: number; prefix?: string; suffix: string
  label: string; before: string; description: string; aspect: string; visual: React.ReactNode
}

// Every number below is from docs/benchmarks/agent-mode.md ("By harness trait"):
// 7 models whose provider answered × 2 runs per build = 14 Task B runs per build.
const stats: Stat[] = [
  {
    value: 0, decimals: 0, suffix: '/14', label: 'Runs that stopped with untested edits',
    before: 'Before: 11/14',
    description: 'The agent changed code and ended the turn without running a single check after its last edit.',
    aspect: 'aspect-[2/3]', visual: <DotsVisual before={11} after={0} tone="bad" />,
  },
  {
    value: 10, decimals: 0, suffix: '/14', label: '“Done” backed by a passing check',
    before: 'Before: 0/14 (no mechanism)',
    description: 'A completion gate only accepts “verified” if a command ran and passed after the last accepted edit. Every passing run finished this way.',
    aspect: 'aspect-[2/3]', visual: <DotsVisual before={0} after={10} tone="good" />,
  },
  {
    value: 0.3, decimals: 1, suffix: '', label: 'Failed test runs per Task B',
    before: 'Before: 3.1',
    description: 'Before, pytest kept failing for environment reasons (missing PYTHONPATH=src, a lowercase Windows drive letter) and models burned turns on it.',
    aspect: 'aspect-square', visual: <BarsVisual before={3.1} after={0.3} fmt={(v) => v.toFixed(1)} />,
  },
  {
    value: 27, decimals: 0, prefix: '−', suffix: '%', label: 'Input tokens per Task B',
    before: '193k → 141k',
    description: 'Fewer failing test loops and fewer file reads (5.2 → 4.3 read_file calls) mean less to send to the model.',
    aspect: 'aspect-square', visual: <BarsVisual before={193} after={141} fmt={(v) => `${v}k`} />,
  },
]

export default function Stats() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const numsRef = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(headingRef.current, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, ease: 'power2.out',
        scrollTrigger: { trigger: headingRef.current, start: 'top 80%', end: 'top 50%', scrub: 1 },
      })

      const tl = gsap.timeline({ scrollTrigger: { trigger: gridRef.current, start: 'top 80%', end: 'center center', scrub: 2 } })
      tl.fromTo([cardsRef.current[0], cardsRef.current[1]], { opacity: 0, y: 60 }, { opacity: 1, y: 0, ease: 'none' })
      tl.fromTo([cardsRef.current[2], cardsRef.current[3]], { opacity: 0, x: 200 }, { opacity: 1, x: 0, stagger: 0.1, ease: 'elastic.out(1, 0.75)' }, '<')

      // Count-up numbers, once
      stats.forEach((s, i) => {
        const el = numsRef.current[i]
        if (!el || s.value === 0) return
        const obj = { v: 0 }
        gsap.to(obj, {
          v: s.value, duration: 1.6, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          onUpdate: () => { el.textContent = obj.v.toFixed(s.decimals) },
        })
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="py-24 md:py-32 relative bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center md:text-left mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <h2 ref={headingRef} className="text-4xl md:text-5xl lg:text-7xl font-heading font-bold text-gray-900 tracking-tighter max-w-2xl leading-[1.1]">
            Same models.<br />
            <span className="text-gray-400">Better behaviour.</span>
          </h2>
          <p className="text-lg text-gray-600 font-medium max-w-sm md:text-right">
            Before = branch <code className="font-mono text-sm bg-white px-1.5 py-0.5 rounded border border-gray-200">main</code>, after = the agent-mode work.
            The same end-to-end suite drove both builds on Flask 3.1.3: 7 models, 2 runs each, 14 runs per build.
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
          {stats.map((s, i) => (
            <div key={s.label} ref={(el) => { cardsRef.current[i] = el }} className="flex flex-col gap-5 group">
              <div className={`w-full rounded-[2rem] ${s.aspect} bg-white shadow-sm border border-gray-100 overflow-hidden relative transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-xl`}>
                {s.visual}
              </div>
              <div className="px-2">
                <div className="flex items-baseline gap-3 flex-wrap mb-2">
                  <div className="text-4xl md:text-5xl font-heading font-extrabold text-black tracking-tighter tabular-nums">
                    {s.prefix}<span ref={(el) => { numsRef.current[i] = el }}>{s.value.toFixed(s.decimals)}</span>{s.suffix}
                  </div>
                  <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-500 tabular-nums">{s.before}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">{s.label}</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- small visuals inside the stat cards ---------- */

function DotsVisual({ before, after, tone }: { before: number; after: number; tone: 'good' | 'bad' }) {
  const on = tone === 'good' ? 'bg-emerald-500' : 'bg-ember-500'
  const row = (n: number, label: string, dim: boolean) => (
    <div>
      <div className="flex justify-between text-[11px] font-mono text-gray-500 mb-2">
        <span className={dim ? 'text-gray-400' : 'text-gray-900 font-semibold'}>{label}</span>
        <span>{n}/14</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className={`aspect-square rounded-full transition-transform duration-500 group-hover:scale-110 ${i < n ? (dim ? 'bg-gray-400' : on) : 'bg-gray-100'}`}
            style={{ transitionDelay: `${i * 25}ms` }} />
        ))}
      </div>
    </div>
  )
  return (
    <div className="absolute inset-0 p-6 flex flex-col justify-center gap-8 bg-gradient-to-b from-white to-gray-50">
      {row(before, 'before · main', true)}
      {row(after, 'after · branch', false)}
      <p className="text-[11px] text-gray-400 text-center">one dot = one Task B run</p>
    </div>
  )
}

function BarsVisual({ before, after, fmt }: { before: number; after: number; fmt: (v: number) => string }) {
  const max = Math.max(before, after)
  const h = (v: number) => `${Math.max(4, (v / max) * 150)}px`
  return (
    <div className="absolute inset-0 p-6 flex items-end justify-center gap-6 bg-gradient-to-b from-white to-gray-50">
      <div className="flex flex-col items-center gap-2 w-16">
        <span className="text-[11px] font-mono text-gray-400">{fmt(before)}</span>
        <div className="w-full rounded-t-xl bg-gray-200 transition-all duration-700" style={{ height: h(before) }} />
        <span className="text-[11px] font-mono text-gray-400">before</span>
      </div>
      <div className="flex flex-col items-center gap-2 w-16">
        <span className="text-[11px] font-mono text-gray-900 font-semibold">{fmt(after)}</span>
        <div className="w-full rounded-t-xl bg-gray-900 transition-all duration-700" style={{ height: h(after) }} />
        <span className="text-[11px] font-mono text-gray-600">after</span>
      </div>
    </div>
  )
}
