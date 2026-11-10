import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../motion'
import { TextCursorInput, Bot, ScanSearch, ShieldCheck, Shuffle, Layers } from 'lucide-react'

const features = [
  { icon: TextCursorInput, title: 'Inline edit', tag: 'Ctrl+Alt+K',
    description: 'Select code, type an instruction, and red/green hunks appear in place with Accept / Reject CodeLens.' },
  { icon: Bot, title: 'Agent mode', tag: 'Side panel',
    description: 'One request drives TrueForge’s tool loop across the repo: search, symbols, read, edit, create and run, with live activity rows.' },
  { icon: ScanSearch, title: 'Context you can see', tag: 'Context card',
    description: 'Every turn opens with the files Anvil chose, why it chose them, and how much of the 6k-token budget they used.' },
  { icon: ShieldCheck, title: 'Diff safety', tag: 'Per-hunk review',
    description: 'Nothing reaches disk until you accept. Partial accepts return the rejected patch to the model. Undo a whole change set in one click.' },
  { icon: Shuffle, title: 'Model failover', tag: 'Circuit breaker',
    description: 'Errors are classified, rate limits retried with jittered backoff, and the next model in your chain takes over, with an on-screen reason.' },
  { icon: Layers, title: 'TrueForge native', tag: 'MCP + subagents',
    description: 'Inline agent specs, an MCP server with annotation-driven approvals, subagents, compaction, and a link to the session in TrueForge.' },
]

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(headingRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: headingRef.current, start: 'top 80%' } })
      gsap.fromTo(cardsRef.current, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out', scrollTrigger: { trigger: cardsRef.current[0], start: 'top 85%' } })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <section id="features" ref={sectionRef} className="py-24 md:py-32 relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div ref={headingRef} className="text-center mb-20 max-w-3xl mx-auto">
          <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">What Anvil does</h2>
          <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">
            An agent you can actually review.
          </h3>
          <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto">
            Fast edits are easy. Trustworthy ones need visible context, reviewable diffs and a plan for when the model falls over.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((f, i) => (
            <div
              key={f.title}
              ref={(el) => { cardsRef.current[i] = el }}
              onPointerMove={onMove}
              className="spotlight group bg-gray-50/50 rounded-[2rem] p-8 border border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col items-start"
            >
              <div className="flex w-full items-start justify-between mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 group-hover:shadow-md group-hover:-rotate-6 transition-all duration-300">
                  <f.icon className="w-8 h-8 text-black" strokeWidth={1.5} />
                </div>
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 group-hover:text-ember-600 group-hover:border-ember-100 transition-colors">
                  {f.tag}
                </span>
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3 font-heading tracking-tight">{f.title}</h4>
              <p className="text-base text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent -z-10" />
    </section>
  )
}
