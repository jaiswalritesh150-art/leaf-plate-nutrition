import { useEffect, useRef } from 'react'
import type { DayAvailability } from '../lib/api'
import { dayNum, dayShort, monthShort, prettyDate, prettyTime } from '../lib/format'
import { cx, Skeleton } from './ui'

interface Props {
  days: DayAvailability[] | undefined
  loading: boolean
  date: string | null
  time: string | null
  onDate: (d: string) => void
  onTime: (t: string) => void
}

/** Date strip + time grid. Closed and full days stay visible but disabled, so nothing is a mystery. */
export function SlotPicker({ days, loading, date, time, onDate, onTime }: Props) {
  const selected = days?.find((d) => d.date === date)
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [date])

  const morning = selected?.slots.filter((s) => Number(s.time.slice(0, 2)) < 12) ?? []
  const afternoon = selected?.slots.filter((s) => Number(s.time.slice(0, 2)) >= 12) ?? []

  return (
    <div>
      <div ref={stripRef} role="radiogroup" aria-label="Choose a date" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {loading && !days && Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[4.5rem] w-16 shrink-0" />)}
        {days?.map((d) => {
          const unavailable = d.closed || d.available_count === 0
          const on = d.date === date
          return (
            <button
              key={d.date}
              role="radio"
              aria-checked={on}
              disabled={unavailable}
              onClick={() => onDate(d.date)}
              aria-label={`${prettyDate(d.date)}, ${d.closed ? 'closed' : d.available_count === 0 ? 'fully booked' : `${d.available_count} times available`}`}
              className={cx(
                'flex h-[4.75rem] w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition-colors',
                on ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink hover:border-moss',
                unavailable && 'border-transparent bg-transparent text-muted/60 hover:border-transparent',
              )}
            >
              <span className="text-xs font-medium">{dayShort(d.date)}</span>
              <span className="font-display text-2xl leading-none">{dayNum(d.date)}</span>
              <span className="text-[0.7rem]">{d.closed ? 'closed' : d.available_count === 0 ? 'full' : monthShort(d.date)}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5" aria-live="polite">
        {!selected && !loading && <p className="text-muted">Pick a day to see open times.</p>}
        {selected && (
          <div className="space-y-5">
            {[['Morning', morning], ['Afternoon', afternoon]].map(([label, slots]) => (
              (slots as typeof morning).length > 0 && (
                <fieldset key={label as string}>
                  <legend className="mb-2 text-sm font-semibold text-ink">{label as string}</legend>
                  <div role="radiogroup" aria-label={`${label} times`} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {(slots as typeof morning).map((s) => {
                      const on = s.time === time
                      return (
                        <button
                          key={s.time}
                          role="radio"
                          aria-checked={on}
                          disabled={!s.available}
                          onClick={() => onTime(s.time)}
                          className={cx(
                            'min-h-12 rounded-xl border px-2 text-[0.95rem] font-semibold tabular-nums transition-colors',
                            on ? 'border-moss bg-moss text-white' : 'border-line bg-paper text-ink hover:border-moss',
                            !s.available && 'border-transparent bg-ink/5 text-muted/70 line-through hover:border-transparent',
                          )}
                          aria-label={`${prettyTime(s.time)}${s.available ? '' : ', unavailable'}`}
                        >
                          {prettyTime(s.time)}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
