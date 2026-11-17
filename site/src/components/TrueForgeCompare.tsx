import { useState } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT } from '../motion'
import { Disclosure, SectionHead } from './charts'

type Kind = 'adds' | 'fills' | 'uses'
type Row = { area: string; short: string; tf: string; anvil: string; kind: Kind }

// Sources: TrueForge audit (docs + source at commit 3e8184b),
// conductor/tracks/t8-standout/agent-mode-handoff.md §7, agents/anvil-agent.json.
const rows: Row[] = [
  { area: 'Agent loop', kind: 'uses', short: 'Same loop; adds a phased prompt and the finish_task gate.',
    tf: 'Runs the loop, sessions, streaming and history. Ends a turn as soon as the model replies with no tool call. Iteration limit 512 by default.',
    anvil: 'Uses the loop unchanged (inline agent spec, 60 iterations), plus the phased prompt and finish_task completion gate.' },
  { area: 'Editor tools', kind: 'fills', short: 'Its own loopback MCP server with a rotating token.',
    tf: 'MCP client over Streamable HTTP or SSE; no stdio. A network guard blocks localhost and private IPs by default.',
    anvil: 'Serves editor tools from a loopback Streamable HTTP MCP server with a bearer token that rotates every start; documents the OUTBOUND_URL_ALLOWED_HOSTS allow-list.' },
  { area: 'Tool approval', kind: 'adds', short: 'One approval becomes a per-hunk review in the editor.',
    tf: 'Per tool call: the turn pauses on tool.approval_required; you answer allow or deny with a reason.',
    anvil: 'Per-hunk review with scope and grounding badges; partial accepts return the rejected patch plus the current text (M3).' },
  { area: 'Model failure', kind: 'fills', short: 'Fallback chain with a circuit breaker; reason on screen.',
    tf: '2 retries with backoff on timeouts, 429 and 5xx. Each agent uses the one model you configure.',
    anvil: 'Failure classifier and circuit breaker (60 s cooldown): the next model reruns the same request.' },
  { area: 'Iteration limit', kind: 'adds', short: 'A wrap-up turn instead of a bare error.',
    tf: 'Emits only “You have reached iteration limit… please request again”.',
    anvil: 'Its own outcome (M10): no failover, a turn-budget hint from half way, one wrap-up turn via finish_task.' },
  { area: 'Cancel', kind: 'fills', short: 'Kills the whole process tree; nothing half-applied.',
    tf: 'sessions.cancel() aborts the model call but waits for running MCP tools to finish.',
    anvil: 'Also denies pending approvals, discards open reviews and kills the command’s process tree.' },
  { area: 'Typing while it works', kind: 'adds', short: 'Messages queue and steer the running turn.',
    tf: 'One active turn per session; a new message cancels the running turn.',
    anvil: 'Queues the message into the next tool result (M11), or “Stop and send” on request.' },
  { area: 'Stuck agents', kind: 'adds', short: 'Loop guard: nudge at 3 repeats, stop at 5.',
    tf: 'No stuck or loop detection.', anvil: 'Loop guard (M7): nudge at 3 repeats, stop at 5.' },
  { area: 'Subagents', kind: 'uses', short: 'Kept, but read-only.',
    tf: 'On by default, parallel, one level deep, sharing the parent’s tools including writes.',
    anvil: 'Write tools and nested subagents denied (M2).' },
  { area: 'Compaction', kind: 'uses', short: 'Triggers earlier, marked on the gauge.',
    tf: 'On by default at 80% of the context window.',
    anvil: 'Triggers at 60k input tokens (12k for local models); each compaction is marked on the context gauge.' },
  { area: 'Tool loading', kind: 'uses', short: 'Preloads its own editor tools.',
    tf: 'MCP tools are deferred: the agent sees server names and calls list_tools / get_tool_info / call_tool.',
    anvil: 'Sets preloadTools in its agent spec for its own editor tools.' },
  { area: 'Retrieval', kind: 'fills', short: 'The whole context pack: TrueForge has none.',
    tf: 'No indexing, retrieval or embeddings.',
    anvil: 'BM25, symbols, import-graph PageRank, git co-change, test/docs companions and project rules under a token budget, with reasons shown.' },
  { area: 'Prompt cache', kind: 'uses', short: 'Cache-hit % shown live.',
    tf: 'Anthropic cache_control on by default; usage including cache reads in model.message.usage.',
    anvil: 'Shows input tokens and cache-hit % live on the context gauge (G1).' },
]

const kindLabel = { adds: 'Anvil adds', fills: 'Fills a gap', uses: 'Builds on it' } as const
const kindDot = { adds: 'bg-ember-500', fills: 'bg-rose-500', uses: 'bg-gray-400' } as const
const kindStyle = {
  adds: 'border-ember-100 bg-ember-50 text-ember-600',
  fills: 'border-rose-100 bg-rose-50 text-rose-700',
  uses: 'border-gray-200 bg-gray-50 text-gray-600',
} as const

export default function TrueForgeCompare() {
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const counts = (['adds', 'fills', 'uses'] as Kind[]).map((k) => [k, rows.filter((r) => r.kind === k).length] as const)
  const shown = filter === 'all' ? rows : rows.filter((r) => r.kind === filter)

  return (
    <section id="trueforge" className="py-20 md:py-28 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHead eyebrow="04 · TrueForge vs Anvil" title="What the harness gives. What we add." />

        {/* Composition bar: one segment per area */}
        <div className="mb-6" role="img" aria-label={`${rows.length} areas: ${counts.map(([k, n]) => `${n} ${kindLabel[k].toLowerCase()}`).join(', ')}`}>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5" aria-hidden>
            {counts.map(([k, n]) => <div key={k} className={kindDot[k]} style={{ flexGrow: n }} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setFilter('all')} aria-pressed={filter === 'all'}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>All {rows.length}</button>
            {counts.map(([k, n]) => (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
                <i className={`w-2 h-2 rounded-full ${kindDot[k]}`} />{kindLabel[k]} {n}
              </button>
            ))}
          </div>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((r, i) => (
            <motion.li key={r.area} layout
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.05, ease: EASE_OUT }}
              className="rounded-[1.5rem] border border-gray-100 bg-white p-5 hover:border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="text-base font-bold font-heading tracking-tight text-gray-900">{r.area}</h4>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${kindStyle[r.kind]}`}>{kindLabel[r.kind]}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{r.short}</p>
              <Disclosure label="Details" className="mt-3">
                <p><b className="text-gray-400 text-xs uppercase tracking-widest mr-1">TrueForge</b>{r.tf}</p>
                <p><b className="text-ember-600 text-xs uppercase tracking-widest mr-1">Anvil</b>{r.anvil}</p>
              </Disclosure>
            </motion.li>
          ))}
        </ul>

        <Disclosure label="Found along the way" className="mt-6">
          <p>TrueForge echoes reasoning back in assistant messages, which Groq rejects (<code className="font-mono text-xs">'reasoning_content' is unsupported</code>). Logged as a harness bug and an upstream PR candidate; those Groq runs are excluded from every number.</p>
        </Disclosure>
      </div>
    </section>
  )
}
