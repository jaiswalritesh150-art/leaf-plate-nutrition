import { createContext, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api, onWaking, type Config } from '../lib/api'
import { clearIdentity, getIdentity, setIdentity, type Identity } from '../lib/identity'
import { Banner, cx, ToastProvider } from '../components/ui'

interface Ctx {
  config: Config | undefined
  identity: Identity | null
  remember: (i: Identity) => void
  forget: () => void
}
const ClientCtx = createContext<Ctx>({ config: undefined, identity: null, remember: () => {}, forget: () => {} })
export const useClient = () => useContext(ClientCtx)

const icons = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  book: <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM12 12v5M9.5 14.5h5" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
}
const links = [
  { to: '/', label: 'Home', icon: icons.home, end: true },
  { to: '/book', label: 'Book', icon: icons.book },
  { to: '/appointments', label: 'My visits', icon: icons.list },
]

export function ClientApp() {
  const [config, setConfig] = useState<Config>()
  const [identity, setId] = useState<Identity | null>(getIdentity())
  const [waking, setWaking] = useState(false)
  const [configError, setConfigError] = useState(false)

  useEffect(() => { onWaking(setWaking) }, [])
  const loadConfig = () => { setConfigError(false); api.config().then(setConfig).catch(() => setConfigError(true)) }
  useEffect(loadConfig, [])

  const value: Ctx = {
    config, identity,
    remember: (i) => { setIdentity(i); setId(i) },
    forget: () => { clearIdentity(); setId(null) },
  }
  const clinic = config?.clinic_name ?? import.meta.env.VITE_CLINIC_NAME ?? 'Leaf & Plate Nutrition'

  return (
    <ClientCtx.Provider value={value}>
      <ToastProvider>
        <div className="mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row lg:gap-10 lg:px-8">
          {/* desktop side rail */}
          <aside className="hidden w-60 shrink-0 flex-col py-10 lg:flex">
            <Wordmark name={clinic} />
            <nav className="mt-10 flex flex-col gap-1" aria-label="Main">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold', isActive ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5')}>
                  <Icon>{l.icon}</Icon>{l.label}
                </NavLink>
              ))}
            </nav>
            <a href="/dashboard" className="mt-auto rounded-2xl px-4 py-3 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">Nutritionist dashboard</a>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] lg:hidden">
              <Wordmark name={clinic} />
              <a href="/dashboard" className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-ink">Dashboard</a>
            </header>

            <main className="flex-1 px-5 pb-32 pt-4 lg:px-0 lg:pb-16 lg:pt-10">
              {waking && <div className="mb-4"><Banner tone="info">Waking up the booking server — free hosting sleeps when idle. This can take up to a minute the first time.</Banner></div>}
              {configError && <div className="mb-4"><Banner action={<button className="font-bold underline" onClick={loadConfig}>Try again</button>}>We couldn't reach the booking server.</Banner></div>}
              <Outlet />
            </main>
          </div>
        </div>

        {/* mobile tab bar */}
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-3">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={({ isActive }) => cx('flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold', isActive ? 'text-ink' : 'text-muted')}>
                  {({ isActive }) => (<>
                    <span className={cx('grid h-8 w-14 place-items-center rounded-full', isActive && 'bg-mango')}><Icon>{l.icon}</Icon></span>
                    {l.label}
                  </>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </ToastProvider>
    </ClientCtx.Provider>
  )
}

function Icon({ children }: { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

export function Wordmark({ name }: { name: string }) {
  return (
    <a href="/" className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink" aria-hidden="true">
        <svg viewBox="0 0 32 32" className="h-6 w-6"><path d="M7 24c0-9 6-15 17-15 0 9-6 15-17 15z" fill="#f2b544" /></svg>
      </span>
      <span className="font-display text-lg leading-tight text-ink">{name}</span>
    </a>
  )
}
