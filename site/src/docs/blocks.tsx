import type { ReactNode } from 'react'
import DemoPlayer from '../demo/Player'
import { films } from '../demo/films'
import type { ChapterId } from '../demo/script'

export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-12 mb-3 font-heading text-2xl font-semibold tracking-tight text-gray-900 first:mt-0">{children}</h2>
)

export const P = ({ children }: { children: ReactNode }) => <p className="my-4 leading-7 text-gray-700">{children}</p>

export const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[0.88em] text-gray-900">{children}</code>
)

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded-md border border-gray-200 border-b-2 bg-white px-1.5 py-0.5 font-mono text-[0.82em] text-gray-800">{children}</kbd>
)

export const Pre = ({ children }: { children: string }) => (
  <pre className="my-5 overflow-x-auto rounded-2xl bg-gray-950 p-5 font-mono text-sm leading-6 text-gray-100">
    <code>{children}</code>
  </pre>
)

export const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="my-6 space-y-4">
    {items.map((item, i) => (
      <li key={i} className="flex gap-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gray-900 font-mono text-xs text-white">{i + 1}</span>
        <div className="pt-0.5 leading-7 text-gray-700">{item}</div>
      </li>
    ))}
  </ol>
)

export const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="my-4 space-y-2">
    {items.map((item, i) => (
      <li key={i} className="flex gap-3 leading-7 text-gray-700">
        <span className="mt-[13px] h-0.5 w-3 shrink-0 rounded-full bg-ember-500" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
)

export const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="my-6 overflow-x-auto rounded-2xl border border-gray-200">
    <table className="w-full min-w-[520px] text-left text-sm">
      <thead className="bg-gray-50 text-gray-500">
        <tr>
          {head.map((cell) => (
            <th key={cell} className="px-4 py-3 font-medium">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-3 align-top leading-6 text-gray-700">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const Note = ({ children }: { children: ReactNode }) => (
  <div className="my-6 rounded-2xl border border-ember-100 bg-ember-50/60 px-5 py-4 leading-7 text-gray-800">{children}</div>
)

export const Demo = ({ chapter, film, caption }: { chapter?: ChapterId; film?: keyof typeof films; caption: string }) => (
  <div className="my-8">
    <DemoPlayer film={film ? films[film] : undefined} only={film ? undefined : chapter} label={caption} />
  </div>
)
