import type { CursorKey, Shot } from './anim'

export const STAGE = { w: 1600, h: 1000 }
export const LOOP_S = 34

export const WIN = { x: 60, y: 48, w: 1480, h: 904 }
export const LAYOUT = {
  title: 32,
  activity: 48,
  explorer: 220,
  panel: 460,
  status: 24,
  tabs: 34,
  line: 24,
  gutter: 56,
}
export const EDITOR_X = WIN.x + LAYOUT.activity + LAYOUT.explorer
export const PANEL_X = WIN.x + WIN.w - LAYOUT.panel
export const CODE_TOP = WIN.y + LAYOUT.title + LAYOUT.tabs + 8

export type ChapterId = 'edit' | 'agent' | 'failover'

export const chapters: { id: ChapterId; from: number; to: number; label: string; title: string; body: string }[] = [
  {
    id: 'edit',
    from: 0,
    to: 11.5,
    label: 'Edit in place',
    title: 'Edit right where you are.',
    body: 'Select code, say what to change, and approve each line before it touches your file.',
  },
  {
    id: 'agent',
    from: 11.5,
    to: 24,
    label: 'Hand off a task',
    title: 'Hand off the whole task.',
    body: 'Anvil finds the files that matter, edits them, runs your tests and shows you the proof.',
  },
  {
    id: 'failover',
    from: 24,
    to: LOOP_S,
    label: 'Survive outages',
    title: 'Never stuck on one model.',
    body: 'If a model fails, the next one in your chain takes over and tells you why.',
  },
]

export const at = {
  selectFrom: 1.2,
  selectTo: 2.0,
  toolbar: 2.1,
  editClick: 3.7,
  boxOpen: 3.9,
  instruction: 4.4,
  submit: 6.2,
  hunks: 7.3,
  acceptClick: 8.6,
  boxClose: 10.3,
  composerClick: 12.2,
  prompt: 12.5,
  send: 14.4,
  context: 15.2,
  steps: [16.0, 16.6, 17.4, 18.2, 18.8, 19.5] as const,
  answer: 20.3,
  tray: 20.8,
  keepClick: 22.1,
  newChat: 23.6,
  composer3: 24.6,
  prompt3: 24.9,
  send3: 26.5,
  thinking: 26.9,
  strike: 27.7,
  answer3: 29.1,
  reset: 32.4,
}

export const instruction = "Also treat 'off' and 'n' as false"
export const agentPrompt = 'Add a flask config command that prints the config as JSON and masks secrets'
export const askPrompt = 'Why does FLASK_DEBUG=off still enable debug mode?'

const wide = { x: 800, y: 500, zoom: 1 }
const editor = { x: 720, y: 420, zoom: 1.5 }
const panel = { x: 1300, y: 455, zoom: 1.4 }
const composer = { x: 1300, y: 760, zoom: 1.55 }
const contextFooter = { x: 1300, y: 205, zoom: 1.85 }
const marker = { x: 1300, y: 250, zoom: 1.8 }

export const camera: Shot[] = [
  { t: 0, ...wide },
  { t: 2.2, ...wide },
  { t: 3.5, ...editor },
  { t: 9.6, ...editor },
  { t: 11.0, ...wide },
  { t: 11.9, ...wide },
  { t: 13.1, ...composer },
  { t: 14.6, ...composer },
  { t: 15.8, ...contextFooter, dip: 0.12 },
  { t: 17.3, ...contextFooter },
  { t: 18.5, ...panel },
  { t: 22.5, ...panel },
  { t: 23.7, ...wide },
  { t: 24.3, ...wide },
  { t: 25.4, ...composer },
  { t: 26.7, ...composer },
  { t: 27.9, ...marker, dip: 0.12 },
  { t: 30.4, ...marker },
  { t: 31.8, ...wide },
  { t: LOOP_S, ...wide },
]

export const focus = {
  editor: [[3.4, 9.8]] as [number, number][],
  panel: [[13.0, 22.6], [25.3, 30.6]] as [number, number][],
}

export const lineY = (i: number) => CODE_TOP + i * LAYOUT.line

export const cursor: CursorKey[] = [
  { t: 0, x: 980, y: 620, hidden: true },
  { t: 0.7, x: 980, y: 620 },
  { t: 1.15, x: 392, y: lineY(4) + 12 },
  { t: 1.2, x: 392, y: lineY(4) + 12, click: true },
  { t: 2.0, x: 1000, y: lineY(10) + 12 },
  { t: 3.3, x: 1000, y: lineY(10) + 12 },
  { t: 3.62, x: 410, y: lineY(3) + 11 },
  { t: 3.7, x: 410, y: lineY(3) + 11, click: true },
  { t: 4.2, x: 600, y: lineY(11) + 92 },
  { t: 6.1, x: 1004, y: lineY(11) + 100 },
  { t: 6.2, x: 1004, y: lineY(11) + 100, click: true },
  { t: 8.5, x: 980, y: lineY(11) + 22 },
  { t: 8.6, x: 980, y: lineY(11) + 22, click: true },
  { t: 9.4, x: 1040, y: 640, hidden: true },
  { t: 11.6, x: 1040, y: 640, hidden: true },
  { t: 12.1, x: 1240, y: 870 },
  { t: 12.2, x: 1240, y: 870, click: true },
  { t: 13.9, x: 1490, y: 905 },
  { t: 14.4, x: 1508, y: 905, click: true },
  { t: 15.0, x: 1520, y: 700, hidden: true },
  { t: 21.3, x: 1520, y: 700, hidden: true },
  { t: 21.95, x: 1418, y: 792 },
  { t: 22.1, x: 1418, y: 792, click: true },
  { t: 23.0, x: 1500, y: 620, hidden: true },
  { t: 24.2, x: 1500, y: 620, hidden: true },
  { t: 24.55, x: 1240, y: 870 },
  { t: 24.6, x: 1240, y: 870, click: true },
  { t: 26.2, x: 1490, y: 905 },
  { t: 26.5, x: 1508, y: 905, click: true },
  { t: 27.2, x: 1520, y: 640, hidden: true },
  { t: LOOP_S, x: 980, y: 620, hidden: true },
]
