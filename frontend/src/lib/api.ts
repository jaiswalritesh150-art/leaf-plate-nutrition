// Thin fetch wrapper. All server errors arrive as { error: { code, message, fields } }.
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type Status = 'Booked' | 'Done' | 'No-show'

export interface Appointment {
  id: string
  client_name: string
  phone: string | null
  phone_display: string | null
  date: string // YYYY-MM-DD, clinic timezone
  time: string // HH:MM, clinic timezone
  starts_at: string // ISO with offset
  duration_minutes: number
  status: Status
  cancelled: boolean
  is_upcoming: boolean
  confirmed: boolean
  reminder_sent_at: string | null
  within_24h: boolean
  needs_confirmation: boolean
  source?: 'client' | 'dashboard' | 'sample'
  whatsapp_url?: string | null
}

export interface Slot { time: string; available: boolean }
export interface DayAvailability { date: string; weekday: string; closed: boolean; available_count: number; slots: Slot[] }
export interface Config { clinic_name: string; timezone: string; slot_minutes: number; booking_horizon_days: number; today: string; now: string; admin_protected: boolean }
export interface MyAppointments { name: string | null; phone: string; next: Appointment | null; upcoming: Appointment[]; past: Appointment[] }
export interface Summary { today_total: number; today_remaining: number; upcoming: number; needs_confirmation: number; reminders_due: number; done: number; no_show: number; no_show_rate: number | null }

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>
  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

let adminPasscode = sessionStorage.getItem('adminPasscode') ?? ''
export function setAdminPasscode(p: string) {
  adminPasscode = p
  sessionStorage.setItem('adminPasscode', p)
}

type Listener = (waking: boolean) => void
let wakeListener: Listener | null = null
export function onWaking(l: Listener) { wakeListener = l }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Free hosting sleeps when idle; if a request is slow, tell the user why.
  const timer = window.setTimeout(() => wakeListener?.(true), 3500)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(path.startsWith('/api/admin') && adminPasscode ? { 'X-Admin-Passcode': adminPasscode } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { /* non-JSON error page */ }
    if (!res.ok) {
      const e = data?.error
      throw new ApiError(res.status, e?.code ?? 'server_error', e?.message ?? 'Something went wrong on our side. Please try again in a moment.', e?.fields ?? {})
    }
    return data as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(0, 'network', "We couldn't reach the booking server. Check your connection and try again.")
  } finally {
    window.clearTimeout(timer)
    wakeListener?.(false)
  }
}

const qs = (o: Record<string, string | boolean | undefined>) =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== false).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')

export const api = {
  config: () => request<Config>('GET', '/api/config'),
  availability: (start: string, days = 14) => request<{ days: DayAvailability[] }>('GET', `/api/availability?${qs({ start, days: String(days) })}`),
  book: (b: { name: string; phone: string; date: string; time: string }) => request<{ appointment: Appointment }>('POST', '/api/appointments', b),
  mine: (phone: string) => request<MyAppointments>('GET', `/api/appointments?${qs({ phone })}`),
  cancel: (id: string, phone: string) => request<{ appointment: Appointment }>('POST', `/api/appointments/${id}/cancel`, { phone }),
  reschedule: (id: string, phone: string, date: string, time: string) => request<{ appointment: Appointment }>('POST', `/api/appointments/${id}/reschedule`, { phone, date, time }),
  confirm: (id: string, phone: string) => request<{ appointment: Appointment }>('POST', `/api/appointments/${id}/confirm`, { phone }),

  admin: {
    session: () => request<{ ok: boolean }>('GET', '/api/admin/session'),
    list: (p: { range: string; status?: string; q?: string; include_cancelled?: boolean }) => request<{ appointments: Appointment[] }>('GET', `/api/admin/appointments?${qs(p)}`),
    summary: () => request<Summary>('GET', '/api/admin/summary'),
    availability: (date: string) => request<DayAvailability>('GET', `/api/admin/availability?${qs({ date })}`),
    create: (b: { name: string; phone?: string; date: string; time: string; status: Status }) => request<{ appointment: Appointment }>('POST', '/api/admin/appointments', b),
    update: (id: string, b: { status?: Status; date?: string; time?: string }) => request<{ appointment: Appointment }>('PATCH', `/api/admin/appointments/${id}`, b),
    cancel: (id: string) => request<{ appointment: Appointment }>('POST', `/api/admin/appointments/${id}/cancel`),
    reminderSent: (id: string) => request<{ appointment: Appointment }>('POST', `/api/admin/appointments/${id}/reminder-sent`),
  },
}
