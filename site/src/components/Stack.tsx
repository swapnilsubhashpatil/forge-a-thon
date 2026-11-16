const stack = [
  'TrueForge 0.185', 'Model Context Protocol', 'VS Code Extension API', 'Claude Sonnet 5.5', 'Ollama · Qwen 3',
  'React 19', 'Vite', 'Tailwind CSS 4', 'jsdiff', 'esbuild', 'BM25', 'PageRank', 'ripgrep', 'TypeScript',
]

export default function Stack() {
  const row = [...stack, ...stack]
  return (
    <section aria-label="Built with" className="relative bg-white py-14 border-y border-gray-100">
      <p className="text-center text-xs font-bold tracking-widest text-gray-400 uppercase mb-8">Built on an open, local-first stack</p>
      <div className="marquee relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track flex w-max gap-3">
          {row.map((s, i) => (
            <span key={i} className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-white transition-colors">
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
