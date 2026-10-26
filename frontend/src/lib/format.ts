const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Parse "YYYY-MM-DD" as a calendar date without any timezone shifting. */
export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

export const dayName = (iso: string) => DAYS[parseDate(iso).weekday]
export const dayShort = (iso: string) => dayName(iso).slice(0, 3)
export const dayNum = (iso: string) => parseDate(iso).d
export const monthShort = (iso: string) => MONTHS[parseDate(iso).m - 1]

/** "Sat, 24 Oct" */
export const prettyDate = (iso: string) => `${dayShort(iso)}, ${dayNum(iso)} ${monthShort(iso)}`
/** "24/10/2026" - matches the format used in the assignment */
export const numericDate = (iso: string) => {
  const { y, m, d } = parseDate(iso)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

/** "16:00" -> "4:00 PM" */
export function prettyTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function addDays(iso: string, n: number) {
  const { y, m, d } = parseDate(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

/** Strip a typed phone down to digits and format as "98200 11111" while typing. */
export function formatPhoneInput(raw: string) {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits
}

export const isValidPhone = (raw: string) => /^[6-9]\d{9}$/.test(raw.replace(/\D/g, ''))
export const isValidName = (raw: string) => {
  const n = raw.trim().replace(/\s+/g, ' ')
  return n.length >= 2 && n.length <= 80 && !/\d/.test(n)
}

/** Minutes between the clinic's "now" and an ISO instant. */
export const minutesUntil = (startsAtIso: string, nowIso: string) =>
  Math.round((new Date(startsAtIso).getTime() - new Date(nowIso).getTime()) / 60000)

export function countdown(mins: number) {
  if (mins <= 0) return 'now'
  if (mins < 60) return `in ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `in ${h} hr${h > 1 ? 's' : ''}`
  const days = Math.round(mins / 1440)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}
