import { useState } from 'react'
import { ApiError, api } from '../lib/api'
import { formatPhoneInput, isValidPhone } from '../lib/format'
import { Button, Field, inputCls } from '../components/ui'
import { useClient } from './ClientApp'

/** Phone-based "sign in". Convenience only: see README for why this is not real authentication. */
export function PhoneLookup({ onFound, title = 'Already booked?', cta = 'Find my appointments' }: { onFound?: () => void; title?: string; cta?: string }) {
  const { remember } = useClient()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidPhone(phone)) return setError('Enter the 10-digit mobile number you booked with.')
    setBusy(true); setError(undefined)
    try {
      const r = await api.mine(phone.replace(/\D/g, ''))
      if (!r.name) { setError("We couldn't find any appointments for that number. Check it, or book a new consultation."); return }
      remember({ phone: r.phone, name: r.name })
      onFound?.()
    } catch (err) { setError((err as ApiError).message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-paper p-6 shadow-sm ring-1 ring-line" noValidate>
      <h2 className="text-2xl">{title}</h2>
      <p className="mt-1 text-muted">Use the mobile number you booked with. No account or password needed.</p>
      <div className="mt-4">
        <Field label="Mobile number" error={error}>
          {(p) => <input {...p} className={inputCls} inputMode="tel" autoComplete="tel" placeholder="98200 11111" value={phone} onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setError(undefined) }} />}
        </Field>
      </div>
      <Button type="submit" className="mt-4 w-full" loading={busy}>{cta}</Button>
      <p className="mt-3 text-sm text-muted">
        Reviewing this build? Try the sample client{' '}
        <button type="button" className="font-semibold text-moss-dark underline underline-offset-2" onClick={() => { setPhone('98200 11111'); setError(undefined) }}>Riya Shah (98200 11111)</button>.
      </p>
    </form>
  )
}
