import { useState } from 'react'
import Logo from './Logo'
import { REPO_URL, TRUEFORGE_URL } from '../links'
import { Icon } from '../icons'
import { Link } from '../router'

const INSTALL = 'git clone https://github.com/swapnilsubhashpatil/forge-a-thon.git anvil && cd anvil && npm install && npm run build'

const columns: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: 'Docs',
    links: [
      { label: 'Getting started', to: '/docs/getting-started' },
      { label: 'Inline edit', to: '/docs/inline-edit' },
      { label: 'Agent mode', to: '/docs/agent-mode' },
      { label: 'Benchmarks', to: '/docs/benchmarks' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'Source on GitHub', to: REPO_URL, external: true },
      { label: 'Architecture', to: '/docs/architecture' },
    ],
  },
  {
    title: 'Built on',
    links: [
      { label: 'TrueForge', to: TRUEFORGE_URL, external: true },
      { label: 'Model Context Protocol', to: 'https://modelcontextprotocol.io', external: true },
      { label: 'Ollama', to: 'https://ollama.com', external: true },
    ],
  },
]

export default function Footer() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <footer className="bg-gray-950 px-5 pt-20 pb-10 sm:px-6 md:pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-white p-7 shadow-2xl sm:p-10 md:p-14">
          <div className="gap-10 lg:flex lg:items-end lg:justify-between">
            <div className="mb-8 lg:mb-0">
              <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tighter text-gray-900 sm:text-5xl">Try it on your own repo.</h2>
              <p className="mt-3 max-w-lg text-base text-gray-600 sm:text-lg">Clone, build, press F5. Your first reviewed edit is about five minutes away.</p>
            </div>
            <Link to="/docs/getting-started" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-7 py-4 text-base font-semibold text-white transition hover:bg-black sm:w-auto">
              Read the setup guide
              <Icon name="arrow" size={17} />
            </Link>
          </div>
          <button onClick={copy} className="group mt-8 flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-left font-mono text-xs text-gray-700 transition-colors hover:border-gray-300 sm:px-5 sm:text-sm">
            <span className="select-none text-ember-500">$</span>
            <span className="flex-1 truncate">{INSTALL}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 font-sans text-xs font-semibold text-gray-600 group-hover:text-gray-900">
              <Icon name={copied ? 'tick' : 'copy'} size={13} />
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-10 text-gray-400 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <span className="flex items-center gap-2 font-heading text-2xl font-bold tracking-tighter text-white">
              <Logo className="h-7 w-7" /> Anvil
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed">A VS Code coding agent on TrueForge.</p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-heading font-semibold tracking-tight text-white">{column.title}</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a href={link.to} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className="transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-2 border-t border-gray-800 pt-8 text-sm text-gray-500 md:flex-row">
          <p>MIT licensed.</p>
          <p>Forged on TrueForge. Reviewed by you.</p>
        </div>
      </div>
    </footer>
  )
}
