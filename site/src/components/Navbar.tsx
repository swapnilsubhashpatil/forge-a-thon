import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Logo from './Logo'
import { scrollToId } from '../motion'
import { REPO_URL } from '../links'
import { Icon } from '../icons'
import { Link, navigate } from '../router'

const sections = [
  { id: 'demo', label: 'Demo' },
  { id: 'results', label: 'Results' },
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (id: string) => {
    setOpen(false)
    if (window.location.pathname !== '/') {
      navigate('/')
      setTimeout(() => scrollToId(id), 60)
    } else scrollToId(id)
  }

  return (
    <header className="pointer-events-none fixed top-0 right-0 left-0 z-50 flex justify-center px-3 py-3 sm:px-4 sm:py-4">
      <nav
        className={`pointer-events-auto flex w-full max-w-6xl items-center justify-between rounded-full border px-4 py-2.5 backdrop-blur-2xl transition-all duration-500 sm:px-6 sm:py-3 ${
          scrolled ? 'border-gray-200/70 bg-white/75 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]' : 'border-white/40 bg-white/25 shadow-sm'
        }`}
      >
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 text-gray-900">
          <Logo />
          <span className="font-heading text-xl font-bold tracking-tighter">Anvil</span>
        </Link>

        <div className="relative hidden items-center gap-1 md:flex" onMouseLeave={() => setHovered(null)}>
          {sections.map((item) => (
            <a
              key={item.id}
              href={`/#${item.id}`}
              onClick={(event) => {
                event.preventDefault()
                go(item.id)
              }}
              onMouseEnter={() => setHovered(item.id)}
              className="relative px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {hovered === item.id && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-gray-200/60" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link to="/docs" className="hidden items-center gap-1.5 rounded-full border border-gray-300/80 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:border-gray-400 hover:bg-white md:inline-flex">
            <Icon name="book" size={15} />
            Docs
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Anvil on GitHub" className="hidden size-9 place-items-center rounded-full text-gray-700 transition hover:bg-gray-200/60 md:grid">
            <Icon name="github" size={18} />
          </a>
          <Link to="/docs/getting-started" className="hidden rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-black md:inline-flex">
            Get started
          </Link>
          <button className="grid size-9 place-items-center rounded-full bg-gray-100/60 text-gray-700 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
            <Icon name={open ? 'close' : 'menu'} size={18} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-auto fixed inset-0 z-40 bg-white/95 px-6 pt-24 backdrop-blur-md md:hidden">
            <div className="flex flex-col gap-1">
              {sections.map((item) => (
                <button key={item.id} onClick={() => go(item.id)} className="rounded-xl px-3 py-3 text-left text-2xl font-semibold tracking-tight text-gray-900">
                  {item.label}
                </button>
              ))}
              <Link to="/docs" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-2xl font-semibold tracking-tight text-gray-900">
                Docs
              </Link>
              <Link to="/docs/getting-started" onClick={() => setOpen(false)} className="mt-6 rounded-full bg-gray-900 px-8 py-3.5 text-center text-lg font-medium text-white">
                Get started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
