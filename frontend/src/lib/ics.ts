/** Build an .ics calendar file so the client gets a phone reminder from their own calendar app. */
const pad = (n: number) => String(n).padStart(2, '0')

// "2026-10-24" + "10:00" are clinic-local; we emit them as a floating-with-TZID event.
function stamp(date: string, time: string, addMinutes = 0) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + addMinutes))
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`
}

export function buildIcs(opts: { id: string; date: string; time: string; minutes: number; clinic: string; tz: string }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Leaf and Plate//Appointments//EN',
    'BEGIN:VEVENT',
    `UID:${opts.id}@appointments`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=${opts.tz}:${stamp(opts.date, opts.time)}`,
    `DTEND;TZID=${opts.tz}:${stamp(opts.date, opts.time, opts.minutes)}`,
    `SUMMARY:Nutrition consultation - ${opts.clinic}`,
    'DESCRIPTION:Your nutrition consultation. Need to change it? Reschedule from the booking app.',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Nutrition consultation tomorrow',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Nutrition consultation in 2 hours',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadIcs(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
