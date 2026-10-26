import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Appointment } from '../lib/api'
import { dayName, formatPhoneInput, isValidName, isValidPhone, monthShort, dayNum, prettyTime } from '../lib/format'
import { buildIcs, downloadIcs } from '../lib/ics'
import { Banner, Button, Field, inputCls, useAsync } from '../components/ui'
import { SlotPicker } from '../components/SlotPicker'
import { useClient } from './ClientApp'

export function Book() {
  const { config, identity, remember } = useClient()
  const today = config?.today
  const avail = useAsync(() => (today ? api.availability(today, 28) : Promise.resolve(undefined)), [today])
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [name, setName] = useState(identity?.name ?? '')
  const [phone, setPhone] = useState(identity ? formatPhoneInput(identity.phone) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Appointment>()

  const days = avail.data?.days
  // Pre-select the first day that has room, so the page opens ready to use.
  useEffect(() => {
    if (days && !date) setDate(days.find((d) => !d.closed && d.available_count > 0)?.date ?? null)
  }, [days, date])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!isValidName(name)) local.name = 'Enter your full name, letters only (at least 2 characters).'
    if (!isValidPhone(phone)) local.phone = 'Enter a valid 10-digit mobile number, e.g. 98200 11111.'
    if (!date || !time) local.time = 'Choose a day and a time above.'
    setErrors(local); setFormError(undefined)
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      const { appointment } = await api.book({ name, phone: phone.replace(/\D/g, ''), date: date!, time: time! })
      remember({ phone: appointment.phone!, name: appointment.client_name })
      setDone(appointment)
    } catch (err) {
      const e = err as ApiError
      setErrors(e.fields)
      setFormError(e.message)
      if (e.code === 'slot_taken' || e.code === 'too_soon') { setTime(null); avail.reload() }
    } finally { setBusy(false) }
  }

  if (done) return <Confirmation appt={done} clinic={config?.clinic_name ?? ''} tz={config?.timezone ?? 'Asia/Kolkata'} />

  return (
    <form onSubmit={submit} noValidate className="rise mx-auto max-w-2xl space-y-8 lg:mx-0">
      <div>
        <h1 className="text-4xl lg:text-5xl">Book a consultation</h1>
        <p className="mt-2 text-muted">30 minutes, one-to-one. Choose a day and time, then tell us who's coming.</p>
      </div>

      {avail.error && <Banner action={<button type="button" className="font-bold underline" onClick={avail.reload}>Try again</button>}>{avail.error.message}</Banner>}

      <section aria-labelledby="when">
        <h2 id="when" className="mb-3 text-2xl">When</h2>
        <SlotPicker days={days} loading={avail.loading} date={date} time={time} onDate={(d) => { setDate(d); setTime(null) }} onTime={setTime} />
        {errors.time && <p role="alert" className="mt-3 text-sm font-medium text-noshow-fg">{errors.time}</p>}
        {errors.date && <p role="alert" className="mt-3 text-sm font-medium text-noshow-fg">{errors.date}</p>}
      </section>

      <section aria-labelledby="who" className="space-y-4">
        <h2 id="who" className="text-2xl">Who's coming</h2>
        <Field label="Full name" error={errors.name}>
          {(p) => <input {...p} className={inputCls} autoComplete="name" placeholder="Riya Shah" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Mobile number" error={errors.phone} hint="We use this to find your bookings and send reminders. 10 digits, India.">
          {(p) => <input {...p} className={inputCls} inputMode="tel" autoComplete="tel" placeholder="98200 11111" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />}
        </Field>
      </section>

      {formError && !Object.keys(errors).length && <Banner>{formError}</Banner>}
      {formError && Object.keys(errors).length > 0 && errors.time === undefined && errors.name === undefined && errors.phone === undefined && <Banner>{formError}</Banner>}

      <div className="sticky bottom-20 z-10 -mx-1 rounded-3xl bg-paper/95 p-3 shadow-lg ring-1 ring-line backdrop-blur lg:static lg:bottom-auto lg:mx-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm lg:hidden" aria-live="polite">
            {date && time ? <><span className="font-semibold text-ink">{dayName(date).slice(0, 3)} {dayNum(date)} {monthShort(date)}</span><br />{prettyTime(time)}</> : <span className="text-muted">No time chosen yet</span>}
          </p>
          <Button type="submit" loading={busy} className="lg:w-full lg:min-h-14 lg:text-lg">Confirm booking</Button>
        </div>
      </div>
    </form>
  )
}

function Confirmation({ appt, clinic, tz }: { appt: Appointment; clinic: string; tz: string }) {
  return (
    <div className="pop mx-auto max-w-xl space-y-6 lg:mx-0">
      <div className="rounded-[2rem] bg-ink p-7 text-white">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-mango text-ink" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <h1 className="mt-4 text-4xl text-white">You're booked, {appt.client_name.split(' ')[0]}.</h1>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-white/90">
          <div><dt className="text-sm text-white/65">Date</dt><dd className="text-xl font-semibold">{dayName(appt.date)}, {dayNum(appt.date)} {monthShort(appt.date)}</dd></div>
          <div><dt className="text-sm text-white/65">Time</dt><dd className="text-xl font-semibold">{prettyTime(appt.time)}</dd></div>
          <div><dt className="text-sm text-white/65">Name</dt><dd className="font-semibold">{appt.client_name}</dd></div>
          <div><dt className="text-sm text-white/65">Phone</dt><dd className="font-semibold">{appt.phone_display}</dd></div>
        </dl>
      </div>

      <section className="rounded-3xl bg-paper p-6 ring-1 ring-line">
        <h2 className="text-2xl">So you don't forget</h2>
        <ul className="mt-3 space-y-3 text-body">
          <li><span className="font-semibold text-ink">Add it to your calendar.</span> The file includes alerts a day before and two hours before.</li>
          <li><span className="font-semibold text-ink">Confirm the day before.</span> Open the app and tap "Confirm I'll be there". Unconfirmed visits get a reminder from your nutritionist.</li>
          <li><span className="font-semibold text-ink">Can't make it?</span> Reschedule or cancel from My visits. It frees the slot for someone else.</li>
        </ul>
        <Button className="mt-5 w-full" onClick={() => downloadIcs('consultation.ics', buildIcs({ id: appt.id, date: appt.date, time: appt.time, minutes: appt.duration_minutes, clinic, tz }))}>Add to calendar</Button>
      </section>

      <div className="flex gap-3">
        <Link to="/" className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-paper font-semibold text-ink ring-1 ring-line hover:ring-moss">Go to home</Link>
        <Link to="/appointments" className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-paper font-semibold text-ink ring-1 ring-line hover:ring-moss">My visits</Link>
      </div>
    </div>
  )
}
