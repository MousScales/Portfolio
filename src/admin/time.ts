/** Monday-start weeks, matching the weekly schedule. */

export function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function startOfWeek(date: Date): Date {
  const next = startOfDay(date)
  const mondayOffset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - mondayOffset)
  return next
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function weekKey(start: Date): string {
  const monday = startOfWeek(start)
  const month = String(monday.getMonth() + 1).padStart(2, '0')
  const day = String(monday.getDate()).padStart(2, '0')
  return `${monday.getFullYear()}-${month}-${day}`
}

export function weekTitle(start: Date): string {
  const end = addDays(start, 6)
  const startMonth = start.toLocaleString('en-US', { month: 'long' })
  const endMonth = end.toLocaleString('en-US', { month: 'long' })
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getFullYear()}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} – ${endMonth} ${start.getFullYear()}`
  }
  return `${startMonth} ${start.getFullYear()} – ${endMonth} ${end.getFullYear()}`
}

export function formatHourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12} ${suffix}`
}

export function formatRange(start: number, end: number): string {
  const suffix = (mins: number) => (mins >= 12 * 60 ? 'PM' : 'AM')
  const forceMinutes = start % 60 !== 0 || end % 60 !== 0
  const clock = (mins: number, withSuffix: boolean) => {
    const hour12 = Math.floor(mins / 60) % 12 || 12
    const minutes = mins % 60
    const body =
      !forceMinutes && minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, '0')}`
    return withSuffix ? `${body} ${suffix(mins)}` : body
  }
  if (suffix(start) === suffix(end)) return `${clock(start, false)} – ${clock(end, true)}`
  return `${clock(start, true)} – ${clock(end, true)}`
}

export function minutesNow(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function timezoneLabel(date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((item) => item.type === 'timeZoneName')
  return (part?.value ?? 'GMT').replace('GMT−', 'GMT-').replace('GMT+', 'GMT+')
}
