import { useEffect, useState } from 'react'
import { api, ApiError, type Appointment, type Config, type DayAvailability, type Status } from '../lib/api'
import { formatPhoneInput, isValidName, isValidPhone, prettyDate, prettyTime } from '../lib/format'
import { Banner, Button, Field, Modal, Skeleton, cx, inputCls } from '../components/ui'

/** Date input + time grid. Shows which times are already taken (any day, including Sundays). */
function DateTime({ date, time, onDate, onTime, error }: { date: string; time: string | null; onDate: (d: string) => void; onTime: (t: string) => void; error?: string }) {
  const [day, setDay] = useState<DayAvailability>()
  const [err, setErr] = useState<string>()
  useEffect(() => {
    let alive = true
    setDay(undefined); setErr(undefined)
    if (!date) return
    api.admin.availability(date).then((d) => alive && setDay(d), (e) => alive && setErr(e.message))
    return () => { alive = false }
  }, [date])
  return (
    <div className="space-y-3">
      <Field label="Date" error={error}>{(p) => <input {...p} type="date" className={inputCls} value={date} onChange={(e) => { onDate(e.target.value) }} />}</Field>
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">Time {date && <span className="font-normal text-muted">· {prettyDate(date)}</span>}</p>
        {err && <Banner>{err}</Banner>}
        {!day && !err && <Skeleton className="h-24" />}
        {day && (
          <div role="radiogroup" aria-label="Time" className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {day.slots.map((s) => (
              <button type="button" key={s.time} role="radio" aria-checked={time === s.time} disabled={!s.available} onClick={() => onTime(s.time)}
                aria-label={`${prettyTime(s.time)}${s.available ? '' : ', already booked'}`}
                className={cx('min-h-11 rounded-xl border text-sm font-semibold tabular-nums', time === s.time ? 'border-moss bg-moss text-white' : 'border-line bg-white text-ink hover:border-moss', !s.available && 'border-transparent bg-ink/5 text-muted/70 line-through')}>
                {prettyTime(s.time).replace(' ', '\u00a0')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function AddDialog({ open, config, onClose, onCreated }: { open: boolean; config: Config; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(config.today)
  const [time, setTime] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('Booked')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setName(''); setPhone(''); setDate(config.today); setTime(null); setStatus('Booked'); setErrors({}); setMsg(undefined) } }, [open, config.today])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!isValidName(name)) local.name = 'Enter the client’s name (letters only).'
    if (phone && !isValidPhone(phone)) local.phone = 'Enter a valid 10-digit mobile number, or leave it empty.'
    if (!date) local.date = 'Choose a date.'
    if (!time) local.time = 'Choose a time.'
    setErrors(local); setMsg(undefined)
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      await api.admin.create({ name, phone: phone ? phone.replace(/\D/g, '') : undefined, date, time: time!, status })
      onCreated()
    } catch (err) {
      const ae = err as ApiError
      setErrors(ae.fields); setMsg(ae.message)
      if (ae.code === 'slot_taken') { setTime(null); const d = date; setDate(''); setTimeout(() => setDate(d), 0) }
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add an appointment" wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Client name" error={errors.name}>{(p) => <input {...p} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <Field label="Phone (optional)" error={errors.phone}>{(p) => <input {...p} className={inputCls} inputMode="tel" placeholder="98200 11111" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />}</Field>
        <DateTime date={date} time={time} onDate={(d) => { setDate(d); setTime(null) }} onTime={setTime} error={errors.date} />
        {errors.time && <p role="alert" className="text-sm font-medium text-noshow-fg">{errors.time}</p>}
        <Field label="Status">{(p) => <select {...p} className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as Status)}>{(['Booked', 'Done', 'No-show'] as Status[]).map((s) => <option key={s}>{s}</option>)}</select>}</Field>
        {msg && <Banner>{msg}</Banner>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={busy}>Add appointment</Button>
        </div>
      </form>
    </Modal>
  )
}

export function MoveDialog({ appt, config, onClose, onMoved }: { appt?: Appointment; config: Config; onClose: () => void; onMoved: () => void }) {
  const [date, setDate] = useState(config.today)
  const [time, setTime] = useState<string | null>(null)
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (appt) { setDate(appt.date); setTime(null); setMsg(undefined) } }, [appt])
  async function go() {
    if (!appt || !time) return
    setBusy(true); setMsg(undefined)
    try { await api.admin.update(appt.id, { date, time }); onMoved() } catch (e) { setMsg((e as ApiError).message) } finally { setBusy(false) }
  }
  return (
    <Modal open={!!appt} onClose={onClose} title="Move appointment" wide>
      {appt && <p className="mb-4 text-muted">{appt.client_name}, currently {prettyDate(appt.date)} at {prettyTime(appt.time)}. The client will see the new time in their app.</p>}
      <DateTime date={date} time={time} onDate={(d) => { setDate(d); setTime(null) }} onTime={setTime} />
      {msg && <div className="mt-4"><Banner>{msg}</Banner></div>}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Never mind</Button>
        <Button className="flex-1" disabled={!time} loading={busy} onClick={go}>Move appointment</Button>
      </div>
    </Modal>
  )
}
