import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger, prefersReducedMotion, scrollToId, setLenis } from './motion'
import { usePath } from './router'
import Hero from './components/Hero'
import Receipts from './components/Receipts'
import Benchmarks from './components/Benchmarks'
import FeatureFilms from './components/FeatureFilms'
import Architecture from './components/Architecture'
import FAQ from './components/FAQ'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import Docs from './docs/Docs'

function Landing() {
  useEffect(() => {
    document.title = 'Anvil · the coding agent that shows its work'
    const hash = window.location.hash.slice(1)
    if (hash) setTimeout(() => scrollToId(hash), 80)
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
    <>
      <ScrollProgress />
      <Hero />
      <Receipts />
      <Benchmarks />
      <FeatureFilms />
      <Architecture />
      <FAQ />
      <Footer />
    </>
  )
}

export default function App() {
  const path = usePath()
  return (
    <div className="tracking-tight text-gray-900 antialiased selection:bg-black selection:text-white">
      {path.startsWith('/docs') ? <Docs path={path} /> : <Landing />}
    </div>
  )
}
