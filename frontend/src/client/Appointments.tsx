import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Appointment } from '../lib/api'
import { dayName, dayNum, monthShort, prettyTime } from '../lib/format'
import { buildIcs, downloadIcs } from '../lib/ics'
import { Banner, Button, Empty, Modal, Pill, Skeleton, StatusBadge, cx, useAsync, useToast } from '../components/ui'
import { SlotPicker } from '../components/SlotPicker'
import { useClient } from './ClientApp'
import { PhoneLookup } from './PhoneLookup'

export function Appointments() {
  const { identity, forget, config } = useClient()
  if (!identity) return <div className="rise mx-auto max-w-xl lg:mx-0"><h1 className="mb-5 text-4xl">My visits</h1><PhoneLookup title="Find your appointments" cta="Show my visits" /></div>
  return <List phone={identity.phone} onSwitch={forget} clinic={config?.clinic_name ?? ''} tz={config?.timezone ?? 'Asia/Kolkata'} />
}

function List({ phone, onSwitch, clinic, tz }: { phone: string; onSwitch: () => void; clinic: string; tz: string }) {
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.mine(phone), [phone])
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [cancelling, setCancelling] = useState<Appointment>()
  const [moving, setMoving] = useState<Appointment>()

  const items = data ? data[tab] : []

  return (
    <div className="rise mx-auto max-w-2xl space-y-6 lg:mx-0">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl lg:text-5xl">My visits</h1>
        <button className="pb-2 text-sm font-semibold text-moss-dark underline underline-offset-2" onClick={onSwitch}>Use a different number</button>
      </div>

      <div role="tablist" aria-label="Appointments" className="grid grid-cols-2 rounded-full bg-ink/8 p-1">
        {(['upcoming', 'past'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('min-h-11 rounded-full font-semibold capitalize', tab === t ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink')}>
            {t} {data && <span className="text-sm font-medium text-muted">({data[t].length})</span>}
          </button>
        ))}
      </div>

      {loading && !data && <div className="space-y-3"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>}
      {error && <Banner action={<button className="font-bold underline" onClick={reload}>Try again</button>}>{error.message}</Banner>}
      {data && items.length === 0 && (
        tab === 'upcoming'
          ? <Empty title="Nothing coming up" action={<Link to="/book" className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-white">Book a consultation</Link>}>When you book, your appointment will appear here.</Empty>
          : <Empty title="No past visits yet">Completed, missed and cancelled appointments are listed here.</Empty>
      )}

      <ul className="space-y-3">
        {items.map((a) => (
          <Card key={a.id} a={a} onCancel={() => setCancelling(a)} onMove={() => setMoving(a)}
            onCalendar={() => downloadIcs('consultation.ics', buildIcs({ id: a.id, date: a.date, time: a.time, minutes: a.duration_minutes, clinic, tz }))}
            onConfirm={async () => { try { await api.confirm(a.id, phone); toast("Thanks — you're confirmed."); reload() } catch (e) { toast((e as ApiError).message, 'error') } }} />
        ))}
      </ul>

      <CancelDialog appt={cancelling} phone={phone} onClose={() => setCancelling(undefined)} onDone={() => { setCancelling(undefined); toast('Appointment cancelled. Your slot has been released.'); reload() }} />
      <RescheduleDialog appt={moving} phone={phone} onClose={() => setMoving(undefined)} onDone={() => { setMoving(undefined); toast('Appointment rescheduled.'); reload() }} />
    </div>
  )
}

function Card({ a, onCancel, onMove, onCalendar, onConfirm }: { a: Appointment; onCancel: () => void; onMove: () => void; onCalendar: () => void; onConfirm: () => void }) {
  return (
    <li className={cx('flex gap-4 rounded-3xl bg-paper p-4 ring-1 ring-line', a.cancelled && 'opacity-80')}>
      <div className={cx('flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-2xl', a.is_upcoming ? 'bg-ink text-white' : 'bg-ink/8 text-ink')}>
        <span className="font-display text-3xl leading-none">{dayNum(a.date)}</span>
        <span className="text-xs font-semibold">{monthShort(a.date)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-ink">{dayName(a.date)}, {prettyTime(a.time)}</p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {a.cancelled ? <Pill tone="neutral">Cancelled</Pill> : <StatusBadge status={a.status} />}
          {a.is_upcoming && (a.confirmed ? <Pill tone="ok">Confirmed</Pill> : <Pill tone="warn">Not confirmed yet</Pill>)}
        </div>
        {a.is_upcoming && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!a.confirmed && <Button size="sm" variant="primary" onClick={onConfirm}>I'll be there</Button>}
            <Button size="sm" variant="secondary" onClick={onMove}>Reschedule</Button>
            <Button size="sm" variant="danger" onClick={onCancel}>Cancel</Button>
            <Button size="sm" variant="ghost" onClick={onCalendar}>Add to calendar</Button>
          </div>
        )}
      </div>
    </li>
  )
}

function CancelDialog({ appt, phone, onClose, onDone }: { appt?: Appointment; phone: string; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()
  async function go() {
    if (!appt) return
    setBusy(true); setErr(undefined)
    try { await api.cancel(appt.id, phone); onDone() } catch (e) { setErr((e as ApiError).message) } finally { setBusy(false) }
  }
  return (
    <Modal open={!!appt} onClose={onClose} title="Cancel this appointment?">
      {appt && <p>{dayName(appt.date)}, {dayNum(appt.date)} {monthShort(appt.date)} at {prettyTime(appt.time)}. The slot will be released for someone else.</p>}
      {err && <div className="mt-3"><Banner>{err}</Banner></div>}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Keep it</Button>
        <Button variant="danger" className="flex-1" loading={busy} onClick={go}>Yes, cancel</Button>
      </div>
    </Modal>
  )
}

function RescheduleDialog({ appt, phone, onClose, onDone }: { appt?: Appointment; phone: string; onClose: () => void; onDone: () => void }) {
  const { config } = useClient()
  const avail = useAsync(() => (appt && config ? api.availability(config.today, 28) : Promise.resolve(undefined)), [appt?.id, config?.today])
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  async function go() {
    if (!appt || !date || !time) return
    setBusy(true); setErr(undefined)
    try { await api.reschedule(appt.id, phone, date, time); setDate(null); setTime(null); onDone() }
    catch (e) {
      const ae = e as ApiError
      setErr(ae.message)
      if (ae.code === 'slot_taken') { setTime(null); avail.reload() }
    } finally { setBusy(false) }
  }
  return (
    <Modal open={!!appt} onClose={onClose} title="Pick a new time" wide>
      {appt && <p className="mb-4 text-muted">Currently {dayName(appt.date)}, {dayNum(appt.date)} {monthShort(appt.date)} at {prettyTime(appt.time)}. Your current slot is kept until you confirm a new one.</p>}
      <SlotPicker days={avail.data?.days} loading={avail.loading} date={date} time={time} onDate={(d) => { setDate(d); setTime(null) }} onTime={setTime} />
      {err && <div className="mt-4"><Banner>{err}</Banner></div>}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Never mind</Button>
        <Button className="flex-1" disabled={!date || !time} loading={busy} onClick={go}>Move my appointment</Button>
      </div>
    </Modal>
  )
}
