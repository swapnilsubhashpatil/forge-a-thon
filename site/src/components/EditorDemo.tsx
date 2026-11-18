import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, FileCode2, FlaskConical, BookOpen, Sparkles, X } from 'lucide-react'
import { prefersReducedMotion } from '../motion'

/**
 * Looping replay of Demo Task A: select get_debug_flag → Ctrl+Alt+K → instruction →
 * red/green hunk with Accept/Reject CodeLens → accept. Pure UI; no real model call.
 */
type Phase = 'idle' | 'select' | 'prompt' | 'stream' | 'diff' | 'accepted'
const ORDER: Phase[] = ['idle', 'select', 'prompt', 'stream', 'diff', 'accepted']
const DURATION: Record<Phase, number> = { idle: 1400, select: 1200, prompt: 2600, stream: 1600, diff: 2600, accepted: 2600 }
const INSTRUCTION = 'Treat FLASK_DEBUG=off as false'

const kw = 'text-[#c586c0]'
const fn = 'text-[#dcdcaa]'
const str = 'text-[#ce9178]'
const cmt = 'text-[#6a9955]'
const ty = 'text-[#4ec9b0]'

const contextFiles = [
  { icon: FileCode2, path: 'src/flask/helpers.py', role: 'target', reason: 'selection' },
  { icon: FileCode2, path: 'src/flask/cli.py', role: 'related', reason: 'imports get_debug_flag' },
  { icon: FlaskConical, path: 'tests/test_helpers.py', role: 'test', reason: 'companion test' },
  { icon: BookOpen, path: 'docs/config.rst', role: 'docs', reason: 'documents FLASK_DEBUG' },
]

export default function EditorDemo() {
  const [phase, setPhase] = useState<Phase>(prefersReducedMotion() ? 'diff' : 'idle')
  const [typed, setTyped] = useState(0)
  const [visible, setVisible] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  // Pause the loop when the demo is off screen
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (prefersReducedMotion() || !visible) return
    const t = setTimeout(() => {
      const next = ORDER[(ORDER.indexOf(phase) + 1) % ORDER.length]
      if (next === 'prompt') setTyped(0)
      setPhase(next)
    }, DURATION[phase])
    return () => clearTimeout(t)
  }, [phase, visible])

  useEffect(() => {
    if (phase !== 'prompt' || typed >= INSTRUCTION.length) return
    const t = setTimeout(() => setTyped((n) => n + 1), 55)
    return () => clearTimeout(t)
  }, [phase, typed])

  const selected = phase === 'select' || phase === 'prompt' || phase === 'stream'
  const showDiff = phase === 'diff'
  const done = phase === 'accepted'
  const budget = phase === 'idle' || phase === 'select' ? 0 : 4.2

  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl bg-[#1e1e1e] text-left shadow-inner ring-1 ring-black/40 font-mono text-[11px] sm:text-[13px] leading-6">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 h-9 bg-[#2a2a2a] border-b border-black/40">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-gray-400 font-sans text-xs">helpers.py — flask-3.1.3</span>
      </div>

      <div className="grid md:grid-cols-[1fr_300px]">
        {/* Editor */}
        <div className="relative py-4 min-h-[300px] sm:min-h-[340px]">
          <Line n={58}><span className={kw}>import</span> os</Line>
          <Line n={59} />
          <Line n={60} sel={selected}><span className={kw}>def</span> <span className={fn}>get_debug_flag</span>() -&gt; <span className={ty}>bool</span>:</Line>
          <Line n={61} sel={selected}>    <span className={cmt}>"""Get whether debug mode should be enabled</span></Line>
          <Line n={62} sel={selected}>    <span className={cmt}>from the FLASK_DEBUG environment variable."""</span></Line>
          <Line n={63} sel={selected}>    val = os.environ.<span className={fn}>get</span>(<span className={str}>"FLASK_DEBUG"</span>)</Line>

          <AnimatePresence initial={false}>
            {showDiff && (
              <motion.div key="lens" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="pl-[3.25rem] sm:pl-16 text-[10px] sm:text-[11px] font-sans text-gray-400 flex gap-3 overflow-hidden">
                <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" /> Accept</span>
                <span className="inline-flex items-center gap-1 text-rose-400"><X className="w-3 h-3" /> Reject</span>
                <span className="hidden sm:inline">hunk 1 of 1</span>
              </motion.div>
            )}
          </AnimatePresence>

          {showDiff ? (
            <>
              <Line n={64} tone="del">    <span className={kw}>return</span> <span className={fn}>bool</span>(val <span className={kw}>and</span> val.<span className={fn}>lower</span>() <span className={kw}>not in</span> {'{'}<span className={str}>"0"</span>, <span className={str}>"false"</span>, <span className={str}>"no"</span>{'}'})</Line>
              <Line n={64} tone="add">    <span className={kw}>return</span> <span className={fn}>bool</span>(val <span className={kw}>and</span> val.<span className={fn}>lower</span>() <span className={kw}>not in</span> {'{'}<span className={str}>"0"</span>, <span className={str}>"false"</span>, <span className={str}>"no"</span>, <span className={str}>"off"</span>{'}'})</Line>
            </>
          ) : (
            <Line n={64} sel={selected} flash={done}>
              {'    '}<span className={kw}>return</span> <span className={fn}>bool</span>(val <span className={kw}>and</span> val.<span className={fn}>lower</span>() <span className={kw}>not in</span> {'{'}<span className={str}>"0"</span>, <span className={str}>"false"</span>, <span className={str}>"no"</span>{done && <>, <span className={str}>"off"</span></>}{'}'})
            </Line>
          )}

          {/* Inline prompt (Ctrl+Alt+K) */}
          <AnimatePresence>
            {(phase === 'prompt' || phase === 'stream') && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mx-4 sm:ml-16 sm:mr-6 mt-3 rounded-lg border border-[#3c3c3c] bg-[#252526] shadow-xl font-sans"
              >
                <div className="flex items-center gap-2 px-3 py-2 text-gray-200">
                  <Sparkles className="w-3.5 h-3.5 text-ember-400 shrink-0" />
                  <span className="truncate">{INSTRUCTION.slice(0, typed)}</span>
                  {phase === 'prompt' && <span className="caret -ml-1 text-ember-400">▍</span>}
                  <kbd className="ml-auto hidden sm:inline text-[10px] text-gray-500 border border-gray-600 rounded px-1">⌘⌥K</kbd>
                </div>
                {phase === 'stream' && (
                  <div className="px-3 pb-2 text-[11px] text-gray-400 flex items-center gap-2">
                    <motion.span className="h-1 w-16 rounded bg-gradient-to-r from-ember-500/0 via-ember-400 to-ember-500/0"
                      animate={{ x: [-20, 40, -20] }} transition={{ repeat: Infinity, duration: 1.2 }} />
                    propose_edit → waiting for your review
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {done && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-4 right-4 font-sans text-[11px] sm:text-xs rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> 1 hunk applied · undo available
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Anvil side panel: Context card */}
        <aside className="hidden md:flex flex-col gap-3 border-l border-black/40 bg-[#181818] p-4 font-sans text-xs text-gray-300">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-widest text-[10px] text-gray-500">Anvil · Context</span>
            <span className="text-[10px] rounded-full bg-white/5 px-2 py-0.5 text-gray-400">claude-sonnet-5-5</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {contextFiles.map((f, i) => (
              <motion.li
                key={f.path}
                initial={false}
                animate={{ opacity: budget ? 1 : 0.25, x: budget ? 0 : 6 }}
                transition={{ delay: budget ? i * 0.12 : 0, duration: 0.35 }}
                className="rounded-md bg-white/[0.03] px-2 py-1.5"
              >
                <div className="flex items-center gap-1.5 text-gray-200">
                  <f.icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="truncate font-mono text-[11px]">{f.path}</span>
                </div>
                <div className="mt-0.5 pl-5 text-[10px] text-gray-500"><span className="text-ember-400">{f.role}</span> · {f.reason}</div>
              </motion.li>
            ))}
          </ul>
          <div className="mt-auto">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Token budget</span>
              <span className="font-mono">{budget ? '4.5k' : '0'} / 6k</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-ember-500 to-amber-300"
                initial={false} animate={{ width: `${(budget / 6) * 100}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Line({ n, children, sel, tone, flash }: { n: number; children?: React.ReactNode; sel?: boolean; tone?: 'add' | 'del'; flash?: boolean }) {
  const bg = tone === 'add' ? 'bg-emerald-500/15' : tone === 'del' ? 'bg-rose-500/15' : sel ? 'bg-[#264f78]/70' : ''
  const mark = tone === 'add' ? '+' : tone === 'del' ? '−' : ' '
  return (
    <motion.div
      layout="position"
      initial={tone ? { opacity: 0, x: -8 } : false}
      animate={flash ? { backgroundColor: ['rgba(16,185,129,0.25)', 'rgba(16,185,129,0)'] } : { opacity: 1, x: 0 }}
      transition={{ duration: flash ? 1.6 : 0.3 }}
      className={`flex whitespace-pre transition-colors duration-300 ${bg}`}
    >
      <span className="w-8 sm:w-10 shrink-0 text-right pr-3 text-[#6e7681] select-none">{n}</span>
      <span className={`w-4 shrink-0 select-none ${tone === 'add' ? 'text-emerald-400' : 'text-rose-400'}`}>{mark}</span>
      <span className="text-[#d4d4d4] pr-4 overflow-hidden text-ellipsis">{children}</span>
    </motion.div>
  )
}
