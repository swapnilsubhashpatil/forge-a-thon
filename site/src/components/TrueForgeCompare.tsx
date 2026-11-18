import { motion } from 'framer-motion'
import { EASE_OUT } from '../motion'

type Row = { area: string; gloss: string; tf: string; anvil: string; kind: 'adds' | 'fills' | 'uses' }

// Sources: docs/claude-planning-session.md (TrueForge audit: docs + source at commit 3e8184b),
// conductor/tracks/t8-standout/agent-mode-handoff.md §7, agents/anvil-agent.json.
const rows: Row[] = [
  {
    area: 'Agent loop', gloss: 'model → tool call → result → repeat',
    tf: 'Runs the loop, sessions, streaming and history. Ends a turn as soon as the model replies with no tool call. Iteration limit 512 by default.',
    anvil: 'Uses TrueForge’s loop unchanged (inline agent spec, 60 iterations). Adds the phased prompt and the finish_task completion gate on top.',
    kind: 'uses',
  },
  {
    area: 'Editor tools', gloss: 'MCP: the standard way to give an agent tools',
    tf: 'MCP client over Streamable HTTP or SSE; no stdio. A network guard blocks localhost and private IPs by default.',
    anvil: 'Serves its editor tools from a loopback Streamable HTTP MCP server with a bearer token that rotates every start; documents the OUTBOUND_URL_ALLOWED_HOSTS allow-list.',
    kind: 'fills',
  },
  {
    area: 'Tool approval', gloss: 'pause the agent until a human says yes',
    tf: 'Per tool call: the turn pauses on tool.approval_required and you answer allow or deny with a reason.',
    anvil: 'Turns one approval into a per-hunk review in the editor. Partial accepts return the rejected patch plus the current text (M3), with scope and grounding badges.',
    kind: 'adds',
  },
  {
    area: 'Model failure', gloss: 'what happens when the provider is down',
    tf: '2 retries with backoff on timeouts, 429 and 5xx. Each agent uses the one model you configure; automatic model selection is only “planned”.',
    anvil: 'Fallback chain with a failure classifier and a circuit breaker (60 s cooldown): the next model reruns the same request, with the reason on screen.',
    kind: 'fills',
  },
  {
    area: 'Iteration limit', gloss: 'the cap on steps per turn',
    tf: 'Emits only “You have reached iteration limit… please request again”.',
    anvil: 'Treated as its own outcome (M10): no failover, a turn-budget hint from half way, and one wrap-up turn via finish_task.',
    kind: 'adds',
  },
  {
    area: 'Cancel', gloss: 'pressing Stop',
    tf: 'sessions.cancel() aborts the model call but waits for running MCP tools to finish.',
    anvil: 'Also denies pending approvals, discards open reviews and kills the command’s whole process tree, so nothing half-applied reaches disk.',
    kind: 'fills',
  },
  {
    area: 'Typing while it works', gloss: 'mid-turn messages',
    tf: 'One active turn per session; a new message cancels the running turn (“cancelled-for-next-turn”).',
    anvil: 'Queues the message and steers it into the next tool result (M11), or “Stop and send” on request.',
    kind: 'adds',
  },
  {
    area: 'Stuck agents', gloss: 'repeating the same call',
    tf: 'No stuck or loop detection.',
    anvil: 'Loop guard (M7): nudge at 3 repeats, stop at 5.',
    kind: 'adds',
  },
  {
    area: 'Subagents', gloss: 'helper agents with their own context',
    tf: 'On by default, run in parallel, one level deep, and share the parent’s tools, including writes.',
    anvil: 'Keeps them, but read-only (M2): write tools and nested subagents denied.',
    kind: 'uses',
  },
  {
    area: 'Compaction', gloss: 'summarising a long conversation to free space',
    tf: 'On by default at 80% of the context window; replaces the context with a summary.',
    anvil: 'Triggers earlier, at 60k input tokens (12k for local models), and marks each compaction on the context gauge.',
    kind: 'uses',
  },
  {
    area: 'Tool loading', gloss: 'deferred loading: tools discovered on demand',
    tf: 'MCP tools are deferred by default: the agent sees server names and calls list_tools / get_tool_info / call_tool.',
    anvil: 'Sets preloadTools in its agent spec for its own editor tools.',
    kind: 'uses',
  },
  {
    area: 'Retrieval', gloss: 'choosing which code the model sees',
    tf: 'None: no indexing, retrieval or embeddings.',
    anvil: 'The whole context pack: BM25, symbols, import-graph PageRank, git co-change, test/docs companions, project rules, all under a token budget, with reasons shown.',
    kind: 'fills',
  },
  {
    area: 'Prompt cache and usage', gloss: 'reusing the unchanged start of the prompt to save cost',
    tf: 'Anthropic cache_control on by default; per-call usage including cache reads in model.message.usage.',
    anvil: 'Shows input tokens and cache-hit % live on the context gauge (G1).',
    kind: 'uses',
  },
]

const kindLabel = { adds: 'Anvil adds', fills: 'Anvil fills a gap', uses: 'Anvil builds on it' } as const
const kindStyle = {
  adds: 'border-ember-100 bg-ember-50 text-ember-600',
  fills: 'border-rose-100 bg-rose-50 text-rose-700',
  uses: 'border-gray-200 bg-gray-50 text-gray-600',
} as const

export default function TrueForgeCompare() {
  return (
    <section id="trueforge" className="py-24 md:py-32 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-12 md:mb-16 gap-6">
          <div className="max-w-3xl">
            <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">04 · TrueForge vs Anvil</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">
              What the harness gives. What we add.
            </h3>
          </div>
          <p className="max-w-sm text-lg text-gray-500">
            TrueForge owns the agent loop. This is what it does out of the box (from its docs and source) and what Anvil puts around it.
          </p>
        </div>

        <div className="hidden lg:grid grid-cols-[0.9fr_1.3fr_1.5fr] gap-6 px-6 pb-3 text-xs font-bold tracking-widest uppercase text-gray-400">
          <span>Area</span><span>TrueForge out of the box</span><span>Anvil on top</span>
        </div>

        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <motion.div key={r.area}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: (i % 4) * 0.05, ease: EASE_OUT }}
              className="rounded-[1.5rem] border border-gray-100 bg-white p-5 sm:p-6 grid lg:grid-cols-[0.9fr_1.3fr_1.5fr] gap-3 lg:gap-6 hover:border-gray-200 hover:shadow-lg transition-all">
              <div>
                <h4 className="text-lg font-bold font-heading tracking-tight text-gray-900">{r.area}</h4>
                <p className="text-sm text-gray-500">{r.gloss}</p>
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">
                <span className="lg:hidden block text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-1">TrueForge</span>
                {r.tf}
              </div>
              <div className="text-sm text-gray-800 leading-relaxed">
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold mb-1.5 ${kindStyle[r.kind]}`}>{kindLabel[r.kind]}</span>
                <p>{r.anvil}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-sm text-gray-500 max-w-3xl">
          Found along the way: TrueForge echoes reasoning back in assistant messages, which Groq rejects
          (<code className="font-mono text-xs">'reasoning_content' is unsupported</code>). It is logged as a harness bug and a candidate upstream PR, and those Groq runs are excluded from the comparison.
        </p>
      </div>
    </section>
  )
}
