export type Ease = (x: number) => number

const bezier = (x1: number, y1: number, x2: number, y2: number): Ease => {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

export const easeInOut = bezier(0.65, 0, 0.35, 1)
export const easeOut = bezier(0.16, 1, 0.3, 1)
export const easeIn = bezier(0.4, 0, 1, 1)

export const progress = (t: number, start: number, duration: number, ease: Ease = easeOut) =>
  ease(Math.min(1, Math.max(0, (t - start) / duration)))

export const presence = (t: number, show: number, hide: number, inS = 0.4, outS = 0.22) =>
  t < hide ? progress(t, show, inS) : 1 - progress(t, hide, outS, easeIn)

export const typed = (t: number, start: number, text: string, cps = 26) =>
  text.slice(0, Math.max(0, Math.floor((t - start) * cps)))

export const enter = (p: number, rise = 12) => ({
  opacity: p,
  transform: `translateY(${rise * (1 - p)}px)`,
  filter: p < 1 ? `blur(${4 * (1 - p)}px)` : undefined,
})

export type Shot = { t: number; x: number; y: number; zoom: number; dip?: number }
export type CursorKey = { t: number; x: number; y: number; click?: boolean; hidden?: boolean }

const segment = <K extends { t: number }>(keys: K[], t: number) => {
  let i = 0
  while (i < keys.length - 1 && t >= keys[i + 1].t) i++
  const a = keys[i]
  const b = keys[Math.min(i + 1, keys.length - 1)]
  const span = b.t - a.t
  return { a, b, p: easeInOut(span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 1) }
}

export const cameraAt = (keys: Shot[], t: number) => {
  const { a, b, p } = segment(keys, t)
  const mix = (x: number, y: number) => x + (y - x) * p
  const dip = (b.dip ?? 0) * Math.sin(Math.PI * p)
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), zoom: mix(a.zoom, b.zoom) * (1 - dip) }
}

export const cursorAt = (keys: CursorKey[], t: number) => {
  const { a, b, p } = segment(keys, t)
  const last = keys.filter((k) => k.click && k.t <= t).pop()
  const press = last ? Math.max(0, 1 - Math.abs(t - last.t - 0.06) / 0.14) : 0
  const visible = a.hidden && b.hidden ? 0 : a.hidden ? p : b.hidden ? 1 - p : 1
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, press, visible }
}
