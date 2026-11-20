import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT } from '../motion'

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Section({ id, title, description, children, className = 'bg-white' }: { id: string; title: ReactNode; description: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 px-5 py-20 sm:px-6 md:py-28 ${className}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tighter text-gray-900 sm:text-4xl md:text-5xl">{title}</h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">{description}</p>
        </Reveal>
        {children}
      </div>
    </section>
  )
}
