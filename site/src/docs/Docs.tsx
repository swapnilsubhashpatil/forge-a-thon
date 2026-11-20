import { useEffect, useState } from 'react'
import Logo from '../components/Logo'
import { REPO_URL } from '../links'
import { Icon } from '../icons'
import { Link } from '../router'
import { pages } from './pages'

const groups = [...new Set(pages.map((page) => page.group))]
const href = (slug: string) => (slug ? `/docs/${slug}` : '/docs')

function Sidebar({ current, onPick }: { current: string; onPick?: () => void }) {
  return (
    <nav aria-label="Documentation" className="space-y-7">
      {groups.map((group) => (
        <div key={group}>
          <p className="px-3 text-sm font-semibold text-gray-900">{group}</p>
          <ul className="mt-2 space-y-0.5">
            {pages
              .filter((page) => page.group === group)
              .map((page) => {
                const active = page.slug === current
                return (
                  <li key={page.slug}>
                    <Link
                      to={href(page.slug)}
                      onClick={onPick}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-1.5 text-[15px] transition-colors ${active ? 'bg-gray-900 font-medium text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                      {page.title}
                    </Link>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export default function Docs({ path }: { path: string }) {
  const slug = path.replace(/^\/docs\/?/, '').replace(/\/$/, '')
  const index = Math.max(0, pages.findIndex((page) => page.slug === slug))
  const page = pages[index]
  const prev = pages[index - 1]
  const next = pages[index + 1]
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    document.title = `${page.title} · Anvil docs`
  }, [page.title])

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-gray-900">
              <Logo />
              <span className="font-heading text-xl font-bold tracking-tighter">Anvil</span>
            </Link>
            <span className="text-gray-300">/</span>
            <Link to="/docs" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Docs
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Anvil on GitHub" className="grid size-9 place-items-center rounded-full text-gray-700 hover:bg-gray-100">
              <Icon name="github" size={18} />
            </a>
            <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Pages" className="grid size-9 place-items-center rounded-full text-gray-700 hover:bg-gray-100 lg:hidden">
              <Icon name={menu ? 'close' : 'menu'} size={18} />
            </button>
          </div>
        </div>
        {menu && (
          <div className="max-h-[70vh] overflow-y-auto border-t border-gray-100 bg-white px-3 py-5 lg:hidden">
            <Sidebar current={page.slug} onPick={() => setMenu(false)} />
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-7xl gap-12 px-5 sm:px-6">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto py-10 lg:block">
          <Sidebar current={page.slug} />
        </aside>

        <main className="min-w-0 flex-1 py-10 lg:py-14">
          <article className="mx-auto max-w-3xl">
            <h1 className="font-heading text-4xl font-semibold tracking-tighter text-gray-900 sm:text-5xl">{page.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-gray-600">{page.description}</p>
            <div className="mt-10 text-[16px]">{page.body}</div>

            <div className="mt-16 grid grid-cols-1 gap-3 border-t border-gray-100 pt-8 sm:grid-cols-2">
              {prev ? (
                <Link to={href(prev.slug)} className="group rounded-2xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm">
                  <span className="text-sm text-gray-500">Previous</span>
                  <span className="mt-1 block font-semibold text-gray-900">{prev.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link to={href(next.slug)} className="group rounded-2xl border border-gray-200 p-4 text-right transition hover:border-gray-300 hover:shadow-sm">
                  <span className="text-sm text-gray-500">Next</span>
                  <span className="mt-1 flex items-center justify-end gap-1.5 font-semibold text-gray-900">
                    {next.title}
                    <Icon name="arrow" size={15} />
                  </span>
                </Link>
              )}
            </div>
          </article>
        </main>
      </div>
    </div>
  )
}
