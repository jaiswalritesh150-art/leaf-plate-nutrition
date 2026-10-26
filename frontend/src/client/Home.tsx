import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ApiError, type Appointment } from '../lib/api'
import { countdown, dayName, dayNum, minutesUntil, monthShort, prettyTime } from '../lib/format'
import { buildIcs, downloadIcs } from '../lib/ics'
import { Banner, Button, Skeleton, useAsync, useToast } from '../components/ui'
import { useClient } from './ClientApp'
import { PhoneLookup } from './PhoneLookup'

function greeting(nowIso?: string) {
  const h = nowIso ? Number(nowIso.slice(11, 13)) : new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Home() {
  const { identity, config, forget } = useClient()
  const hello = greeting(config?.now)

  if (!identity) {
    return (
      <div className="rise mx-auto max-w-xl space-y-8 lg:mx-0">
        <section>
          <h1 className="text-[2.6rem] leading-[1.05] lg:text-6xl">{hello}.<br />Let's plan your next step.</h1>
          <p className="mt-4 max-w-md text-lg text-body">Book a one-to-one consultation with your nutritionist in under a minute. Pick a time that suits you; we'll help you remember it.</p>
          <Link to="/book" className="mt-6 inline-flex min-h-14 items-center rounded-full bg-ink px-8 text-lg font-semibold text-white hover:bg-ink-soft">Book a consultation</Link>
        </section>
        <PhoneLookup />
        <Reassurance />
      </div>
    )
  }

  return <SignedInHome name={identity.name} phone={identity.phone} hello={hello} onSwitch={forget} />
}

function SignedInHome({ name, phone, hello, onSwitch }: { name?: string; phone: string; hello: string; onSwitch: () => void }) {
  const { config } = useClient()
  const { data, error, loading, reload } = useAsync(() => api.mine(phone), [phone])
  const first = (data?.name ?? name ?? '').split(' ')[0]
  const next = data?.next

  return (
    <div className="rise space-y-8 lg:max-w-3xl">
      <div>
        <h1 className="text-4xl lg:text-5xl">{hello}{first ? `, ${first}` : ''}.</h1>
        <p className="mt-2 text-muted">
          {next ? 'Your next consultation is coming up.' : 'You have nothing booked right now.'}{' '}
          <button className="font-semibold text-moss-dark underline underline-offset-2" onClick={onSwitch}>Not {first || 'you'}?</button>
        </p>
      </div>

      {loading && !data && <Skeleton className="h-72" />}
      {error && <Banner action={<button className="font-bold underline" onClick={reload}>Try again</button>}>{error.message}</Banner>}
      {data && next && <NextCard appt={next} phone={phone} nowIso={config?.now ?? new Date().toISOString()} tz={config?.timezone ?? 'Asia/Kolkata'} clinic={config?.clinic_name ?? ''} onChange={reload} />}
      {data && !next && (
        <section className="rounded-3xl bg-ink p-7 text-white">
          <h2 className="text-3xl text-white">Ready for your next session?</h2>
          <p className="mt-2 max-w-md text-white/80">Regular check-ins make habits stick. Pick a time that works and it's done.</p>
          <Link to="/book" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-mango px-6 font-semibold text-ink">Book a consultation</Link>
        </section>
      )}
      <Reassurance />
    </div>
  )
}

function NextCard({ appt, phone, nowIso, tz, clinic, onChange }: { appt: Appointment; phone: string; nowIso: string; tz: string; clinic: string; onChange: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const mins = minutesUntil(appt.starts_at, nowIso)

  async function confirm() {
    setBusy(true)
    try { await api.confirm(appt.id, phone); toast("Thanks — you're confirmed."); onChange() }
    catch (e) { toast((e as ApiError).message, 'error') } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="next-title" className="overflow-hidden rounded-[2rem] bg-ink text-white shadow-xl shadow-ink/15">
      <div className="flex items-start justify-between gap-4 px-7 pt-7">
        <h2 id="next-title" className="font-sans text-base font-semibold text-white/80">Next appointment</h2>
        <span className="rounded-full bg-mango-soft px-3 py-1 text-sm font-semibold text-ink">{countdown(mins)}</span>
      </div>
      <div className="flex items-end gap-5 px-7 pb-6 pt-3">
        <div className="font-display text-[6.5rem] leading-[0.85] text-mango">{dayNum(appt.date)}</div>
        <div className="pb-1">
          <div className="text-2xl font-semibold">{dayName(appt.date)}</div>
          <div className="text-white/80">{monthShort(appt.date)} · {prettyTime(appt.time)}</div>
          <div className="text-sm text-white/70">{appt.duration_minutes}-minute consultation</div>
        </div>
      </div>
      <div className="space-y-3 bg-ink-soft px-7 py-5">
        {appt.confirmed ? (
          <p className="flex items-center gap-2 font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-mango text-ink"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>You're confirmed. See you then.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="mango" onClick={confirm} loading={busy}>Confirm I'll be there</Button>
            <span className="text-sm text-white/75">A quick tap tells your nutritionist to keep your slot.</span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
          <button className="min-h-10 underline underline-offset-4" onClick={() => downloadIcs('consultation.ics', buildIcs({ id: appt.id, date: appt.date, time: appt.time, minutes: appt.duration_minutes, clinic, tz }))}>Add to calendar (with reminders)</button>
          <Link className="flex min-h-10 items-center underline underline-offset-4" to="/appointments">Reschedule or cancel</Link>
        </div>
      </div>
    </section>
  )
}

function Reassurance() {
  const items = [
    ['Confirm with one tap', 'Say you are coming and your nutritionist knows to hold your slot.'],
    ['Reminders you control', 'Add the visit to your calendar with a reminder the day before and two hours before.'],
    ['Plans change', 'Reschedule or cancel in a few taps so someone else can use the time.'],
  ]
  return (
    <section aria-label="How we help you show up">
      <h2 className="text-2xl">Helping you show up</h2>
      <ul className="mt-3 divide-y divide-line rounded-3xl bg-paper ring-1 ring-line">
        {items.map(([t, d]) => (
          <li key={t} className="px-5 py-4"><p className="font-semibold text-ink">{t}</p><p className="text-muted">{d}</p></li>
        ))}
      </ul>
    </section>
  )
}
