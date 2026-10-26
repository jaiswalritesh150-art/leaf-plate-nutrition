import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Status } from '../lib/api'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Buttons ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mango'
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-soft disabled:bg-line disabled:text-muted',
  secondary: 'bg-paper text-ink border border-line hover:border-moss hover:bg-white disabled:text-muted',
  ghost: 'text-moss-dark hover:bg-ink/5 disabled:text-muted',
  danger: 'bg-paper text-noshow-fg border border-noshow-fg/30 hover:bg-noshow-bg disabled:text-muted',
  mango: 'bg-mango text-ink hover:brightness-95 disabled:opacity-60',
}
export function Button({ variant = 'primary', loading, className, children, disabled, size = 'md', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
        size === 'md' ? 'min-h-12 px-6 text-base' : 'min-h-10 px-4 text-sm',
        variants[variant], className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* ---------- Form field ---------- */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode }) {
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? msgId : undefined })}
      {(error || hint) && (
        <p id={msgId} className={cx('mt-1.5 text-sm', error ? 'font-medium text-noshow-fg' : 'text-muted')} role={error ? 'alert' : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
export const inputCls = 'block min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-muted/70 aria-[invalid=true]:border-noshow-fg aria-[invalid=true]:bg-noshow-bg/30'

/* ---------- Status badge: colour + icon + word, never colour alone ---------- */
export const statusStyle: Record<Status, { cls: string; icon: ReactNode }> = {
  Booked: {
    cls: 'bg-booked-bg text-booked-fg',
    icon: <path d="M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />,
  },
  Done: { cls: 'bg-done-bg text-done-fg', icon: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
  'No-show': { cls: 'bg-noshow-bg text-noshow-fg', icon: <path d="M6 6l12 12M18 6L6 18" /> },
}
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = statusStyle[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', s.cls, className)}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
      {status}
    </span>
  )
}

export function Pill({ tone, children }: { tone: 'warn' | 'ok' | 'neutral'; children: ReactNode }) {
  const t = { warn: 'bg-warn-bg text-warn-fg', ok: 'bg-done-bg text-done-fg', neutral: 'bg-ink/8 text-ink' }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>
}

/* ---------- Banner / empty / error states ---------- */
export function Banner({ tone = 'error', children, action }: { tone?: 'error' | 'info' | 'success'; children: ReactNode; action?: ReactNode }) {
  const t = { error: 'bg-noshow-bg text-noshow-fg', info: 'bg-booked-bg text-booked-fg', success: 'bg-done-bg text-done-fg' }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium', t)}>
      <span>{children}</span>{action}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-paper/60 px-6 py-10 text-center">
      <h3 className="text-xl">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-ink/8', className)} aria-hidden="true" />
}

/* ---------- Modal (native <dialog>: focus trap + Escape for free) ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      aria-label={title}
      className={cx('pop m-auto w-[calc(100%-1.5rem)] rounded-3xl bg-paper p-0 text-body shadow-2xl backdrop:bg-ink/50', wide ? 'max-w-xl' : 'max-w-md')}
    >
      {open && (
        <div className="max-h-[88dvh] overflow-y-auto p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-2xl">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'error') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: 'ok' | 'error' }[]>([])
  const push = useCallback((msg: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, msg, tone }])
    window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('pop pointer-events-auto rounded-full px-5 py-3 text-sm font-semibold shadow-lg', t.tone === 'ok' ? 'bg-ink text-white' : 'bg-noshow-fg text-white')}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- tiny async hook ---------- */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, set] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    set((s) => ({ ...s, loading: true, error: undefined }))
    fn().then(
      (data) => alive && set({ data, loading: false }),
      (error) => alive && set({ error, loading: false }),
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}
