import type { ReactNode } from 'react'
import type { CursorKey, Shot } from './anim'

export type Chapter = { id: string; from: number; to: number; label: string; title: string; body: string }

export type Film = {
  id: string
  duration: number
  chapters: Chapter[]
  camera: Shot[]
  cursor: CursorKey[]
  render: (t: number) => ReactNode
}
