import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../motion'

type Stat = { value: number; decimals: number; suffix: string; label: string; description: string; aspect: string; visual: React.ReactNode }

const stats: Stat[] = [
  {
    value: 1, decimals: 2, suffix: '', label: 'recall@5 on Flask',
    description: 'Every right file lands in the top five across 12 hand-labelled tasks. BM25 alone gets 0.71.',
    aspect: 'aspect-[2/3]', visual: <RankVisual />,
  },
  {
    value: 97.5, decimals: 1, suffix: '%', label: 'Edits that land',
    description: 'A matcher cascade (exact → whitespace → indentation → fuzzy) recovers sloppy model edits. Plain search/replace: 15.2%.',
    aspect: 'aspect-[2/3]', visual: <CascadeVisual />,
  },
  {
    value: 4.2, decimals: 1, suffix: 'k', label: 'Tokens per context pack',
    description: 'Ranked slices and a repo map instead of ~38k tokens of whole files.',
    aspect: 'aspect-square', visual: <TokenVisual />,
  },
  {
    value: 0, decimals: 0, suffix: '/60', label: 'Wrong-location edits',
    description: 'Fuzzy matching refuses to guess between near-identical functions.',
    aspect: 'aspect-square', visual: <TargetVisual />,
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
        if (!el) return
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
            We don't just generate.<br />
            <span className="text-gray-400">We measure.</span>
          </h2>
          <p className="text-lg text-gray-600 font-medium max-w-sm md:text-right">
            Numbers from reproducible benchmarks on Flask 3.1.3. Run them yourself with <code className="whitespace-nowrap font-mono text-sm bg-white px-1.5 py-0.5 rounded border border-gray-200">npm run bench</code>.
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
          {stats.map((s, i) => (
            <div key={s.label} ref={(el) => { cardsRef.current[i] = el }} className="flex flex-col gap-5 group">
              <div className={`w-full rounded-[2rem] ${s.aspect} bg-white shadow-sm border border-gray-100 overflow-hidden relative transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-xl`}>
                {s.visual}
              </div>
              <div className="px-2">
                <div className="text-4xl md:text-5xl font-heading font-extrabold text-black mb-2 tracking-tighter tabular-nums">
                  <span ref={(el) => { numsRef.current[i] = el }}>{s.value.toFixed(s.decimals)}</span>{s.suffix}
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

/* ---------- small decorative visuals inside the stat cards ---------- */

function RankVisual() {
  const rows = [
    ['cli.py', 'target', 96], ['test_cli.py', 'test', 88], ['cli.rst', 'docs', 74],
    ['app.py', 'related', 52], ['helpers.py', 'related', 41], ['config.py', 'reference', 22],
  ] as const
  return (
    <div className="absolute inset-0 p-6 flex flex-col justify-center gap-3 bg-gradient-to-b from-white to-gray-50">
      {rows.map(([f, role, w], i) => (
        <div key={f} className="text-[11px] font-mono">
          <div className="flex justify-between text-gray-500 mb-1"><span className="text-gray-800">{f}</span><span>{role}</span></div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full origin-left transition-transform duration-700 group-hover:scale-x-100 ${i < 5 ? 'bg-gray-900' : 'bg-gray-300'}`}
              style={{ width: `${w}%`, transform: 'scaleX(.85)', transitionDelay: `${i * 60}ms` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CascadeVisual() {
  const stages = ['exact', 'whitespace', 'indentation', 'fuzzy']
  return (
    <div className="absolute inset-0 p-6 flex flex-col justify-center items-center gap-3 bg-gradient-to-b from-white to-ember-50/60">
      {stages.map((s, i) => (
        <div key={s} className="w-full flex flex-col items-center">
          <div className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm flex justify-between transition-transform duration-500 group-hover:translate-x-1"
            style={{ transitionDelay: `${i * 70}ms` }}>
            <span>{s}</span><span className="text-gray-400 font-mono text-xs">{i + 1}</span>
          </div>
          {i < stages.length - 1 && <div className="h-3 w-px bg-gray-300" />}
        </div>
      ))}
      <div className="mt-1 text-xs font-semibold text-ember-600">198 perturbed edits</div>
    </div>
  )
}

function TokenVisual() {
  return (
    <div className="absolute inset-0 p-6 flex items-end justify-center gap-6 bg-gradient-to-b from-white to-gray-50">
      <div className="flex flex-col items-center gap-2 w-16">
        <div className="w-full rounded-t-xl bg-gray-900 h-[22px] transition-all duration-700 group-hover:h-[28px]" />
        <span className="text-[11px] font-mono text-gray-600">Anvil</span>
      </div>
      <div className="flex flex-col items-center gap-2 w-16">
        <div className="w-full rounded-t-xl bg-gray-200 h-[150px] transition-all duration-700 group-hover:h-[160px]" />
        <span className="text-[11px] font-mono text-gray-400">top-8 files</span>
      </div>
    </div>
  )
}

function TargetVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
      {[140, 100, 60].map((s, i) => (
        <div key={s} className="absolute rounded-full border border-gray-200 transition-transform duration-700 group-hover:scale-110"
          style={{ width: s, height: s, transitionDelay: `${i * 80}ms` }} />
      ))}
      <div className="w-4 h-4 rounded-full bg-ember-500 shadow-[0_0_0_6px_rgba(249,115,22,0.15)]" />
    </div>
  )
}
