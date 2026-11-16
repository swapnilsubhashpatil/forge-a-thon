import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'

const faqs = [
  ['Which models does Anvil work with?', 'Anything TrueForge can serve: OpenAI, Anthropic or Gemini with an API key, or a local Ollama model with tool calling. You set an ordered chain, for example a hosted primary, a fallback from another provider, and a local model as the last resort.'],
  ['Does my code leave my machine?', 'Ranking, the repo map and the MCP tool server all run locally. TrueForge runs in local mode. The only outbound traffic is to the model provider you choose, and with Ollama there is none.'],
  ['Is it a fork of Cline, Continue or Roo Code?', 'No. Anvil is a new extension. The agent loop is entirely TrueForge’s. The panel’s interaction ideas (compact activity rows, inline review) are inspired by Kilo Code and Cursor, but no upstream code is copied.'],
  ['What happens if I reject part of an edit?', 'The accepted hunks are applied, and the rejected patch goes back to the model as the tool result, so it knows exactly what you didn’t want. Reject everything and the model receives a deny with your reason.'],
  ['Why no embeddings?', 'Context is ranked with lexical and structural signals (BM25, symbols, import-graph PageRank). It is fast, deterministic, needs no extra model calls, and scores recall@5 = 1.00 on the Flask benchmark.'],
  ['Which languages are supported?', 'Any language works for search and editing. Python and JS/TS also get symbol outlines and import-graph ranking; other languages are ranked by text and path.'],
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="py-24 md:py-32 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20">
        <div>
          <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">FAQ</h2>
          <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 tracking-tighter leading-tight">Questions, answered.</h3>
          <p className="mt-6 text-lg text-gray-500 max-w-sm">Still curious? The architecture notes and benchmarks are in the repo’s <code className="font-mono text-sm">docs/</code> folder.</p>
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
