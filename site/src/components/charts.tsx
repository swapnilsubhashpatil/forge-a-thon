import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { EASE_OUT } from '../motion'

/* Shared chart + disclosure primitives for the results sections.
   Colour code everywhere: after / Anvil = ember, before = gray-400, baseline = gray-200. */

export const AFTER = 'bg-ember-500'
export const BEFORE = 'bg-gray-400'
export const BASE = 'bg-gray-200'

/** "+ How it works" toggle with a short expandable panel. */
export function Disclosure({ label = 'How it works', children, className = '' }: { label?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const reduce = useReducedMotion()
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors">
        <Plus className={`w-3.5 h-3.5 transition-transform duration-300 ${open ? 'rotate-45' : ''}`} strokeWidth={2.25} aria-hidden />
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} key="panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: EASE_OUT }}
            className="overflow-hidden">
            <div className="pt-3 text-sm text-gray-600 leading-relaxed space-y-2 max-w-3xl">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Section heading used by all results sections. */
export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-10 md:mb-14 max-w-3xl">
      <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">{eyebrow}</h2>
      <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-[1.05]">{title}</h3>
      {sub && <p className="mt-5 text-lg text-gray-500 max-w-2xl">{sub}</p>}
    </div>
  )
}

/** One-line user-flow example under a chart. Arrows are rendered in ember. */
export function Flow({ children }: { children: string }) {
  const parts = children.split('→')
  return (
    <p className="text-sm text-gray-600 leading-relaxed">
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <span className="text-ember-500 font-semibold" aria-hidden> → </span>}{i > 0 && <span className="sr-only"> then </span>}{p.trim()}</span>
      ))}
    </p>
  )
}

export function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-gray-500" aria-hidden>
      {items.map(([cls, l]) => (
        <span key={l} className="flex items-center gap-1.5"><i className={`w-2.5 h-2.5 rounded-full ${cls}`} />{l}</span>
      ))}
    </div>
  )
}

/** Animated horizontal bar. `pct` 0–100. */
export function Bar({ pct, cls, delay = 0, h = 'h-2.5' }: { pct: number; cls: string; delay?: number; h?: string }) {
  const reduce = useReducedMotion()
  const w = `${Math.max(pct, pct > 0 ? 1.5 : 0)}%`
  return (
    <div className={`${h} rounded-full bg-white border border-gray-100 overflow-hidden`}>
      <motion.div className={`h-full rounded-full ${cls}`}
        initial={{ width: reduce ? w : 0 }} whileInView={{ width: w }} viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: reduce ? 0 : 1, delay: reduce ? 0 : delay, ease: EASE_OUT }} />
    </div>
  )
}

/** Before → after as two stacked bars with values. `before` null = not measured. */
export function PairBars({ label, sub, before, after, max, fmt, delay = 0, dim = false }: {
  label: ReactNode; sub?: ReactNode; before: number | null; after: number; max: number; fmt: (v: number) => string; delay?: number; dim?: boolean
}) {
  const pct = (v: number) => (max === 0 ? 0 : (v / max) * 100)
  return (
    <div role="img" aria-label={`${typeof label === 'string' ? label : ''}: before ${before === null ? 'not measured' : fmt(before)}, after ${fmt(after)}`}
      className={dim ? 'opacity-55' : ''}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm font-semibold text-gray-900 leading-tight">{label}{sub && <span className="block text-[11px] font-medium text-gray-400">{sub}</span>}</span>
        <span className="font-mono text-sm tabular-nums whitespace-nowrap">
          <span className="text-gray-400">{before === null ? 'n/a' : fmt(before)}</span>
          <span className="text-gray-300"> → </span>
          <b className="text-gray-900">{fmt(after)}</b>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <Bar pct={before === null ? 0 : pct(before)} cls={BEFORE} delay={delay} h="h-2" />
        <Bar pct={pct(after)} cls={AFTER} delay={delay + 0.15} h="h-2" />
      </div>
    </div>
  )
}

/** Dumbbell: grey dot at before, ember dot slides to after. */
export function Dumbbell({ label, before, after, max, fmt, delay = 0 }: {
  label: string; before: number | null; after: number; max: number; fmt: (v: number) => string; delay?: number
}) {
  const reduce = useReducedMotion()
  const p = (v: number) => `${(v / max) * 100}%`
  const start = before ?? after
  const lo = Math.min(start, after), hi = Math.max(start, after)
  const same = before !== null && before === after
  return (
    <div role="img" aria-label={`${label}: before ${before === null ? 'not measured' : fmt(before)}, after ${fmt(after)}`}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-sm text-gray-700 leading-tight">{label}</span>
        <span className="font-mono text-sm tabular-nums whitespace-nowrap">
          <span className="text-gray-400">{before === null ? 'n/a' : fmt(before)}</span>
          <span className="text-gray-300"> → </span>
          <b className="text-gray-900">{fmt(after)}</b>
          {same && <span className="ml-1.5 text-[11px] font-sans text-gray-400">same</span>}
        </span>
      </div>
      <div className="relative h-5 mx-2" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200" />
        <motion.div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-ember-100"
          style={{ left: p(lo) }}
          initial={{ width: reduce ? `${((hi - lo) / max) * 100}%` : 0 }} whileInView={{ width: `${((hi - lo) / max) * 100}%` }}
          viewport={{ once: true }} transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : delay + 0.2, ease: EASE_OUT }} />
        {before !== null && !same && <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gray-300 ring-2 ring-white" style={{ left: p(before) }} />}
        <motion.span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-ember-500 ring-2 ring-white shadow"
          initial={{ left: reduce ? p(after) : p(start) }} whileInView={{ left: p(after) }}
          viewport={{ once: true }} transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : delay + 0.2, ease: EASE_OUT }} />
      </div>
    </div>
  )
}

/** 14 runs as dots, before row and after row. */
export function RunDots({ before, after, of = 14, tone }: { before: number; after: number; of?: number; tone: 'good' | 'bad' }) {
  const reduce = useReducedMotion()
  const on = tone === 'good' ? 'bg-emerald-500' : 'bg-ember-500'
  const row = (n: number, label: string, isAfter: boolean) => (
    <div>
      <div className="flex justify-between text-[11px] font-mono mb-1.5">
        <span className={isAfter ? 'text-gray-900 font-semibold' : 'text-gray-400'}>{label}</span>
        <span className={isAfter ? 'text-gray-900 font-semibold' : 'text-gray-400'}>{n}/{of}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: of }, (_, i) => (
          <motion.span key={i} className={`aspect-square rounded-full ${i < n ? (isAfter ? on : 'bg-gray-400') : 'bg-gray-200/70'}`}
            initial={reduce ? false : { scale: 0.3, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }}
            transition={{ duration: 0.35, delay: reduce ? 0 : (isAfter ? 0.4 : 0) + i * 0.03 }} />
        ))}
      </div>
    </div>
  )
  return (
    <div role="img" aria-label={`Before ${before} of ${of} runs, after ${after} of ${of} runs`} className="flex flex-col gap-4">
      {row(before, 'before', false)}
      {row(after, 'after', true)}
    </div>
  )
}

export const card = 'rounded-[2rem] border border-gray-100 bg-gray-50/60 p-5 sm:p-8'
