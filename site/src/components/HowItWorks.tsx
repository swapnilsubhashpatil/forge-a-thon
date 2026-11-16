import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../motion'

type Step = { k: string; title: string; body: string; panel: { title: string; lines: [string, string?][] } }

// Each panel line: [text, tone] where tone is a tailwind text colour class
const steps: Step[] = [
  {
    k: '01', title: 'Rank the repo, locally',
    body: 'Before each turn Anvil scores every tracked file: @mentions, path segments, BM25 over symbols and docstrings, sibling symbols, test/docs companions, git co-change and personalised PageRank over the import graph. Project rules (AGENTS.md, CLAUDE.md…) go on top. No embeddings, no extra model calls.',
    panel: { title: 'context-pack', lines: [
      ['$ anvil rank "add a config command"', 'text-gray-400'],
      ['  src/flask/cli.py          target   siblings: routes_command', 'text-gray-200'],
      ['  tests/test_cli.py         test     companion of cli.py', 'text-gray-200'],
      ['  docs/cli.rst              docs     companion of cli.py', 'text-gray-200'],
      ['  src/flask/config.py       reference  content words only', 'text-gray-500'],
      ['  Verify with (likely): python -m pytest tests/test_cli.py -q', 'text-emerald-300'],
      ['  pack ≤ 6,000 tokens · repo map + slices', 'text-amber-300'],
    ] },
  },
  {
    k: '02', title: 'TrueForge runs the loop',
    body: 'Every conversation is a TrueForge session built from an inline agent spec. The model comes from your fallback chain at run time, so a session can switch models without losing history. Tokens stream live; Stop cancels the turn and leaves the workspace clean.',
    panel: { title: 'agents/anvil-agent.json', lines: [
      ['{', 'text-gray-400'],
      ['  "model": "${chain[0]}",', 'text-gray-200'],
      ['  "subagents": true,', 'text-gray-200'],
      ['  "compaction": { "trigger_tokens": 60000 },', 'text-gray-200'],
      ['  "mcp_servers": ["anvil-editor"],', 'text-gray-200'],
      ['  "require_approval_for_tools": [', 'text-amber-300'],
      ['    "propose_edit", "create_file", "run_command"', 'text-amber-300'],
      ['  ]', 'text-amber-300'],
      ['}', 'text-gray-400'],
    ] },
  },
  {
    k: '03', title: 'Editor actions are MCP tools',
    body: 'The extension serves a Streamable HTTP MCP server on loopback with a bearer token that rotates every start. Reads are annotated readOnlyHint, run_command is destructiveHint, so the harness knows exactly what needs a human.',
    panel: { title: 'POST 127.0.0.1:<port>/mcp', lines: [
      ['repo_map          readOnly', 'text-gray-300'],
      ['search_code       readOnly   ripgrep', 'text-gray-300'],
      ['find_symbol       readOnly', 'text-gray-300'],
      ['find_references   readOnly', 'text-gray-300'],
      ['read_file         readOnly   stub on repeat reads', 'text-gray-300'],
      ['propose_edit      approval', 'text-amber-300'],
      ['create_file       approval', 'text-amber-300'],
      ['run_command       destructive', 'text-rose-300'],
    ] },
  },
  {
    k: '04', title: 'Approval becomes review',
    body: 'On tool.approval_required Anvil applies old_string → new_string in memory and opens a per-hunk review in the editor. Accept some hunks and the rest go back to the model as a rejected patch. Reject everything and the model reads why.',
    panel: { title: 'event stream', lines: [
      ['← tool.approval_required  propose_edit(cli.py)', 'text-gray-300'],
      ['  review: 3 hunks', 'text-gray-400'],
      ['  ✓ hunk 1   ✓ hunk 2   ✗ hunk 3', 'text-gray-200'],
      ['→ allow  applied=[1,2] rejected_patch=@@ -88,4 +88,6 @@', 'text-emerald-300'],
      ['← subscribeToTurn(afterEventId)  resumed', 'text-gray-400'],
      ['  undo set #7 recorded (3 files)', 'text-amber-300'],
    ] },
  },
  {
    k: '05', title: 'Prove it, then finish',
    body: 'The agent ends by calling finish_task. A “verified” claim is rejected unless a command ran after the last accepted edit; a turn that stops with edits and no finish gets one follow-up. The change set shows a green or amber chip, so you know whether “done” was tested.',
    panel: { title: 'finish_task', lines: [
      ['→ propose_edit(cli.py)        accepted', 'text-gray-300'],
      ['→ run_command  python -m pytest tests/test_cli.py -q', 'text-gray-300'],
      ['  exit 0 · tests passed · wall time', 'text-emerald-300'],
      ['→ finish_task { verified: true }', 'text-gray-200'],
      ['  ✓ gate: a check ran after the last accepted edit', 'text-emerald-300'],
      ['', ''],
      ['  chip: verified: <command> passed', 'text-amber-300'],
    ] },
  },
  {
    k: '06', title: 'Fail over, out loud',
    body: 'Errors (or 45 s without output) are classified: auth, not-found, rate-limit, unavailable, timeout, context. Rate limits and 5xx get one jittered retry, then the circuit breaker opens for 60 s and the next model in the chain reruns the same request. Hitting the step limit is not a model failure: it gets a wrap-up turn instead.',
    panel: { title: 'anvil.models.chain', lines: [
      ['1  broken/unreachable           ✗ unavailable (ECONNREFUSED)', 'text-rose-300'],
      ['   breaker open · 60s', 'text-gray-500'],
      ['2  anthropic/claude-sonnet-5-5  ✓ took over', 'text-emerald-300'],
      ['3  ollama/qwen3-8b              standby', 'text-gray-400'],
      ['', ''],
      ['git status → clean until you accept', 'text-amber-300'],
    ] },
  },
]

export default function HowItWorks() {
  const [active, setActive] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!sectionRef.current) return
    const ctx = gsap.context(() => {
      stepRefs.current.forEach((el, i) => {
        if (!el) return
        ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => s.isActive && setActive(i) })
      })
      if (!prefersReducedMotion()) {
        gsap.fromTo(railRef.current, { scaleY: 0 }, {
          scaleY: 1, ease: 'none',
          scrollTrigger: { trigger: stepRefs.current[0], endTrigger: stepRefs.current[steps.length - 1], start: 'top 55%', end: 'bottom 55%', scrub: true },
        })
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section id="how" ref={sectionRef} className="py-24 md:py-32 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-16 md:mb-24 gap-6">
          <div>
            <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">How it works</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter">
              From prompt to reviewed diff.
            </h3>
          </div>
          <p className="max-w-sm text-lg text-gray-500">TrueForge owns the agent loop. Anvil supplies context, tools and the review surface.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Steps */}
          <div className="relative min-w-0">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-200 hidden sm:block" />
            <div ref={railRef} className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-900 origin-top hidden sm:block" />
            <div className="flex flex-col gap-10 lg:gap-0">
              {steps.map((s, i) => (
                <div key={s.k} ref={(el) => { stepRefs.current[i] = el }} className="relative min-w-0 sm:pl-16 lg:min-h-[60vh] lg:flex lg:flex-col lg:justify-center">
                  <div className={`hidden sm:flex absolute left-0 top-0 lg:top-1/2 lg:-translate-y-1/2 w-10 h-10 rounded-full items-center justify-center text-xs font-bold border transition-all duration-500 ${
                    active === i ? 'bg-gray-900 text-white border-gray-900 scale-110 shadow-lg' : 'bg-white text-gray-400 border-gray-200'
                  }`}>
                    {s.k}
                  </div>
                  <div className={`transition-opacity duration-500 ${active === i ? 'lg:opacity-100' : 'lg:opacity-35'}`}>
                    <h4 className="text-2xl md:text-3xl font-bold text-gray-900 font-heading tracking-tight mb-3">{s.title}</h4>
                    <p className="text-gray-500 text-lg leading-relaxed">{s.body}</p>
                  </div>
                  <div className="lg:hidden mt-6 min-w-0"><Panel step={s} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky visual (desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-[20vh]">
              <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                  <Panel step={steps[active]} big />
                </motion.div>
              </AnimatePresence>
              <div className="mt-6 flex gap-2 justify-center">
                {steps.map((s, i) => (
                  <span key={s.k} className={`h-1.5 rounded-full transition-all duration-500 ${active === i ? 'w-8 bg-gray-900' : 'w-1.5 bg-gray-300'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Panel({ step, big }: { step: Step; big?: boolean }) {
  return (
    <div className={`rounded-[2rem] bg-[#141414] p-2 shadow-2xl ring-1 ring-black/10 flex flex-col ${big ? 'min-h-[420px]' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-mono text-xs text-gray-500 truncate">{step.panel.title}</span>
        <span className="ml-auto font-mono text-xs text-gray-600">{step.k}/{String(steps.length).padStart(2, '0')}</span>
      </div>
      <div className="flex-1 rounded-[1.5rem] bg-black/40 px-5 py-6 font-mono text-[11px] sm:text-[13px] leading-7 overflow-x-auto">
        {step.panel.lines.map(([text, tone], i) => (
          <motion.div key={i} initial={big ? { opacity: 0, x: -6 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
            className={`whitespace-pre ${tone ?? ''}`}>
            {text || ' '}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
