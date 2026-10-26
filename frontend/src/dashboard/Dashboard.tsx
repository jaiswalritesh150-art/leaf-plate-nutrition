import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, onWaking, setAdminPasscode, type Appointment, type Config, type Status, type Summary } from '../lib/api'
import { numericDate, prettyDate, prettyTime, formatPhoneInput } from '../lib/format'
import { Banner, Button, Empty, Field, Modal, Pill, Skeleton, ToastProvider, cx, inputCls, statusStyle, useToast } from '../components/ui'
import { Wordmark } from '../client/ClientApp'
import { AddDialog, MoveDialog } from './Dialogs'

type Range = 'today' | 'upcoming' | 'past' | 'all'
const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: "Today" }, { id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }, { id: 'all', label: 'All' },
]
const STATUSES: Status[] = ['Booked', 'Done', 'No-show']

export function Dashboard() {
  const [config, setConfig] = useState<Config>()
  const [locked, setLocked] = useState(false)
  const [fatal, setFatal] = useState<string>()
  const [waking, setWaking] = useState(false)

  useEffect(() => { onWaking(setWaking) }, [])
  const boot = useCallback(() => {
    setFatal(undefined)
    api.config().then(setConfig).catch((e) => setFatal(e.message))
    api.admin.session().then(() => setLocked(false)).catch((e: ApiError) => (e.status === 401 ? setLocked(true) : undefined))
  }, [])
  useEffect(boot, [boot])

  return (
    <ToastProvider>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-4">
            <Wordmark name={config?.clinic_name ?? 'Leaf & Plate Nutrition'} />
            <span className="hidden rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white sm:inline">Nutritionist dashboard</span>
          </div>
          <a href="/" className="rounded-full px-3 py-2 text-sm font-semibold text-moss-dark underline underline-offset-4">Open client app</a>
        </header>
        {waking && <div className="mb-4"><Banner tone="info">Waking up the booking server — free hosting sleeps when idle. This can take up to a minute the first time.</Banner></div>}
        {fatal && <Banner action={<button className="font-bold underline" onClick={boot}>Try again</button>}>{fatal}</Banner>}
        {locked ? <Passcode onOk={boot} /> : config && <Board config={config} onLocked={() => setLocked(true)} />}
      </div>
    </ToastProvider>
  )
}

function Passcode({ onOk }: { onOk: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string>()
  async function go(e: React.FormEvent) {
    e.preventDefault(); setAdminPasscode(code)
    try { await api.admin.session(); onOk() } catch (x) { setErr((x as ApiError).message) }
  }
  return (
    <form onSubmit={go} className="mx-auto mt-16 max-w-sm space-y-4 rounded-3xl bg-paper p-6 ring-1 ring-line">
      <h1 className="text-3xl">Dashboard passcode</h1>
      <Field label="Passcode" error={err}>{(p) => <input {...p} type="password" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}</Field>
      <Button type="submit" className="w-full">Open dashboard</Button>
    </form>
  )
}

function Board({ config, onLocked }: { config: Config; onLocked: () => void }) {
  const toast = useToast()
  const [range, setRange] = useState<Range>('today')
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [rows, setRows] = useState<Appointment[]>()
  const [summary, setSummary] = useState<Summary>()
  const [error, setError] = useState<string>()
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState<Appointment>()
  const [cancelling, setCancelling] = useState<Appointment>()

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 250); return () => clearTimeout(t) }, [q])

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([
        api.admin.list({ range, status: status || undefined, q: debouncedQ || undefined, include_cancelled: showCancelled }),
        api.admin.summary(),
      ])
      setRows(l.appointments); setSummary(s); setError(undefined)
    } catch (e) {
      if ((e as ApiError).status === 401) return onLocked()
      setError((e as ApiError).message)
    }
  }, [range, status, debouncedQ, showCancelled, onLocked])
  useEffect(() => { setRows(undefined); load() }, [load])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); await load() } catch (e) { toast((e as ApiError).message, 'error'); await load() }
  }

  return (
    <div className="space-y-6">
      <Summary_ s={summary} today={config.today} />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Date range" className="inline-flex rounded-full bg-ink/8 p-1">
          {RANGES.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)} className={cx('min-h-10 rounded-full px-4 text-sm font-semibold', range === r.id ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5')}>{r.label}</button>
          ))}
        </div>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="block min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="search" aria-label="Search by name or phone" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="block min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 sm:w-56" />
        <label className="flex min-h-10 items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-moss" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />Show cancelled</label>
        <Button className="ml-auto" onClick={() => setAdding(true)}>+ Add appointment</Button>
      </div>

      {error && <Banner action={<button className="font-bold underline" onClick={load}>Retry</button>}>{error}</Banner>}
      {!rows && !error && <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
      {rows && rows.length === 0 && (
        <Empty title={range === 'today' ? 'No appointments today' : 'No appointments match'} action={range === 'today' ? <Button variant="secondary" onClick={() => setRange('all')}>Show all appointments</Button> : undefined}>
          {range === 'today' ? `Nothing is booked for ${prettyDate(config.today)}.` : 'Try a different range or clear the filters.'}
        </Empty>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-3xl bg-paper ring-1 ring-line md:block">
            <table className="w-full text-left">
              <thead className="border-b border-line bg-ink/[0.03] text-sm text-muted">
                <tr>{['Client', 'Phone', 'Date', 'Time', 'Status', 'Attendance', ''].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => <Row key={a.id} a={a} act={act} onMove={() => setMoving(a)} onCancel={() => setCancelling(a)} />)}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">{rows.map((a) => <MobileRow key={a.id} a={a} act={act} onMove={() => setMoving(a)} onCancel={() => setCancelling(a)} />)}</ul>
        </>
      )}

      <AddDialog open={adding} config={config} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); toast('Appointment added.'); load() }} />
      <MoveDialog appt={moving} config={config} onClose={() => setMoving(undefined)} onMoved={() => { setMoving(undefined); toast('Appointment moved.'); load() }} />
      <Modal open={!!cancelling} onClose={() => setCancelling(undefined)} title="Cancel this appointment?">
        {cancelling && <p>{cancelling.client_name}, {prettyDate(cancelling.date)} at {prettyTime(cancelling.time)}. The slot opens up for new bookings.</p>}
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setCancelling(undefined)}>Keep it</Button>
          <Button variant="danger" className="flex-1" onClick={() => { const a = cancelling!; setCancelling(undefined); act(() => api.admin.cancel(a.id), 'Appointment cancelled.') }}>Yes, cancel</Button>
        </div>
      </Modal>
    </div>
  )
}

function Summary_({ s, today }: { s?: Summary; today: string }) {
  const items = [
    { label: `Today · ${prettyDate(today)}`, value: s?.today_total, sub: s ? `${s.today_remaining} still to come` : '' },
    { label: 'Upcoming bookings', value: s?.upcoming, sub: 'from now on' },
    { label: 'Need a reminder or confirmation', value: s?.needs_confirmation, sub: 'next 24 hours, unconfirmed', warn: (s?.needs_confirmation ?? 0) > 0 },
    { label: 'No-show rate', value: s?.no_show_rate == null ? '–' : `${s.no_show_rate}%`, sub: s ? `${s.no_show} of ${s.done + s.no_show} finished visits` : '' },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-line ring-1 ring-line lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className={cx('bg-paper p-4 sm:p-5', i.warn && 'bg-warn-bg')}>
          <dt className={cx('text-sm font-semibold', i.warn ? 'text-warn-fg' : 'text-muted')}>{i.label}</dt>
          <dd className="mt-1 font-display text-4xl text-ink">{s ? i.value : <span className="inline-block h-9 w-10 animate-pulse rounded-lg bg-ink/8 align-middle" />}</dd>
          <dd className={cx('text-sm', i.warn ? 'text-warn-fg' : 'text-muted')}>{i.sub}</dd>
        </div>
      ))}
    </dl>
  )
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>

function StatusSelect({ a, act }: { a: Appointment; act: Act }) {
  if (a.cancelled) return <Pill tone="neutral">Cancelled</Pill>
  const s = statusStyle[a.status]
  return (
    <div className={cx('relative inline-flex items-center rounded-full', s.cls)}>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
      <select
        aria-label={`Status for ${a.client_name}`}
        value={a.status}
        onChange={(e) => act(() => api.admin.update(a.id, { status: e.target.value as Status }), `Marked ${e.target.value}.`)}
        className="min-h-10 cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-9 pr-8 text-sm font-semibold"
      >
        {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </div>
  )
}

function Attendance({ a }: { a: Appointment }) {
  if (a.cancelled) return <span className="text-muted">–</span>
  // A past visit still marked Booked: the nutritionist needs to record what happened.
  if (!a.is_upcoming) return a.status === 'Booked' ? <Pill tone="warn">Record outcome</Pill> : <span className="text-muted">–</span>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {a.confirmed ? <Pill tone="ok">Confirmed</Pill> : <Pill tone={a.within_24h ? 'warn' : 'neutral'}>{a.within_24h ? 'Unconfirmed' : 'Not yet confirmed'}</Pill>}
      {a.reminder_sent_at && <Pill tone="neutral">Reminded</Pill>}
    </div>
  )
}

function Actions({ a, act, onMove, onCancel }: { a: Appointment; act: Act; onMove: () => void; onCancel: () => void }) {
  if (a.cancelled) return null
  const canRemind = a.is_upcoming && a.whatsapp_url
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {a.status === 'Booked' && <Button size="sm" variant="ghost" onClick={onMove}>Move</Button>}
      {a.status === 'Booked' && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
      {canRemind && (
        <a
          href={a.whatsapp_url!} target="_blank" rel="noreferrer"
          onClick={() => { act(() => api.admin.reminderSent(a.id), 'Reminder logged.') }}
          className="inline-flex min-h-10 items-center rounded-full bg-done-bg px-3 text-sm font-semibold text-done-fg hover:brightness-95"
        >{a.reminder_sent_at ? 'Remind again' : 'WhatsApp reminder'}</a>
      )}
    </div>
  )
}

const Phone = ({ a }: { a: Appointment }) =>
  a.phone ? <a href={`tel:+91${a.phone}`} className="font-medium text-ink underline-offset-2 hover:underline">{formatPhoneInput(a.phone)}</a> : <span className="italic text-muted">Not provided</span>

function Row({ a, act, onMove, onCancel }: { a: Appointment; act: Act; onMove: () => void; onCancel: () => void }) {
  return (
    <tr className={cx('align-middle', a.cancelled && 'bg-ink/[0.03] text-muted')}>
      <td className="px-4 py-3"><div className="font-semibold text-ink">{a.client_name}</div><div className="text-xs text-muted">{a.source === 'dashboard' ? 'Added by you' : a.source === 'sample' ? 'Sample data' : 'Booked online'}</div></td>
      <td className="px-4 py-3"><Phone a={a} /></td>
      <td className="px-4 py-3 whitespace-nowrap"><div className="font-medium">{prettyDate(a.date)}</div><div className="text-xs text-muted">{numericDate(a.date)}</div></td>
      <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums">{prettyTime(a.time)}</td>
      <td className="px-4 py-3"><StatusSelect a={a} act={act} /></td>
      <td className="px-4 py-3"><Attendance a={a} /></td>
      <td className="px-4 py-3"><Actions a={a} act={act} onMove={onMove} onCancel={onCancel} /></td>
    </tr>
  )
}

function MobileRow({ a, act, onMove, onCancel }: { a: Appointment; act: Act; onMove: () => void; onCancel: () => void }) {
  return (
    <li className="space-y-3 rounded-3xl bg-paper p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-lg font-semibold text-ink">{a.client_name}</p><p className="text-sm"><Phone a={a} /></p></div>
        <div className="text-right"><p className="font-semibold text-ink">{prettyTime(a.time)}</p><p className="text-sm text-muted">{prettyDate(a.date)}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2"><StatusSelect a={a} act={act} /><Attendance a={a} /></div>
      <Actions a={a} act={act} onMove={onMove} onCancel={onCancel} />
    </li>
  )
}
