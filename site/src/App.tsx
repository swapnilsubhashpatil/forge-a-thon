import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger, prefersReducedMotion, setLenis } from './motion'
import Hero from './components/Hero'
import Stack from './components/Stack'
import Stats from './components/Stats'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import Benchmarks from './components/Benchmarks'
import FAQ from './components/FAQ'
import Problem from './components/Problem'
import BeforeAfter from './components/BeforeAfter'
import TrueForgeCompare from './components/TrueForgeCompare'
import Limits from './components/Limits'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'

export default function App() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    setLenis(lenis)
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      setLenis(null)
    }
  }, [])

  return (
    <div className="tracking-tight antialiased text-gray-900 selection:bg-black selection:text-white">
      <ScrollProgress />
      <Hero />
      <Stack />
      <Stats />
      <Problem />
      <BeforeAfter />
      <Benchmarks />
      <TrueForgeCompare />
      <Limits />
      <HowItWorks />
      <Features />
      <FAQ />
      <Footer />
    </div>
  )
}
