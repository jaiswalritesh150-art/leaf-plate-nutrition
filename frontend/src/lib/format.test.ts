import { describe, expect, it } from 'vitest'
import { addDays, countdown, dayName, formatPhoneInput, isValidName, isValidPhone, numericDate, prettyDate, prettyTime } from './format'
import { buildIcs } from './ics'

describe('dates and times', () => {
  it('formats dates without timezone drift', () => {
    expect(prettyDate('2026-10-24')).toBe('Sat, 24 Oct')
    expect(dayName('2026-10-25')).toBe('Sunday')
    expect(numericDate('2026-10-22')).toBe('22/10/2026')
  })
  it('formats 24h times in 12h', () => {
    expect(prettyTime('16:00')).toBe('4:00 PM')
    expect(prettyTime('09:30')).toBe('9:30 AM')
    expect(prettyTime('12:00')).toBe('12:00 PM')
  })
  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
  it('describes countdowns', () => {
    expect(countdown(45)).toBe('in 45 min')
    expect(countdown(180)).toBe('in 3 hrs')
    expect(countdown(1500)).toBe('tomorrow')
    expect(countdown(4000)).toBe('in 3 days')
  })
})

describe('input helpers', () => {
  it('formats phone numbers as typed', () => {
    expect(formatPhoneInput('9820011111')).toBe('98200 11111')
    expect(formatPhoneInput('+91 98200 11111')).toBe('98200 11111')
    expect(formatPhoneInput('982')).toBe('982')
  })
  it('validates phone and name', () => {
    expect(isValidPhone('98200 11111')).toBe(true)
    expect(isValidPhone('1234567890')).toBe(false)
    expect(isValidName('Riya Shah')).toBe(true)
    expect(isValidName('R')).toBe(false)
    expect(isValidName('R2D2')).toBe(false)
  })
})

describe('calendar file', () => {
  it('contains the correct local start time and reminders', () => {
    const ics = buildIcs({ id: 'abc', date: '2026-10-25', time: '16:00', minutes: 30, clinic: 'Leaf', tz: 'Asia/Kolkata' })
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20261025T160000')
    expect(ics).toContain('DTEND;TZID=Asia/Kolkata:20261025T163000')
    expect(ics).toContain('TRIGGER:-P1D')
  })
})
