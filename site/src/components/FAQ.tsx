import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'

const faqs = [
  ['What do “before” and “after” mean on this page?', 'Before is the main branch: Anvil as it first passed the three fixed tasks. After is the agent-mode branch. The same end-to-end suite drove both builds on Flask 3.1.3, with every model whose provider answered (Claude Haiku, Sonnet and Opus 5.5, GPT-5.4-mini, GPT-6.1-sol and two local Ollama models), 2 runs each.'],
  ['If pass rates barely changed, what improved?', 'How the agent finishes. On main, 11 of 14 Task B runs ended with edits that were never tested and none could prove they worked. On the branch, 0 of 14 end untested, every passing run finishes with a check that passed after the last edit, failed test runs fell from 3.1 to 0.3 per run, and input tokens fell 27%.'],
  ['Which models does Anvil work with?', 'Anything TrueForge can serve: OpenAI, Anthropic or Gemini with an API key, or a local Ollama model with tool calling. You set an ordered chain, for example a hosted primary, a fallback from another provider, and a local model as the last resort. Small local models (7–8B) do not yet complete the fixed tasks on either build.'],
  ['Does my code leave my machine?', 'Ranking, the repo map and the MCP tool server all run locally. TrueForge runs in local mode. The only outbound traffic is to the model provider you choose, and with Ollama there is none.'],
  ['Is it a fork of Cline, Continue or Roo Code?', 'No. Anvil is a new extension. The agent loop is entirely TrueForge’s. The panel’s interaction ideas (compact activity rows, inline review) are inspired by Kilo Code and Cursor, but no upstream code is copied.'],
  ['What happens if I reject part of an edit?', 'The accepted hunks are applied. The model is told they are already written, that the rejection was your decision and not a tool failure, and gets the current text around the change as its new baseline. Reject everything and the model receives a deny with your reason.'],
  ['Why no embeddings?', 'Context is ranked with lexical and structural signals (BM25, symbols, import-graph PageRank, git co-change). It is fast, deterministic and needs no extra model calls. On 103 held-out Flask commits a right file lands in the top five 85.4% of the time, against 69.9% for BM25 alone.'],
  ['Which languages are supported?', 'Any language works for search and editing. Python and JS/TS also get symbol outlines and import-graph ranking; other languages are ranked by text and path. All benchmarks so far are on one Python repository.'],
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20">
        <div>
          <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">FAQ</h2>
          <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">Questions, answered.</h3>
          <p className="mt-6 text-lg text-gray-500 max-w-sm">Still curious? The architecture notes and write-up are in the repo’s <code className="font-mono text-sm">docs/</code> folder.</p>
        </div>
        <div className="flex flex-col gap-3">
          {faqs.map(([q, a], i) => {
            const isOpen = open === i
            return (
              <div key={q} className={`rounded-3xl border transition-colors duration-300 ${isOpen ? 'bg-white border-gray-200 shadow-sm' : 'bg-white/50 border-gray-100 hover:bg-white'}`}>
                <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="w-full flex items-center justify-between gap-6 px-6 py-5 text-left">
                  <span className="text-lg font-semibold text-gray-900 tracking-tight">{q}</span>
                  <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isOpen ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    <Plus className="w-4 h-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <p className="px-6 pb-6 text-gray-500 leading-relaxed">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
