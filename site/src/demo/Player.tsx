import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons'
import { cameraAt, cursorAt, easeInOut, easeOut, progress } from './anim'
import type { Chapter, Film } from './film'
import { STAGE } from './script'
import { tour } from './tour'

const NARROW = 720

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

const still = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("t") : null

function useClock(range: [number, number], playing: boolean) {
  const [t, setT] = useState(still ? Number(still) : range[0])
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (!playing) {
      last.current = null
      return
    }
    let frame = 0
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000
      last.current = now
      setT((value) => {
        const next = value + Math.min(dt, 0.1)
        return next >= range[1] ? range[0] + (next - range[1]) : next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, range[0], range[1]])
  return [t, setT] as const
}

function Cursor({ x, y, press, visible }: { x: number; y: number; press: number; visible: number }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${x}px, ${y}px)`, opacity: visible, pointerEvents: 'none', zIndex: 20 }}>
      <span style={{ position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: 22, background: 'rgba(253, 186, 116, 0.55)', opacity: press, transform: `scale(${0.4 + 0.8 * press})` }} />
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: `scale(${1 - 0.12 * press})`, transformOrigin: '4px 3px', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
        <path d="M5.5 3.2V19.8L10.3 15L13.1 21L15.9 19.8L13.1 13.8H18.3L5.5 3.2Z" fill="#111" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function Caption({ t, chapter, size }: { t: number; chapter: Chapter; size: 'stage' | 'page' }) {
  const u = t - chapter.from
  const dur = chapter.to - chapter.from
  const out = progress(u, dur - 0.55, 0.4, easeInOut)
  const title = progress(u, 0.15, 0.6)
  const stage = size === 'stage'
  return (
    <div style={{ opacity: 1 - out, filter: out > 0 ? `blur(${4 * out}px)` : undefined }}>
      <div style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 600, letterSpacing: '-0.03em', fontSize: stage ? 46 : 20, lineHeight: 1.15, color: stage ? '#fff' : '#111827', opacity: title, transform: `translateY(${(stage ? 18 : 6) * (1 - title)}px)` }}>
        {chapter.title}
      </div>
      <div style={{ marginTop: stage ? 12 : 4, fontSize: stage ? 24 : 15, lineHeight: 1.45, color: stage ? 'rgba(255,255,255,0.78)' : '#4b5563', maxWidth: stage ? 1080 : undefined }}>
        {chapter.body.split(' ').map((word, i) => {
          const e = progress(u, 0.35 + i * 0.045, 0.5, easeOut)
          return (
            <span key={i} style={{ display: 'inline-block', marginRight: '0.28em', opacity: e, transform: `translateY(${10 * (1 - e)}px)`, filter: e < 1 ? `blur(${5 * (1 - e)}px)` : undefined }}>
              {word}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function DemoPlayer({ film = tour, only, label = 'Product demo' }: { film?: Film; only?: string; label?: string }) {
  const { chapters } = film
  const { ref, width } = useWidth()
  const scope = only ? chapters.find((c) => c.id === only)! : undefined
  const range: [number, number] = scope ? [scope.from, scope.to] : [0, film.duration]
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [userPaused, setUserPaused] = useState(reduced)
  const [visible, setVisible] = useState(false)
  const [t, setT] = useClock(range, visible && !userPaused && !still)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  const narrow = width > 0 && width < NARROW
  const scale = width / STAGE.w
  const cam = cameraAt(film.camera, t)
  const zoom = cam.zoom * (narrow ? 1.75 : 1)
  const half = { w: STAGE.w / 2 / zoom, h: STAGE.h / 2 / zoom }
  const cx = Math.min(Math.max(cam.x, half.w), STAGE.w - half.w)
  const cy = Math.min(Math.max(cam.y, half.h), STAGE.h - half.h)
  const pointer = cursorAt(film.cursor, t)
  const chapter = chapters.find((c) => t >= c.from && t < c.to) ?? chapters[0]

  return (
    <figure aria-label={label} className="w-full">
      <div ref={ref} className="relative w-full overflow-hidden rounded-2xl bg-[#36557f] shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)] ring-1 ring-black/5" style={{ height: STAGE.h * scale }}>
        {width > 0 && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: STAGE.w, height: STAGE.h, transform: `scale(${scale})`, transformOrigin: '0 0', textAlign: 'left' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: STAGE.w, height: STAGE.h, transform: `translate(${STAGE.w / 2 - cx * zoom}px, ${STAGE.h / 2 - cy * zoom}px) scale(${zoom})`, transformOrigin: '0 0' }}>
              {film.render(t)}
            </div>
            <Cursor x={(pointer.x - cx) * zoom + STAGE.w / 2} y={(pointer.y - cy) * zoom + STAGE.h / 2} press={pointer.press} visible={pointer.visible} />
            {!narrow && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, background: 'linear-gradient(to top, rgba(6,8,12,0.88) 0%, rgba(6,8,12,0.6) 45%, rgba(6,8,12,0) 100%)', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: 88, right: 88, bottom: 52, textAlign: 'left' }}>
                  <Caption t={t} chapter={chapter} size="stage" />
                </div>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setUserPaused((value) => !value)}
          aria-label={userPaused ? 'Play demo' : 'Pause demo'}
          className="absolute right-3 top-3 z-30 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
        >
          <Icon name={userPaused ? 'play' : 'pause'} size={16} />
        </button>
      </div>
      {narrow && (
        <div className="mt-4 min-h-24 px-1 text-left">
          <Caption t={t} chapter={chapter} size="page" />
        </div>
      )}
      {!only && chapters.length > 1 && (
        <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Demo chapters">
          {chapters.map((c) => {
            const active = c.id === chapter.id
            const fill = active ? (t - c.from) / (c.to - c.from) : t >= c.to ? 1 : 0
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setT(c.from)
                  setUserPaused(false)
                }}
                className={`group rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-white/60'}`}
              >
                <span className={`block text-sm font-semibold ${active ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-800'}`}>{c.label}</span>
                <span className="mt-2 block h-0.5 overflow-hidden rounded-full bg-gray-200">
                  <span className="block h-full rounded-full bg-ember-500" style={{ width: `${fill * 100}%` }} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </figure>
  )
}
