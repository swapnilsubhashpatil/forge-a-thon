import { motion } from 'framer-motion'
import Navbar from './Navbar'
import DemoPlayer from '../demo/Player'
import cloudBg from '../cloud-bg.jpg'
import { EASE_OUT } from '../motion'
import { REPO_URL, TRUEFORGE_URL } from '../links'
import { Icon } from '../icons'
import { Link } from '../router'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: EASE_OUT },
})

export default function Hero() {
  return (
    <main id="top" className="relative flex flex-col items-center overflow-hidden bg-white">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${cloudBg})` }} />
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-64 bg-gradient-to-t from-white to-transparent" />

      <Navbar />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center px-5 pt-32 pb-16 text-center sm:px-6 md:pt-40">
        <motion.a
          {...rise(0)}
          href={TRUEFORGE_URL}
          target="_blank"
          rel="noreferrer"
          className="group mb-7 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/50 px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/80"
        >
          Runs its agent loop on TrueForge
          <Icon name="arrow" size={15} className="transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <motion.h1 {...rise(0.08)} className="font-heading text-[2.6rem] leading-[1.05] font-semibold tracking-tighter text-gray-900 sm:text-6xl md:text-7xl lg:text-8xl">
          The coding agent
          <br />
          <span className="bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 bg-clip-text text-transparent">that shows its work.</span>
        </motion.h1>

        <motion.p {...rise(0.16)} className="mt-6 max-w-2xl text-base leading-relaxed font-medium text-gray-600 sm:text-lg md:text-xl">
          Anvil lives in VS Code. It shows you which files it picked and why, waits for your yes on every change, and keeps going when a model goes down.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Link
            to="/docs/getting-started"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_30px_-10px_rgba(17,24,39,0.6)] transition hover:bg-black active:scale-[0.98] sm:w-auto"
          >
            Get started
            <Icon name="arrow" size={17} />
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200/70 bg-white/60 px-7 py-3.5 text-base font-semibold text-gray-900 backdrop-blur-md transition hover:bg-white active:scale-[0.98] sm:w-auto"
          >
            <Icon name="github" size={17} />
            View the code
          </a>
        </motion.div>

        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: EASE_OUT }}
          className="mt-14 w-full scroll-mt-24 rounded-[1.4rem] border border-white/50 bg-white/30 p-2 shadow-[0_30px_80px_-30px_rgba(30,41,59,0.45)] backdrop-blur-2xl sm:mt-16 sm:p-3"
        >
          <DemoPlayer />
        </motion.div>
      </div>
    </main>
  )
}
