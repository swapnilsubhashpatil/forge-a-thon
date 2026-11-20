import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons'
import { Section } from './Section'

const faqs = [
  ['Which models can I use?', 'Any model TrueForge can serve: OpenAI, Anthropic, Gemini and others from its catalog, or anything with an OpenAI-compatible API, including a local Ollama model. You add them in Anvil’s settings and put them in the order you want.'],
  ['Does my code leave my machine?', 'Ranking, the repository map and the editor tools all run locally. The only code that leaves your machine is what the model needs to see, sent to the provider you chose. With a local model, nothing leaves.'],
  ['What if I only want part of an edit?', 'Keep the hunks you like and reject the rest. Anvil applies the ones you kept and tells the model exactly what you turned down, so its next try starts from your version.'],
  ['How do I undo a change?', 'Hover any message and choose Revert. You can rewind the conversation, the code, or both. Undo history survives a window reload.'],
  ['Is it a fork of another extension?', 'No. Anvil is written from scratch for this project. TrueForge runs the agent loop; Anvil adds the context, the review experience and the safety rules around it.'],
  ['Which languages does it understand?', 'Every language works for search, mentions and edits. Python and JavaScript or TypeScript also get symbol outlines and import ranking for sharper context.'],
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <Section id="faq" title="Questions, answered." description="The short version. The docs cover each part in depth.">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {faqs.map(([question, answer], i) => {
          const isOpen = open === i
          return (
            <div key={question} className={`rounded-2xl border transition-colors duration-300 ${isOpen ? 'border-gray-200 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.3)]' : 'border-gray-100 bg-gray-50/60 hover:bg-white'}`}>
              <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-6 px-5 py-4 text-left sm:px-6 sm:py-5">
                <span className="text-base font-semibold tracking-tight text-gray-900 sm:text-lg">{question}</span>
                <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className={`grid size-8 shrink-0 place-items-center rounded-full ${isOpen ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>
                  <Icon name="close" size={14} className="rotate-45" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    <p className="px-5 pb-5 leading-relaxed text-gray-600 sm:px-6 sm:pb-6">{answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
