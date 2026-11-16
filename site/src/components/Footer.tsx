import { useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Check, Copy, Github } from 'lucide-react'
import Logo from './Logo'
import { scrollToId } from '../motion'
import { REPO_URL, TRUEFORGE_URL } from '../links'

const INSTALL = 'git clone https://github.com/swapnilsubhashpatil/forge-a-thon.git anvil && cd anvil && npm install && npm run build'

export default function Footer() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const bigX = useTransform(scrollYProgress, [0, 1], ['-8%', '0%'])
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(INSTALL); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }

  return (
    <footer ref={ref} className="bg-gray-900 pt-24 pb-12 overflow-hidden relative">
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none overflow-hidden select-none z-0">
        <motion.span style={{ x: bigX }} className="text-[22vw] font-black text-gray-800/40 font-heading tracking-tighter uppercase whitespace-nowrap">
          Anvil.
        </motion.span>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="bg-white rounded-[3rem] p-8 sm:p-10 md:p-16 mb-24 shadow-2xl">
          <div className="lg:flex lg:items-end lg:justify-between gap-10">
            <div className="lg:w-2/3 mb-10 lg:mb-0">
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-heading font-bold text-gray-900 tracking-tighter leading-tight mb-4">Ready to forge?</h2>
              <p className="text-xl text-gray-600 max-w-lg">Clone it, point it at a TrueForge harness, and review your first agent edit hunk by hunk.</p>
            </div>
            <a href={REPO_URL} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 bg-gray-900 text-white px-8 py-5 rounded-full font-bold text-lg hover:bg-black hover:scale-105 active:scale-95 transition-all w-full sm:w-auto justify-center shadow-lg">
              View on GitHub <ArrowRight className="w-5 h-5" />
            </a>
          </div>
          <button onClick={copy} className="group mt-10 w-full flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-5 py-4 text-left font-mono text-xs sm:text-sm text-gray-700 hover:border-gray-300 transition-colors">
            <span className="text-ember-500 select-none">$</span>
            <span className="truncate flex-1">{INSTALL}</span>
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3 py-1 font-sans text-xs font-semibold text-gray-600 group-hover:text-gray-900">
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 lg:gap-8 mb-16 text-gray-400">
          <div className="col-span-2 md:col-span-1">
            <span className="flex items-center gap-2 text-3xl font-heading font-bold tracking-tighter text-white mb-6"><Logo className="w-7 h-7" /> Anvil.</span>
            <p className="mb-6 leading-relaxed max-w-sm">A VS Code coding agent on TrueForge.</p>
            <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 font-heading tracking-tight">Product</h4>
            <ul className="space-y-4">
              {[['before-after', 'Before / After'], ['benchmarks', 'Results'], ['trueforge', 'vs TrueForge'], ['limits', 'Limits'], ['how', 'How it works'], ['faq', 'FAQ']].map(([id, l]) => (
                <li key={id}><a href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToId(id) }} className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 font-heading tracking-tight">Docs</h4>
            <ul className="space-y-4">
              <li><a href={`${REPO_URL}/blob/main/docs/architecture.md`} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Architecture</a></li>
              <li><a href={`${REPO_URL}/tree/main/docs/benchmarks`} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Benchmarks</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 font-heading tracking-tight">Built on</h4>
            <ul className="space-y-4">
              <li><a href={TRUEFORGE_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">TrueForge</a></li>
              <li><a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Model Context Protocol</a></li>
              <li><a href="https://ollama.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Ollama</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 gap-2">
          <p>&copy; {new Date().getFullYear()} Anvil. MIT licensed.</p>
          <p>Forged on TrueForge. Reviewed by you.</p>
        </div>
      </div>
    </footer>
  )
}
