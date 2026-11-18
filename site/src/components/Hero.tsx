import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'
import Navbar from './Navbar'
import EditorDemo from './EditorDemo'
import cloudBg from '../cloud-bg.jpg'
import { EASE_OUT, scrollToId } from '../motion'
import { REPO_URL } from '../links'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: EASE_OUT },
})

export default function Hero() {
  // Subtle 3D tilt of the preview window that follows the pointer
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 20 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 120, damping: 20 })

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }

  return (
    <main id="top" className="relative flex flex-col items-center justify-start min-h-screen bg-white overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${cloudBg})` }} />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

      <Navbar />

      <div className="relative z-10 flex flex-col items-center justify-center flex-grow w-full max-w-5xl px-6 pt-32 pb-20 mt-10 text-center">
        <motion.a
          {...rise(0)}
          href="https://trueforge.dev"
          target="_blank"
          rel="noreferrer"
          className="group mb-8 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-xs sm:text-sm font-medium text-gray-700 backdrop-blur-xl shadow-sm hover:bg-white/70 transition-colors"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ember-500" />
          </span>
          Agent loop powered by TrueForge
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <motion.div {...rise(0.1)}>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-semibold tracking-tighter text-gray-900 leading-[1.1]">
            The coding agent <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500">
              that shows its work.
            </span>
          </h1>
        </motion.div>

        <motion.div {...rise(0.2)} className="mt-8 max-w-2xl">
          <p className="text-lg md:text-xl text-gray-600 font-medium leading-relaxed tracking-tight">
            Anvil is a VS Code extension that tells you which files it read and why, lets you accept or reject
            every hunk before anything touches disk, and switches models when one fails.
          </p>
        </motion.div>

        <motion.div {...rise(0.3)} className="flex flex-col sm:flex-row items-center gap-4 mt-12 w-full justify-center">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center w-full sm:w-auto px-8 py-4 text-base font-semibold text-white transition-all duration-300 bg-black rounded-full hover:bg-gray-900 hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl"
          >
            Install the extension
            <ArrowRight className="w-4 h-4 ml-2" />
          </a>
          <button
            onClick={() => scrollToId('before-after')}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 text-base font-semibold text-gray-900 transition-all duration-300 bg-white/50 border border-gray-200/50 rounded-full hover:bg-white/80 backdrop-blur-md active:scale-95"
          >
            <Play className="w-4 h-4" /> See before vs after
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: EASE_OUT }}
          onPointerMove={onMove}
          onPointerLeave={() => { mx.set(0); my.set(0) }}
          className="w-full max-w-5xl mt-20 [perspective:1400px]"
        >
          <motion.div
            style={{ rotateX, rotateY }}
            className="relative p-2 sm:p-3 bg-white/20 backdrop-blur-2xl border border-white/40 rounded-3xl shadow-2xl"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 to-transparent mix-blend-overlay pointer-events-none" />
            <EditorDemo />
          </motion.div>
        </motion.div>
      </div>
    </main>
  )
}
