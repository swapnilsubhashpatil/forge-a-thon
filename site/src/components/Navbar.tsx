import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { scrollToId } from '../motion'
import { REPO_URL } from '../links'

const navItems = [
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'faq', label: 'FAQ' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    navItems.forEach(({ id }) => { const el = document.getElementById(id); if (el) io.observe(el) })
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect() }
  }, [])

  const go = (id: string) => { setOpen(false); scrollToId(id) }
  const pill = hovered ?? active

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center py-4 px-4 pointer-events-none">
      <nav
        className={`pointer-events-auto flex items-center justify-between w-full max-w-5xl px-6 py-3 backdrop-blur-2xl border rounded-full transition-all duration-500 ${
          scrolled ? 'bg-white/70 border-gray-200/70 shadow-lg shadow-black/[0.04]' : 'bg-white/20 border-white/40 shadow-sm'
        }`}
      >
        <a href="#top" onClick={(e) => { e.preventDefault(); scrollToId('top') }} className="flex items-center gap-2 z-10 group">
          <motion.span whileHover={{ rotate: -12 }} transition={{ type: 'spring', stiffness: 300 }} className="text-gray-900">
            <Logo />
          </motion.span>
          <span className="text-xl font-heading font-bold tracking-tighter text-black drop-shadow-sm">Anvil.</span>
        </a>

        <div className="hidden md:flex items-center gap-1 relative z-10" onMouseLeave={() => setHovered(null)}>
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => { e.preventDefault(); go(item.id) }}
              onMouseEnter={() => setHovered(item.id)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 tracking-tight ${
                active === item.id ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {pill === item.id && (
                <motion.div
                  layoutId="navbar-pill"
                  className="absolute inset-0 bg-gray-200/60 rounded-full -z-10"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 z-10">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-white transition-all duration-200 bg-gray-900 rounded-full hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
          >
            Get Anvil
          </a>
          <button
            className="md:hidden p-2 text-gray-700 bg-gray-100/50 rounded-full hover:bg-gray-200/50 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/95 backdrop-blur-md z-40 pointer-events-auto md:hidden pt-28 px-6"
          >
            <div className="flex flex-col gap-6 items-center w-full">
              {navItems.map((item, i) => (
                <motion.a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => { e.preventDefault(); go(item.id) }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="text-2xl font-semibold tracking-tight text-gray-800"
                >
                  {item.label}
                </motion.a>
              ))}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="mt-4 px-8 py-3 text-lg font-medium text-center text-white bg-gray-900 rounded-full w-full max-w-xs shadow-lg">
                Get Anvil
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
