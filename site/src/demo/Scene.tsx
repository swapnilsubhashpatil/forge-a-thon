import type { CSSProperties, ReactNode } from 'react'
import { ANVIL_PATH, SPARK_PATH } from '../components/Logo'
import { Icon } from '../icons'
import { easeInOut, enter, presence, progress, typed } from './anim'
import { Code, cliAdded, cliAfter, cliLines, docMask, helpersBefore, helpersHunks } from './code'
import { CODE_TOP, EDITOR_X, LAYOUT, PANEL_X, WIN, agentPrompt, askPrompt, at, focus, instruction } from './script'

const C = {
  window: '#1f1f1f',
  side: '#181818',
  border: '#2b2b2b',
  text: '#cccccc',
  muted: '#8b8b8b',
  accent: '#e8833a',
  blue: '#4fa3e0',
  green: '#6cc08b',
  red: '#e06c6c',
  raised: '#262626',
}

const mono = "'IBM Plex Mono', ui-monospace, monospace"
const sans = "'IBM Plex Sans', system-ui, sans-serif"

const amount = (t: number, ranges: [number, number][], fade = 0.45) =>
  Math.max(0, ...ranges.map(([a, b]) => Math.min(progress(t, a, fade, easeInOut), 1 - progress(t, b - fade, fade, easeInOut))))

const grey = (a: number): CSSProperties => (a > 0 ? { filter: `grayscale(${a}) brightness(${1 - 0.42 * a})` } : {})

export const RESET = at.reset + 0.4

function AnvilMark({ size = 16, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d={ANVIL_PATH} />
      <path d={SPARK_PATH} />
    </svg>
  )
}

type Row = { key: string; text: string; kind: 'code' | 'removed' | 'added' | 'lens' | 'box'; h: number; tint?: number; doc?: boolean; no?: number }

function helperRows(t: number): Row[] {
  const live = t < RESET
  const shown = live ? progress(t, at.hunks, 0.5) : 0
  const kept = live ? progress(t, at.acceptClick + 0.1, 0.5) : 0
  const box = live ? presence(t, at.boxOpen, at.boxClose, 0.45, 0.35) : 0
  const docs = docMask(helpersBefore)
  const rows: Row[] = []
  helpersBefore.forEach((text, i) => {
    const hunk = helpersHunks.find((entry) => entry.index === i)
    if (hunk && shown > 0) {
      rows.push({ key: `lens${i}`, text: '', kind: 'lens', h: 20 * shown * (1 - kept) })
      rows.push({ key: `rm${i}`, text, kind: 'removed', h: LAYOUT.line * (1 - kept), doc: docs[i], no: 20 + i })
      rows.push({ key: `add${i}`, text: hunk.added, kind: 'added', h: LAYOUT.line * shown, tint: 1 - kept, doc: docs[i], no: 20 + i })
    } else {
      rows.push({ key: `l${i}`, text, kind: 'code', h: LAYOUT.line, doc: docs[i], no: 20 + i })
    }
    if (i === 10) rows.push({ key: 'box', text: '', kind: 'box', h: 150 * box })
  })
  return rows
}

function cliRows(t: number): Row[] {
  const kept = progress(t, at.keepClick + 0.1, 0.6)
  const rows: Row[] = cliLines.map((text, i) => ({ key: `c${i}`, text, kind: 'code', h: LAYOUT.line, no: 1080 + i }))
  cliAdded.forEach((text, i) =>
    rows.push({ key: `a${i}`, text, kind: 'added', h: LAYOUT.line * progress(t, at.steps[2] + i * 0.05, 0.4), tint: 1 - kept, no: 1088 + i }),
  )
  cliAfter.forEach((text, i) => rows.push({ key: `t${i}`, text, kind: 'code', h: LAYOUT.line, no: 1100 + i }))
  return rows
}

function InlineBox({ t }: { t: number }) {
  const submitted = t >= at.submit
  const status =
    t < at.submit ? null : t < at.hunks ? 'Working…' : t < at.acceptClick ? '2 changes to review' : 'Applied +2 −2'
  return (
    <div style={{ margin: '6px 12px 6px 56px', borderTop: `1px solid ${C.blue}`, borderBottom: `1px solid ${C.blue}`, background: '#1b1d22', height: 138, fontFamily: sans, fontSize: 13, color: C.text, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', color: C.muted, fontSize: 12 }}>
        <span>
          Anvil · helpers.py:24-30{status ? ` · ${status.toLowerCase()}` : ''}
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: t >= at.hunks && t < at.acceptClick + 0.3 ? 1 : 0.35 }}>
          <span style={{ color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="tick" size={13} /> Accept all
          </span>
          <Icon name="diff" size={13} />
          <Icon name="close" size={13} />
        </span>
      </div>
      {submitted ? (
        <div style={{ padding: '2px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 18, height: 18, borderRadius: 9, background: '#3b6ea8', color: '#fff', fontSize: 10, fontWeight: 600, display: 'grid', placeItems: 'center' }}>S</span>
            <b style={{ fontWeight: 600 }}>Swapnil</b>
            <span style={{ color: C.muted }}>{instruction}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', ...enter(progress(t, at.submit + 0.1, 0.4), 6) }}>
            <AnvilMark size={18} />
            <b style={{ fontWeight: 600 }}>Anvil</b>
            <span style={{ color: t >= at.acceptClick ? C.green : C.muted }}>{status}</span>
          </div>
        </div>
      ) : (
        <div style={{ margin: '4px 10px', border: `1px solid ${C.blue}`, borderRadius: 4, padding: '8px 10px', height: 54, background: '#141414', fontFamily: mono, fontSize: 13 }}>
          {typed(t, at.instruction, instruction) || <span style={{ color: C.muted }}>Describe the change · Ctrl+Enter</span>}
        </div>
      )}
      {!submitted && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '0 10px' }}>
          <span style={{ padding: '3px 10px', borderRadius: 3, background: '#0e639c', color: '#fff', fontSize: 12 }}>Edit</span>
        </div>
      )}
    </div>
  )
}

function Editor({ t }: { t: number }) {
  const cli = t >= at.steps[2] - 0.2 && t < RESET
  const rows = cli ? cliRows(t) : helperRows(t)
  const selected = t < RESET ? progress(t, at.selectFrom, at.selectTo - at.selectFrom, easeInOut) * presence(t, at.selectFrom, at.submit) : 0
  const lastSelected = 4 + Math.ceil(selected * 6)
  const toolbar = t < RESET ? presence(t, at.toolbar, at.boxOpen - 0.15) : 0
  const tabs = [
    { name: 'helpers.py', active: !cli },
    ...(t >= at.steps[2] - 0.2 && t < RESET ? [{ name: 'cli.py', active: cli }] : []),
  ]
  return (
    <div style={{ position: 'absolute', left: EDITOR_X, top: WIN.y + LAYOUT.title, width: PANEL_X - EDITOR_X, height: WIN.h - LAYOUT.title - LAYOUT.status, background: C.window, overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: LAYOUT.tabs, background: C.side, borderBottom: `1px solid ${C.border}`, fontFamily: sans, fontSize: 13 }}>
        {tabs.map((tab) => (
          <div key={tab.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', background: tab.active ? C.window : 'transparent', color: tab.active ? '#fff' : C.muted, borderTop: `1px solid ${tab.active ? C.accent : 'transparent'}`, borderRight: `1px solid ${C.border}` }}>
            <span style={{ color: '#e5c07b', fontFamily: mono, fontSize: 11 }}>py</span>
            {tab.name}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: CODE_TOP - WIN.y - LAYOUT.title, left: 0, right: 0, fontFamily: mono, fontSize: 14 }}>
        {rows.map((row) => {
          if (row.h < 0.5) return null
          if (row.kind === 'box') {
            return (
              <div key={row.key} style={{ height: row.h, overflow: 'hidden' }}>
                <InlineBox t={t} />
              </div>
            )
          }
          if (row.kind === 'lens') {
            return (
              <div key={row.key} style={{ height: row.h, overflow: 'hidden', paddingLeft: 64, fontFamily: sans, fontSize: 11.5, color: C.muted, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span>Accept</span>
                <span>Reject</span>
                <span>Keep both</span>
              </div>
            )
          }
          const index = Number(row.key.replace(/\D/g, ''))
          const inSelection = !cli && row.kind === 'code' && selected > 0 && index >= 4 && index <= lastSelected
          const background =
            row.kind === 'removed' ? 'rgba(224,108,108,0.18)' : row.kind === 'added' ? `rgba(108,192,139,${0.2 * (row.tint ?? 0)})` : inSelection ? 'rgba(38,79,120,0.85)' : 'transparent'
          return (
            <div key={row.key} style={{ height: row.h, overflow: 'hidden', display: 'flex', background, whiteSpace: 'pre', lineHeight: `${LAYOUT.line}px` }}>
              <span style={{ width: LAYOUT.gutter, textAlign: 'right', paddingRight: 14, color: '#6e7681', flexShrink: 0 }}>{row.kind === 'removed' ? '' : row.no}</span>
              <span style={{ textDecoration: row.kind === 'removed' ? 'line-through' : undefined, textDecorationColor: 'rgba(224,108,108,0.6)', opacity: row.kind === 'removed' ? 0.75 : 1 }}>
                <Code text={row.text} doc={row.doc} />
              </span>
            </div>
          )
        })}
      </div>
      {toolbar > 0 && (
        <div style={{ position: 'absolute', left: 64, top: CODE_TOP - WIN.y - LAYOUT.title + 3 * LAYOUT.line + 2, fontFamily: sans, fontSize: 12, color: C.muted, display: 'flex', gap: 14, ...enter(toolbar, 6) }}>
          <span style={{ color: C.text }}>Edit <span style={{ color: C.muted }}>(Ctrl+Alt+K)</span></span>
          <span>Ask (Ctrl+Alt+Q)</span>
          <span>Add to chat (Ctrl+Alt+L)</span>
        </div>
      )}
    </div>
  )
}

const tree: Array<{ name: string; depth: number; folder?: boolean; file?: string }> = [
  { name: 'flask-3.1.3', depth: 0, folder: true },
  { name: 'docs', depth: 1, folder: true },
  { name: 'cli.rst', depth: 2, file: 'docs/cli.rst' },
  { name: 'src', depth: 1, folder: true },
  { name: 'flask', depth: 2, folder: true },
  { name: '__init__.py', depth: 3 },
  { name: 'app.py', depth: 3 },
  { name: 'cli.py', depth: 3, file: 'cli.py' },
  { name: 'config.py', depth: 3 },
  { name: 'helpers.py', depth: 3, file: 'helpers.py' },
  { name: 'json', depth: 3, folder: true },
  { name: 'sessions.py', depth: 3 },
  { name: 'tests', depth: 1, folder: true },
  { name: 'test_cli.py', depth: 2, file: 'test_cli.py' },
  { name: 'test_helpers.py', depth: 2 },
  { name: 'pyproject.toml', depth: 1 },
  { name: 'README.md', depth: 1 },
]

function Explorer({ t }: { t: number }) {
  const cli = t >= at.steps[2] - 0.2 && t < RESET
  const modified = (file?: string) =>
    t < RESET &&
    ((file === 'helpers.py' && t >= at.acceptClick) ||
      (file === 'cli.py' && t >= at.steps[2]) ||
      (file === 'test_cli.py' && t >= at.steps[3]) ||
      (file === 'docs/cli.rst' && t >= at.steps[4]))
  return (
    <div style={{ position: 'absolute', left: WIN.x + LAYOUT.activity, top: WIN.y + LAYOUT.title, width: LAYOUT.explorer, height: WIN.h - LAYOUT.title - LAYOUT.status, background: C.side, borderRight: `1px solid ${C.border}`, fontFamily: sans, fontSize: 13, color: C.text, paddingTop: 8 }}>
      <div style={{ padding: '2px 16px 8px', fontSize: 11, color: C.muted, letterSpacing: '0.02em' }}>Explorer</div>
      {tree.map((item) => {
        const active = (item.file === 'helpers.py' && !cli) || (item.file === 'cli.py' && cli)
        return (
          <div key={item.name + item.depth} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 22, paddingLeft: 12 + item.depth * 12, background: active ? '#37373d' : 'transparent', color: modified(item.file) ? '#e2c08d' : C.text }}>
            <span style={{ color: item.folder ? C.muted : '#e5c07b', fontSize: 11, width: 12 }}>{item.folder ? '›' : '·'}</span>
            <span style={{ flex: 1 }}>{item.name}</span>
            {modified(item.file) && <span style={{ paddingRight: 10, fontSize: 11 }}>M</span>}
          </div>
        )
      })}
    </div>
  )
}

function Panel({ t }: { t: number }) {
  const conv2 = t >= at.send && t < at.newChat + 0.4
  const conv3 = t >= at.send3 && t < RESET
  const fadeOut = conv2 ? 1 - progress(t, at.newChat, 0.4) : conv3 ? 1 - progress(t, at.reset, 0.4) : 1
  const start = conv2 || conv3 ? 0 : t >= RESET ? progress(t, RESET, 0.4) : t >= at.newChat ? progress(t, at.newChat + 0.3, 0.4) : 1
  const draft =
    t >= at.prompt && t < at.send ? typed(t, at.prompt, agentPrompt, 42) : t >= at.prompt3 && t < at.send3 ? typed(t, at.prompt3, askPrompt, 34) : ''
  const ask = t >= 24.3 && t < RESET + 0.3
  const failed = t >= at.send3 && t < at.strike
  const model = failed || (t >= at.composer3 && t < at.send3) ? 'gpt-5' : 'claude-sonnet-5-5'
  return (
    <div style={{ position: 'absolute', left: PANEL_X, top: WIN.y + LAYOUT.title, width: LAYOUT.panel, height: WIN.h - LAYOUT.title - LAYOUT.status, background: C.side, borderLeft: `1px solid ${C.border}`, fontFamily: sans, color: C.text, fontSize: 13 }}>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
          <AnvilMark size={15} /> Anvil
          <span style={{ color: C.green, display: 'flex', marginLeft: 2 }}>
            <Icon name="check" size={13} />
          </span>
          <span style={{ color: C.muted, fontWeight: 400, fontFamily: mono, fontSize: 11 }}>ready</span>
        </span>
        <span style={{ display: 'flex', gap: 12, color: C.muted, fontSize: 12 }}>
          <span>History</span>
          <span>Settings</span>
        </span>
      </div>
      {start > 0 && <StartScreen opacity={start} />}
      {conv2 && <Conversation2 t={t} opacity={fadeOut} />}
      {conv3 && <Conversation3 t={t} opacity={fadeOut} />}
      <Composer draft={draft} ask={ask} model={model} t={t} />
    </div>
  )
}

function StartScreen({ opacity }: { opacity: number }) {
  const checks = ['TrueForge connected', 'Model chain: sonnet, then gpt-5', 'Indexed 312 files']
  return (
    <div style={{ position: 'absolute', top: 120, left: 28, right: 28, opacity }}>
      <AnvilMark size={30} />
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 14 }}>Good evening, Swapnil</div>
      <div style={{ color: C.muted, marginTop: 4 }}>Every edit waits for your review.</div>
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {checks.map((label) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.green, display: 'flex' }}>
              <Icon name="check" size={15} />
            </span>
            {label}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 26, display: 'flex', flexWrap: 'wrap', gap: 8, color: C.muted, fontSize: 12 }}>
        {['Ctrl+Alt+K inline edit', 'Ctrl+Alt+L add selection', '@ mention'].map((hint) => (
          <span key={hint} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px' }}>
            {hint}
          </span>
        ))}
      </div>
    </div>
  )
}

function MessageCard({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div style={{ margin: '12px 14px 0', border: `1px solid ${C.border}`, borderRadius: 10, background: C.raised, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.25)' }}>
      <div style={{ padding: '9px 12px', lineHeight: '19px' }}>{text}</div>
      {children}
    </div>
  )
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return (
    <span style={{ fontFamily: mono, fontSize: 11.5, padding: '1px 7px', borderRadius: 5, border: `1px solid ${tone}55`, background: `${tone}18`, color: tone }}>{label}</span>
  )
}

function Step({ t, start, icon, verb, path, tail }: { t: number; start: number; icon: 'fileSearch' | 'search' | 'fileEdit' | 'terminal'; verb: string; path: string; tail?: ReactNode }) {
  if (t < start) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 26, ...enter(progress(t, start, 0.4), 8) }}>
      <span style={{ color: C.muted, display: 'flex' }}>
        <Icon name={icon} size={14} />
      </span>
      <span style={{ color: C.muted, width: 52 }}>{verb}</span>
      <span style={{ fontFamily: mono, fontSize: 12.5 }}>{path}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 12 }}>
        {tail}
        <span style={{ color: C.green, display: 'flex' }}>
          <Icon name="check" size={14} />
        </span>
      </span>
    </div>
  )
}

const diff = (added: number, removed = 0) => (
  <span>
    <span style={{ color: C.green }}>+{added}</span> <span style={{ color: C.red }}>−{removed}</span>
  </span>
)

function Conversation2({ t, opacity }: { t: number; opacity: number }) {
  const ctx = progress(t, at.context, 0.45)
  const tray = presence(t, at.tray, at.keepClick + 0.15, 0.45, 0.3)
  return (
    <div style={{ position: 'absolute', inset: '32px 0 110px', opacity }}>
      <div style={enter(progress(t, at.send, 0.4), 10)}>
        <MessageCard text={agentPrompt}>
          <div style={{ borderTop: `1px solid ${C.border}`, background: '#1d1d1d', height: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
            {ctx === 0 ? (
              <span style={{ color: C.muted, fontSize: 12 }}>Choosing context…</span>
            ) : (
              <>
                <span style={{ color: C.muted, display: 'flex', opacity: ctx }}>
                  <Icon name="layers" size={13} />
                </span>
                {['cli.py', 'test_cli.py', 'cli.rst'].map((name, i) => (
                  <span key={name} style={enter(progress(t, at.context + i * 0.12, 0.35), 4)}>
                    <Chip label={name} tone={C.accent} />
                  </span>
                ))}
                <span style={{ color: C.muted, fontSize: 12, opacity: ctx }}>+2</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, opacity: ctx }}>
                  <span style={{ width: 40, height: 4, borderRadius: 2, background: '#ffffff1a', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: 4, width: `${75 * ctx}%`, background: C.blue }} />
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>4.5k/6k</span>
                </span>
              </>
            )}
          </div>
        </MessageCard>
      </div>
      <div style={{ padding: '14px 16px 0' }}>
        <Step t={t} start={at.steps[0]} icon="fileSearch" verb="Read" path="src/flask/cli.py" />
        <Step t={t} start={at.steps[1]} icon="search" verb="Search" path='"routes_command"' tail={<span style={{ color: C.muted }}>6 hits</span>} />
        <Step t={t} start={at.steps[2]} icon="fileEdit" verb="Edit" path="src/flask/cli.py" tail={diff(10)} />
        <Step t={t} start={at.steps[3]} icon="fileEdit" verb="Edit" path="tests/test_cli.py" tail={diff(27)} />
        <Step t={t} start={at.steps[4]} icon="fileEdit" verb="Edit" path="docs/cli.rst" tail={diff(14)} />
        <Step t={t} start={at.steps[5]} icon="terminal" verb="Run" path="pytest tests/test_cli.py" tail={<span style={{ color: C.green }}>56 passed</span>} />
      </div>
      {t >= at.answer && (
        <div style={{ padding: '12px 16px 0', lineHeight: '20px', ...enter(progress(t, at.answer, 0.5), 8) }}>
          Added <code style={{ fontFamily: mono, background: '#2a2a2a', padding: '0 4px', borderRadius: 3 }}>flask config</code>. Keys with SECRET, PASSWORD, TOKEN or KEY print as ***.
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: C.green, fontSize: 12.5 }}>
            <Icon name="check" size={14} /> Verified with pytest
          </div>
        </div>
      )}
      {tray > 0 && (
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 8, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, background: C.raised, boxShadow: '0 6px 18px rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, ...enter(tray, 10) }}>
          <span style={{ fontWeight: 600 }}>3 files edited</span>
          <span style={{ fontFamily: mono, fontSize: 12 }}>{diff(51)}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <span style={{ padding: '3px 10px', borderRadius: 6, background: '#24382b', color: '#a3e0b6', fontSize: 12 }}>Keep all</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, color: C.muted, fontSize: 12 }}>Discard all</span>
          </span>
        </div>
      )}
    </div>
  )
}

function Conversation3({ t, opacity }: { t: number; opacity: number }) {
  const strike = progress(t, at.strike, 0.5)
  return (
    <div style={{ position: 'absolute', inset: '32px 0 110px', opacity }}>
      <div style={enter(progress(t, at.send3, 0.4), 10)}>
        <MessageCard text={askPrompt} />
      </div>
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {t >= at.thinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, ...enter(progress(t, at.thinking, 0.35), 6) }}>
            <Icon name="clock" size={14} /> Asking gpt-5
          </div>
        )}
        {t >= at.strike && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px dashed ${C.accent}88`, background: `${C.accent}12`, ...enter(strike, 8) }}>
            <span style={{ color: C.accent, display: 'flex' }}>
              <Icon name="flash" size={15} />
            </span>
            <span style={{ fontFamily: mono, fontSize: 12.5, textDecoration: 'line-through', color: C.muted }}>gpt-5</span>
            <span style={{ color: C.muted, display: 'flex' }}>
              <Icon name="arrow" size={14} />
            </span>
            <span style={{ fontFamily: mono, fontSize: 12.5, color: C.accent }}>claude-sonnet-5-5</span>
            <span style={{ color: C.muted, fontSize: 12 }}>rate limited, switched in 1.2 s</span>
          </div>
        )}
        {t >= at.answer3 && (
          <div style={{ lineHeight: '20px', ...enter(progress(t, at.answer3, 0.5), 8) }}>
            <code style={{ fontFamily: mono, background: '#2a2a2a', padding: '0 4px', borderRadius: 3 }}>get_debug_flag</code> only treats 0, false and no as off. Any other value, including off, turns debug on.
          </div>
        )}
      </div>
    </div>
  )
}

function Composer({ draft, ask, model, t }: { draft: string; ask: boolean; model: string; t: number }) {
  const focused = (t >= at.composerClick && t < at.send) || (t >= at.composer3 && t < at.send3)
  const tone = ask ? C.blue : C.accent
  return (
    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, height: 92, borderRadius: 12, border: `1px solid ${focused ? tone : `${tone}66`}`, background: '#1e1e1e', boxShadow: '0 8px 24px rgba(0,0,0,.35)', padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ color: draft ? C.text : C.muted, lineHeight: '18px', height: 36, overflow: 'hidden' }}>{draft || 'Describe a change, @ for files, / for skills'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: tone }}>
          <Icon name={ask ? 'eye' : 'edit'} size={13} />
          {ask ? 'Ask' : 'Agent'}
        </span>
        <span style={{ fontFamily: mono }}>{model}</span>
        <span style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: draft ? tone : '#2d2d2d', color: draft ? '#151515' : C.muted }}>
          <Icon name="up" size={15} stroke={2} />
        </span>
      </div>
    </div>
  )
}

export function Scene({ t }: { t: number }) {
  const editorFocus = amount(t, focus.editor)
  const panelFocus = amount(t, focus.panel)
  const any = Math.max(editorFocus, panelFocus)
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 15% 10%, #f3d2b3 0%, #e7b48f 22%, #9fb7d6 55%, #5b7fae 80%, #36557f 100%)', ...grey(any) }} />
      <div style={{ position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 80px rgba(12,18,32,.45), 0 0 0 1px rgba(255,255,255,.08)', background: C.window }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${-WIN.x}px, ${-WIN.y}px)` }}>
          <div style={{ position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: LAYOUT.title, background: C.side, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans, fontSize: 12.5, color: C.muted }}>
            <span style={{ position: 'absolute', left: 14, display: 'flex', gap: 7 }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
              ))}
            </span>
            flask-3.1.3 · Visual Studio Code
          </div>
          <div style={{ position: 'absolute', left: WIN.x, top: WIN.y + LAYOUT.title, width: LAYOUT.activity, height: WIN.h - LAYOUT.title - LAYOUT.status, background: C.side, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, paddingTop: 14, color: C.muted, ...grey(panelFocus) }}>
            <Icon name="files" size={22} />
            <Icon name="search" size={22} />
            <Icon name="branch" size={22} />
            <Icon name="puzzle" size={22} />
            <span style={{ color: C.accent }}>
              <AnvilMark size={22} />
            </span>
          </div>
          <div style={grey(panelFocus)}>
            <Explorer t={t} />
            <Editor t={t} />
          </div>
          <div style={grey(editorFocus)}>
            <Panel t={t} />
          </div>
          <div style={{ position: 'absolute', left: WIN.x, top: WIN.y + WIN.h - LAYOUT.status, width: WIN.w, height: LAYOUT.status, background: '#181818', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 12px', fontFamily: sans, fontSize: 12, color: C.muted, ...grey(any) }}>
            <span>main</span>
            <span style={{ marginLeft: 'auto' }}>Python 3.12</span>
            <span style={{ color: C.accent }}>Anvil</span>
          </div>
        </div>
      </div>
    </div>
  )
}
