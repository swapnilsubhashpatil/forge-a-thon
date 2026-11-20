import { Reveal } from './Section'

const stats = [
  { value: '115', label: 'unit tests' },
  { value: '10 / 10', label: 'safety scenarios in real VS Code' },
  { value: '3 / 3', label: 'judging tasks pass live' },
  { value: '7', label: 'models tested' },
]

const models = ['Claude Sonnet 5.5', 'Claude Opus 5.5', 'Claude Haiku 5.5', 'GPT-6.1', 'GPT-5.4 mini', 'Qwen 3 8B', 'Qwen 3 4B']

export default function Receipts() {
  return (
    <section aria-label="Proof" className="border-y border-gray-100 bg-white px-5 py-12 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <dl className="grid grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-gray-100">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse px-2 text-center md:px-6">
              <dt className="mt-1 text-sm text-gray-500">{stat.label}</dt>
              <dd className="font-heading text-3xl font-semibold tracking-tighter text-gray-900 sm:text-4xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-sm text-gray-500">Tested with</span>
          {models.map((model) => (
            <span key={model} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
              {model}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
