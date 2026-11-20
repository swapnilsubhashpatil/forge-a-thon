import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons'
import { enter, presence, progress, typed } from './anim'
import type { Film } from './film'
import { C, Chip, Composer, Desktop, Editor, Explorer, MessageCard, PanelFrame, Step, amount, diff, mono } from './Scene'
import { agentPrompt } from './script'

const wide = { x: 800, y: 500, zoom: 1 }

const shot = (t: number, x: number, y: number, zoom: number, dip?: number) => ({ t, x, y, zoom, dip })

function Rows({ children, offset = 0 }: { children: ReactNode; offset?: number }) {
  return <div style={{ padding: '14px 16px 0', transform: `translateY(${offset}px)` }}>{children}</div>
}

function DoneSteps({ t = 99, from = -1 }: { t?: number; from?: number }) {
  const s = (i: number) => from + i * 0.55
  return (
    <>
      <Step t={t} start={s(0)} icon="fileSearch" verb="Read" path="src/flask/cli.py" />
      <Step t={t} start={s(1)} icon="fileEdit" verb="Edit" path="src/flask/cli.py" tail={diff(10)} />
      <Step t={t} start={s(2)} icon="fileEdit" verb="Edit" path="tests/test_cli.py" tail={diff(27)} />
      <Step t={t} start={s(3)} icon="fileEdit" verb="Edit" path="docs/cli.rst" tail={diff(14)} />
      <Step t={t} start={s(4)} icon="terminal" verb="Run" path="pytest tests/test_cli.py" tail={<span style={{ color: C.green }}>56 passed</span>} />
    </>
  )
}

function Footer({ open, chips = ['cli.py', 'test_cli.py', 'cli.rst'], extra }: { open: number; chips?: string[]; extra?: ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, background: '#1d1d1d', height: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
      <span style={{ color: C.muted, display: 'flex' }}>
        <Icon name="layers" size={13} />
      </span>
      {extra}
      {chips.map((name) => (
        <Chip key={name} label={name} tone={C.accent} />
      ))}
      <span style={{ color: C.muted, fontSize: 12 }}>+2</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 40, height: 4, borderRadius: 2, background: '#ffffff1a', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: 4, width: '75%', background: C.blue }} />
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>4.5k/6k</span>
        <span style={{ color: C.muted, display: 'flex', transform: `rotate(${180 * open}deg)` }}>
          <Icon name="up" size={12} />
        </span>
      </span>
    </div>
  )
}

const picks = [
  { group: 'Will edit', path: 'src/flask/cli.py', why: 'path matches cli · defines routes_command', tokens: '2.3k' },
  { group: 'Will edit', path: 'tests/test_cli.py', why: 'tests for cli.py', tokens: '1.1k' },
  { group: 'Will edit', path: 'docs/cli.rst', why: 'docs for cli.py', tokens: '0.4k' },
  { group: 'For reference', path: 'src/flask/config.py', why: 'mentions config', tokens: '0.6k' },
  { group: 'For reference', path: 'src/flask/app.py', why: 'imports cli', tokens: '0.1k' },
]

function ContextDetails({ open }: { open: number }) {
  return (
    <div style={{ height: 196 * open, overflow: 'hidden', background: '#1d1d1d', borderTop: `1px solid ${C.border}` }}>
      <div style={{ padding: '8px 12px', opacity: open }}>
        {['Will edit', 'For reference'].map((group) => (
          <div key={group} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 2 }}>{group}</div>
            {picks
              .filter((pick) => pick.group === group)
              .map((pick) => (
                <div key={pick.path} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 22, fontSize: 12 }}>
                  <span style={{ fontFamily: mono, color: group === 'Will edit' ? C.accent : C.blue }}>{pick.path.split('/').pop()}</span>
                  <span style={{ color: C.muted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{pick.why}</span>
                  <span style={{ fontFamily: mono, color: C.muted }}>{pick.tokens}</span>
                </div>
              ))}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.green, fontSize: 12 }}>
          <Icon name="check" size={13} /> Picked all 3 files it went on to edit
        </div>
      </div>
    </div>
  )
}

const contextAt = { click: 2.4, close: 9.8 }

export const contextFilm: Film = {
  id: 'context',
  duration: 12,
  chapters: [{ id: 'context', from: 0, to: 12, label: 'Context', title: 'See what it read.', body: 'Every request shows the files Anvil picked, why it picked them and what they cost.' }],
  camera: [shot(0, wide.x, wide.y, 1), shot(1.1, wide.x, wide.y, 1), shot(2.5, 1300, 300, 1.75), shot(9.6, 1300, 300, 1.75), shot(10.9, wide.x, wide.y, 1), shot(12, wide.x, wide.y, 1)],
  cursor: [
    { t: 0, x: 1000, y: 600, hidden: true },
    { t: 1.2, x: 1000, y: 600 },
    { t: 2.3, x: 1250, y: 195 },
    { t: 2.4, x: 1250, y: 195, click: true },
    { t: 3.2, x: 1530, y: 470, hidden: true },
    { t: 9.0, x: 1530, y: 470, hidden: true },
    { t: 9.7, x: 1250, y: 195 },
    { t: 9.8, x: 1250, y: 195, click: true },
    { t: 10.6, x: 1000, y: 600, hidden: true },
    { t: 12, x: 1000, y: 600, hidden: true },
  ],
  render: (t) => {
    const open = progress(t, contextAt.click + 0.1, 0.5) * (1 - progress(t, contextAt.close + 0.1, 0.45))
    return (
      <Desktop
        panelFocus={amount(t, [[2.2, 9.9]])}
        explorer={<Explorer t={0} />}
        editor={<Editor t={0} />}
        panel={
          <PanelFrame>
            <div style={{ position: 'absolute', inset: '32px 0 110px' }}>
              <MessageCard text={agentPrompt}>
                <Footer open={open} />
                <ContextDetails open={open} />
              </MessageCard>
              <Rows>
                <DoneSteps />
              </Rows>
            </div>
            <Composer draft="" />
          </PanelFrame>
        }
      />
    )
  },
}

const undoAt = { hover: 1.3, menu: 2.3, choose: 3.8, confirm: 5.0, back: 11.2 }

function ActionRow({ show }: { show: number }) {
  const icons: IconName[] = ['copy', 'edit', 'repeat', 'undo']
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, padding: '4px 14px 0', opacity: show }}>
      {icons.map((name, i) => (
        <span key={name} style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', color: i === 3 ? C.text : C.muted, background: i === 3 && show > 0.9 ? '#2d2d2d' : 'transparent' }}>
          <Icon name={name} size={14} />
        </span>
      ))}
    </div>
  )
}

function RevertMenu({ show, confirm }: { show: number; confirm: number }) {
  const options = [
    ['Conversation only', 'Forget this message and later ones. Files stay.'],
    ['Code only', 'Undo edits from here on. Chat stays.'],
    ['Conversation and code', 'Back to before you sent this.'],
  ]
  return (
    <div style={{ position: 'absolute', right: 14, top: 140, width: 280, borderRadius: 10, border: `1px solid ${C.border}`, background: '#252526', boxShadow: '0 12px 30px rgba(0,0,0,.5)', padding: 4, ...enter(show, 8), zIndex: 5 }}>
      {options.map(([title, body], i) => (
        <div key={title} style={{ padding: '6px 10px', borderRadius: 6, background: i === 2 && confirm > 0 ? '#3a2a1e' : 'transparent' }}>
          <div style={{ fontSize: 13 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{body}</div>
        </div>
      ))}
      <div style={{ height: 52 * confirm, overflow: 'hidden', borderTop: confirm ? `1px solid ${C.border}` : undefined }}>
        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ flex: 1 }}>Undo 3 files and rewind?</span>
          <span style={{ padding: '3px 10px', borderRadius: 5, background: C.accent, color: '#161616', fontWeight: 600 }}>Revert</span>
          <span style={{ padding: '3px 8px', color: C.muted }}>Cancel</span>
        </div>
      </div>
    </div>
  )
}

export const undoFilm: Film = {
  id: 'undo',
  duration: 12.5,
  chapters: [{ id: 'undo', from: 0, to: 12.5, label: 'Undo', title: 'Rewind anything.', body: 'Go back to before any message: the chat, the code, or both. Trying an idea costs nothing.' }],
  camera: [shot(0, wide.x, wide.y, 1), shot(0.6, wide.x, wide.y, 1), shot(1.9, 1300, 330, 1.6), shot(5.2, 1300, 330, 1.6), shot(6.6, 760, 450, 1.05, 0.08), shot(10.4, 760, 450, 1.05), shot(11.6, wide.x, wide.y, 1), shot(12.5, wide.x, wide.y, 1)],
  cursor: [
    { t: 0, x: 1000, y: 600, hidden: true },
    { t: 0.8, x: 1000, y: 600 },
    { t: 1.3, x: 1300, y: 150 },
    { t: 2.1, x: 1515, y: 227 },
    { t: 2.25, x: 1515, y: 227, click: true },
    { t: 3.7, x: 1390, y: 362 },
    { t: 3.8, x: 1390, y: 362, click: true },
    { t: 4.9, x: 1437, y: 414 },
    { t: 5.0, x: 1437, y: 414, click: true },
    { t: 5.8, x: 1100, y: 640, hidden: true },
    { t: 12.5, x: 1000, y: 600, hidden: true },
  ],
  render: (t) => {
    const back = progress(t, undoAt.back, 0.6)
    const done = progress(t, undoAt.confirm + 0.15, 0.5) * (1 - back)
    const actions = presence(t, undoAt.hover, undoAt.confirm + 0.2)
    const menu = presence(t, undoAt.menu, undoAt.confirm + 0.15, 0.35, 0.2)
    const confirm = progress(t, undoAt.choose + 0.1, 0.35)
    const changed = ['cli.py', 'test_cli.py', 'docs/cli.rst'].filter((_, i) => t < undoAt.confirm + 0.5 + i * 0.25 || t >= undoAt.back)
    return (
      <Desktop
        panelFocus={amount(t, [[1.8, 5.4]])}
        explorer={<Explorer t={0} changed={changed} />}
        editor={<Editor t={0} />}
        panel={
          <PanelFrame>
            <div style={{ position: 'absolute', inset: '32px 0 110px', opacity: 1 - 0.55 * done }}>
              {done > 0.5 && <div style={{ padding: '10px 16px 0', fontSize: 11.5, color: C.muted }}>Reverted: no longer part of the conversation</div>}
              <MessageCard text={agentPrompt}>
                <Footer open={0} />
              </MessageCard>
              <ActionRow show={actions} />
              <Rows offset={-26 * actions}>
                <DoneSteps />
              </Rows>
              {menu > 0 && <RevertMenu show={menu} confirm={confirm} />}
            </div>
            <Composer draft={done > 0.6 ? agentPrompt : ''} focused={done > 0.6} />
          </PanelFrame>
        }
      />
    )
  },
}

const skillAt = { focus: 1.0, slash: 1.4, pick: 2.6, typing: 2.9, send: 4.5, steps: 5.1, answer: 8.6, reset: 11.6 }
const skillText = 'add a hello command that prints Hello'

function SkillMenu({ show }: { show: number }) {
  const skills = [
    ['add-cli-command', 'Use when adding a flask CLI command'],
    ['release-notes', 'Use when asked for release notes'],
  ]
  return (
    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 114, borderRadius: 10, border: `1px solid ${C.border}`, background: '#252526', boxShadow: '0 12px 30px rgba(0,0,0,.5)', padding: 4, ...enter(show, 8) }}>
      {skills.map(([name, body], i) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, background: i === 0 ? '#37373d' : 'transparent' }}>
          <span style={{ color: '#c4a7f5', display: 'flex' }}>
            <Icon name="book" size={14} />
          </span>
          <span style={{ fontFamily: mono, fontSize: 12.5 }}>/{name}</span>
          <span style={{ color: C.muted, fontSize: 12 }}>{body}</span>
        </div>
      ))}
    </div>
  )
}

export const skillsFilm: Film = {
  id: 'skills',
  duration: 12.5,
  chapters: [{ id: 'skills', from: 0, to: 12.5, label: 'Skills', title: 'Teach it your way.', body: 'Write a skill once. Anvil loads it when a request matches, or when you type its name.' }],
  camera: [shot(0, wide.x, wide.y, 1), shot(0.5, wide.x, wide.y, 1), shot(1.7, 1300, 760, 1.6), shot(4.6, 1300, 760, 1.6), shot(5.8, 1300, 400, 1.45, 0.08), shot(10.8, 1300, 400, 1.45), shot(12, wide.x, wide.y, 1), shot(12.5, wide.x, wide.y, 1)],
  cursor: [
    { t: 0, x: 1000, y: 600, hidden: true },
    { t: 0.6, x: 1000, y: 600 },
    { t: 1.0, x: 1240, y: 850, click: true },
    { t: 2.45, x: 1210, y: 744 },
    { t: 2.6, x: 1210, y: 744, click: true },
    { t: 4.3, x: 1508, y: 899 },
    { t: 4.5, x: 1508, y: 899, click: true },
    { t: 5.2, x: 1530, y: 640, hidden: true },
    { t: 12.5, x: 1000, y: 600, hidden: true },
  ],
  render: (t) => {
    const sent = t >= skillAt.send && t < skillAt.reset + 0.4
    const fade = 1 - progress(t, skillAt.reset, 0.4)
    const menu = presence(t, skillAt.slash, skillAt.pick + 0.1, 0.3, 0.2)
    const picked = t >= skillAt.pick && t < skillAt.send
    const draft = t >= skillAt.slash && t < skillAt.pick ? '/' : picked ? typed(t, skillAt.typing, skillText, 30) : ''
    const skillChip = <Chip label="/add-cli-command" tone="#c4a7f5" />
    return (
      <Desktop
        panelFocus={amount(t, [[1.6, 11.0]])}
        explorer={<Explorer t={0} />}
        editor={<Editor t={0} />}
        panel={
          <PanelFrame>
            {sent && (
              <div style={{ position: 'absolute', inset: '32px 0 110px', opacity: fade }}>
                <div style={enter(progress(t, skillAt.send, 0.4), 10)}>
                  <MessageCard text={skillText}>
                    <Footer open={0} chips={['cli.py', 'test_cli.py']} extra={skillChip} />
                  </MessageCard>
                </div>
                <Rows>
                  <Step t={t} start={skillAt.steps} icon="book" verb="Skill" path="add-cli-command" />
                  <DoneSteps t={t} from={skillAt.steps + 0.6} />
                </Rows>
                {t >= skillAt.answer && (
                  <div style={{ padding: '12px 16px 0', lineHeight: '20px', ...enter(progress(t, skillAt.answer, 0.5), 8) }}>
                    Added <code style={{ fontFamily: mono, background: '#2a2a2a', padding: '0 4px', borderRadius: 3 }}>flask hello</code> the way your skill describes: command, test and docs.
                  </div>
                )}
              </div>
            )}
            {menu > 0 && <SkillMenu show={menu} />}
            <Composer draft={draft} focused={t >= skillAt.focus && t < skillAt.send} chips={picked ? skillChip : undefined} />
          </PanelFrame>
        }
      />
    )
  },
}

const mcpAt = { add: 1.2, name: 1.6, url: 2.2, key: 3.2, submit: 4.1, ok: 5.2, expand: 5.6, chat: 6.9, send: 7.4, steps: 8.0, answer: 9.4, reset: 13.2 }
const tools = ['search_notes', 'read_note', 'list_notes', 'create_note', 'append_to_note', 'get_backlinks']
const mcpPrompt = 'Turn my side-project notes into a launch checklist'

function Field({ label, value, mask }: { label: string; value: string; mask?: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: '#141414', padding: '0 9px', display: 'flex', alignItems: 'center', fontFamily: mono, fontSize: 12.5 }}>{mask ? value.replace(/[^ ]/g, '•') : value}</div>
    </div>
  )
}

function ServerCard({ name, url, status, count, open }: { name: string; url: string; status: 'testing' | 'ok'; count: number; open: number }) {
  return (
    <div style={{ margin: '0 14px 10px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#202020', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: status === 'ok' ? C.green : C.muted, display: 'flex' }}>
          <Icon name={status === 'ok' ? 'check' : 'clock'} size={15} />
        </span>
        <span style={{ fontFamily: mono, fontWeight: 500 }}>{name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: status === 'ok' ? C.text : C.muted }}>{status === 'ok' ? `${count} tools` : 'Testing…'}</span>
        <span style={{ width: 26, height: 14, borderRadius: 7, background: status === 'ok' ? C.accent : '#3a3a3a', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 2, left: status === 'ok' ? 14 : 2, width: 10, height: 10, borderRadius: 5, background: '#fff' }} />
        </span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 11.5, color: C.muted, marginTop: 3 }}>{url}</div>
      <div style={{ height: 48 * open, overflow: 'hidden', marginTop: 6 * open, display: 'flex', flexWrap: 'wrap', gap: 5, opacity: open }}>
        {tools.map((tool) => (
          <span key={tool} style={{ fontFamily: mono, fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#2a2a2a', color: C.text }}>
            {tool}
          </span>
        ))}
      </div>
    </div>
  )
}

function McpSettings({ t }: { t: number }) {
  const form = presence(t, mcpAt.add, mcpAt.submit + 0.1, 0.4, 0.3)
  const added = t >= mcpAt.submit + 0.2
  return (
    <div style={{ position: 'absolute', inset: '32px 0 0' }}>
      <div style={{ display: 'flex', gap: 2, margin: '12px 14px', padding: 3, borderRadius: 8, background: '#202020' }}>
        {['General', 'Models', 'Agent', 'Skills', 'MCP'].map((tab) => (
          <span key={tab} style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 6, fontSize: 12, background: tab === 'MCP' ? '#37373d' : 'transparent', color: tab === 'MCP' ? C.text : C.muted }}>
            {tab}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', margin: '4px 14px 12px' }}>
        <div>
          <div style={{ fontWeight: 600 }}>MCP servers</div>
          <div style={{ fontSize: 12, color: C.muted }}>Tools the agent can use</div>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12 }}>
          <Icon name="plug" size={13} /> Add server
        </span>
      </div>
      {form > 0 && (
        <div style={{ margin: '0 14px 10px', height: 212 * form, overflow: 'hidden', borderRadius: 10, border: `1px solid ${C.accent}66`, background: '#202020' }}>
          <div style={{ padding: '10px 12px' }}>
            <Field label="Name" value={typed(t, mcpAt.name, 'obsidian', 18)} />
            <Field label="URL" value={typed(t, mcpAt.url, 'https://notes.example.com/mcp', 32)} />
            <Field label="Authorization" value={typed(t, mcpAt.key, 'Bearer 3f9c2a1e7b', 30)} mask />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ padding: '3px 12px', borderRadius: 6, background: C.accent, color: '#161616', fontSize: 12, fontWeight: 600 }}>Add</span>
            </div>
          </div>
        </div>
      )}
      {added && (
        <div style={enter(progress(t, mcpAt.submit + 0.2, 0.4), 8)}>
          <ServerCard name="obsidian" url="https://notes.example.com/mcp" status={t >= mcpAt.ok ? 'ok' : 'testing'} count={9} open={progress(t, mcpAt.expand, 0.45)} />
        </div>
      )}
      <ServerCard name="deepwiki" url="https://mcp.deepwiki.com/mcp" status="ok" count={3} open={0} />
    </div>
  )
}

function McpChat({ t }: { t: number }) {
  const items = ['Write the README intro', 'Record a short demo', 'Tag the first release', 'Share the repo link']
  return (
    <div style={{ position: 'absolute', inset: '32px 0 110px' }}>
      <div style={enter(progress(t, mcpAt.send, 0.4), 10)}>
        <MessageCard text={mcpPrompt} />
      </div>
      <Rows>
        <Step t={t} start={mcpAt.steps} icon="plug" verb="obsidian" path="search_notes(&quot;side project&quot;)" tail={<span style={{ color: C.muted }}>18 notes</span>} />
        <Step t={t} start={mcpAt.steps + 0.6} icon="plug" verb="obsidian" path="read_note × 3" />
      </Rows>
      {t >= mcpAt.answer && (
        <div style={{ padding: '10px 16px 0', ...enter(progress(t, mcpAt.answer, 0.5), 8) }}>
          {items.map((item, i) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24, ...enter(progress(t, mcpAt.answer + 0.15 * i, 0.35), 4) }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${C.muted}` }} />
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const mcpFilm: Film = {
  id: 'mcp',
  duration: 14,
  chapters: [{ id: 'mcp', from: 0, to: 14, label: 'MCP servers', title: 'Plug in your tools.', body: 'Add an MCP server, test it in one click, and the agent can use it. Here, an Obsidian vault.' }],
  camera: [shot(0, wide.x, wide.y, 1), shot(0.5, wide.x, wide.y, 1), shot(1.6, 1300, 360, 1.55), shot(12.6, 1300, 360, 1.55), shot(13.6, wide.x, wide.y, 1), shot(14, wide.x, wide.y, 1)],
  cursor: [
    { t: 0, x: 1000, y: 600, hidden: true },
    { t: 0.6, x: 1000, y: 600 },
    { t: 1.1, x: 1480, y: 190 },
    { t: 1.2, x: 1480, y: 190, click: true },
    { t: 3.95, x: 1494, y: 403 },
    { t: 4.1, x: 1494, y: 403, click: true },
    { t: 5.45, x: 1470, y: 238 },
    { t: 5.6, x: 1470, y: 238, click: true },
    { t: 6.4, x: 1530, y: 640, hidden: true },
    { t: 14, x: 1000, y: 600, hidden: true },
  ],
  render: (t) => {
    const chat = progress(t, mcpAt.chat, 0.4) * (1 - progress(t, mcpAt.reset, 0.4))
    return (
      <Desktop
        panelFocus={amount(t, [[1.5, 12.8]])}
        explorer={<Explorer t={0} />}
        editor={<Editor t={0} />}
        panel={
          <PanelFrame>
            <div style={{ opacity: 1 - chat }}>{chat < 1 && <McpSettings t={t < mcpAt.reset ? t : 0} />}</div>
            {chat > 0 && (
              <div style={{ opacity: chat }}>
                <McpChat t={t} />
                <Composer draft="" />
              </div>
            )}
          </PanelFrame>
        }
      />
    )
  },
}

export const features = [
  { film: 'tour', chapter: 'edit', label: 'Inline edit' },
  { film: 'tour', chapter: 'agent', label: 'Agent mode' },
  { film: 'context', label: 'Context' },
  { film: 'undo', label: 'Undo' },
  { film: 'skills', label: 'Skills' },
  { film: 'mcp', label: 'MCP servers' },
  { film: 'tour', chapter: 'failover', label: 'Failover' },
] as const

export const films = { context: contextFilm, undo: undoFilm, skills: skillsFilm, mcp: mcpFilm }
