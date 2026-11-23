import { meetings } from '../src/admin/schedule.js'

/** Fall 2026 Palladium hours, Mon Aug 31–Sun Dec 13.
 * Source: NYU Athletics facility hours.
 * https://gonyuathletics.com/sports/2026/8/13/nyu-athletics-facilities-hours-access-updated.aspx
 * Day numbers are JavaScript: 0 Sunday … 6 Saturday.
 */

export interface Workout {
  id: string
  title: string
  day: number
  start: number
  end: number
  place: string
  color: string
}

const POOL = 'Palladium pool · 140 E 14th St'
const GYM = '404 Fitness · 404 Lafayette St'

/** Free-swim windows, minutes from midnight. Saturday is closed. */
export const poolWindows: Record<number, Array<[number, number]>> = {
  0: [[8 * 60, 13 * 60]],
  1: [[10 * 60, 14 * 60]],
  2: [[10 * 60, 14 * 60]],
  3: [[10 * 60, 14 * 60]],
  4: [
    [10 * 60, 14 * 60],
    [18 * 60 + 30, 21 * 60],
  ],
  5: [
    [11 * 60, 14 * 60],
    [18 * 60 + 30, 21 * 60],
  ],
  6: [],
}

/** 404 Fitness doors, before the 7:00 AM training floor. Weekend doors open at 8:00. */
export const fourOhFour: Record<number, [number, number]> = {
  0: [8 * 60, 20 * 60],
  1: [6 * 60, 22 * 60 + 30],
  2: [6 * 60, 22 * 60 + 30],
  3: [6 * 60, 22 * 60 + 30],
  4: [6 * 60, 22 * 60 + 30],
  5: [6 * 60, 20 * 60],
  6: [8 * 60, 20 * 60],
}

export type DayHours = Record<number, [number, number] | null>

/** 6:00 AM is morning work, so training waits until 7:00 or until 404 opens. */
export function gymWindow(day: number, hours?: DayHours): [number, number] | null {
  const span = hours ? hours[day] : fourOhFour[day]
  if (!span) return null
  const start = Math.max(span[0], 7 * 60)
  if (start >= span[1]) return null
  return [start, span[1]]
}

export const poolLines = [
  'Free swim, fall term through Dec 13',
  'Mon–Wed 10:00 AM–2:00 PM',
  'Thu 10:00 AM–2:00 PM and 6:30–9:00 PM',
  'Fri 11:00 AM–2:00 PM and 6:30–9:00 PM',
  'Sat closed',
  'Sun 8:00 AM–1:00 PM',
  '404 Fitness: Mon–Thu 6:00 AM–10:30 PM, Fri 6:00 AM–8:00 PM, Sat–Sun 8:00 AM–8:00 PM',
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function colorFor(title: string): string {
  const name = title.toLowerCase()
  if (name.includes('swim')) return '#1565c0'
  if (name.includes('bike')) return '#c62828'
  if (name.includes('run')) return '#2e7d32'
  if (name.includes('anterior') || name.includes('posterior')) return '#5d4037'
  return '#5c6bc0'
}

function block(id: string, title: string, day: number, start: number, end: number, place: string): Workout {
  return { id, title, day, start, end, place, color: colorFor(title) }
}

/** Placed in open time around class, with 15 minutes to walk to 14th Street. */
export const defaultWorkouts: Workout[] = [
  block('mon-bike', '25 mile bike', 1, 14 * 60, 15 * 60 + 6, GYM),
  block('mon-run', '5 mile run', 1, 15 * 60 + 6, 15 * 60 + 51, GYM),
  block('mon-swim', '2k swim', 1, 11 * 60, 11 * 60 + 40, POOL),
  block('tue-anterior', 'Anterior', 2, 11 * 60 + 5, 11 * 60 + 50, GYM),
  block('tue-run', '5 mile run', 2, 11 * 60 + 50, 12 * 60 + 35, GYM),
  block('wed-bike', '50 mile bike', 3, 14 * 60, 16 * 60 + 12, GYM),
  block('wed-swim', '2k swim', 3, 11 * 60, 11 * 60 + 40, POOL),
  block('thu-posterior', 'Posterior', 4, 11 * 60 + 5, 11 * 60 + 50, GYM),
  block('thu-run', '5 mile run', 4, 11 * 60 + 50, 12 * 60 + 35, GYM),
  block('fri-anterior', 'Anterior', 5, 8 * 60 + 30, 9 * 60 + 15, GYM),
  block('fri-swim', 'Ironman swim · 2.4 mi', 5, 11 * 60, 12 * 60, POOL),
  block('sat-bike', '100 mile bike', 6, 8 * 60, 12 * 60 + 24, GYM),
  block('sat-run', '3 mile run', 6, 12 * 60 + 24, 12 * 60 + 51, GYM),
  block('sun-run', '15 mile run', 0, 8 * 60, 10 * 60 + 15, GYM),
  block('sun-posterior', 'Posterior', 0, 19 * 60, 19 * 60 + 45, GYM),
]

interface Span {
  day: number
  start: number
  end: number
  title: string
  place: string
}

function classesOnCalendar(): Span[] {
  return meetings.flatMap((meeting) =>
    meeting.days.map((day) => ({
      day,
      start: meeting.start,
      end: meeting.end,
      title: meeting.kind,
      place: meeting.place,
    })),
  )
}

function isSwim(title: string): boolean {
  return /swim/i.test(title)
}

/** Minutes needed between two places. Flatiron is the 2615 store, about 20 minutes away. */
export function travelGap(a: string, b: string): number {
  const zone = (place: string) => {
    if (/flatiron/i.test(place)) return 'work'
    if (/404/.test(place)) return 'gym'
    if (/palladium/i.test(place)) return 'pool'
    if (/washington|mercer/i.test(place)) return 'square'
    return ''
  }
  const left = zone(a)
  const right = zone(b)
  if (left === right) return 0
  if (!left || !right) return 15
  if (left === 'work' || right === 'work') return 20
  if ((left === 'gym' && right === 'square') || (left === 'square' && right === 'gym')) return 10
  return 15
}

function clock(mins: number): string {
  const suffix = mins >= 12 * 60 ? 'PM' : 'AM'
  const hour = Math.floor(mins / 60) % 12 || 12
  const minutes = mins % 60
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function validateWorkouts(
  workouts: Workout[],
  busy: Array<{ day: number; start: number; end: number; title: string; place: string }> = [],
  hours?: DayHours,
): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const workout of workouts) {
    if (!workout.title.trim()) errors.push('A workout is missing a name.')
    if (seen.has(workout.id)) errors.push(`Duplicate id ${workout.id}.`)
    seen.add(workout.id)
    if (workout.day < 0 || workout.day > 6) errors.push(`${workout.title} has a bad day.`)
    if (workout.end <= workout.start) errors.push(`${workout.title} ends before it starts.`)

    const lift = /anterior|posterior/i.test(workout.title)
    const gym = gymWindow(workout.day, hours)
    const windows: Array<[number, number]> = isSwim(workout.title)
      ? (poolWindows[workout.day] ?? [])
      : [...(gym ? [gym] : []), ...(!lift ? [[7 * 60, 21 * 60] as [number, number]] : [])]
    const label = isSwim(workout.title) ? 'Palladium free swim' : lift ? '404 Fitness hours' : 'training hours'
    const fits = windows.some(([open, close]) => workout.start >= open && workout.end <= close)
    if (!fits) {
      const when = windows.length
        ? windows.map(([open, close]) => `${clock(open)}–${clock(close)}`).join(', ')
        : 'closed'
      errors.push(
        `${workout.title} on ${DAY_NAMES[workout.day]} ${clock(workout.start)}–${clock(workout.end)} is outside ${label} (${when}).`,
      )
    }
  }

  const spans: Span[] = [
    ...classesOnCalendar(),
    ...[0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      start: 6 * 60,
      end: 7 * 60,
      title: 'Quran revision and review',
      place: 'Home',
    })),
    ...busy,
    ...workouts.map((workout) => ({
      day: workout.day,
      start: workout.start,
      end: workout.end,
      title: workout.title,
      place: workout.place,
    })),
  ]

  for (let i = 0; i < spans.length; i += 1) {
    for (let j = i + 1; j < spans.length; j += 1) {
      const a = spans[i]
      const b = spans[j]
      if (a.day !== b.day) continue
      if (a.start < b.end && b.start < a.end) {
        errors.push(`${a.title} overlaps ${b.title} on ${DAY_NAMES[a.day]}.`)
      }
      const earlier = a.start <= b.start ? a : b
      const later = earlier === a ? b : a
      const gap = later.start - earlier.end
      const need = travelGap(earlier.place, later.place)
      if (gap >= 0 && gap < need) {
        const trip = /flatiron/i.test(earlier.place) || /flatiron/i.test(later.place) ? 'Flatiron' : 'the next stop'
        errors.push(
          `${earlier.title} and ${later.title} on ${DAY_NAMES[a.day]} need ${need} minutes to get to ${trip}.`,
        )
      }
    }
  }

  return errors
}

const seedProblems = validateWorkouts(defaultWorkouts)
if (seedProblems.length && !process.env.VERCEL) {
  throw new Error(seedProblems.join('\n'))
}

export function normalizeWorkouts(input: unknown): Workout[] {
  if (!Array.isArray(input)) throw new Error('Workouts must be a list.')
  return input.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('A workout was not an object.')
    const row = item as Record<string, unknown>
    const title = String(row.title ?? '').slice(0, 80)
    const day = dayNumber(row.day)
    const start = timeNumber(row.start)
    const end = timeNumber(row.end)
    const place = String(row.place ?? (isSwim(title) ? POOL : GYM)).slice(0, 160)
    const id = String(row.id ?? `w-${day}-${start}-${index}`).slice(0, 60)
    return { id, title, day, start, end, place, color: colorFor(title) }
  })
}

function dayNumber(value: unknown): number {
  if (typeof value === 'number' && value >= 0 && value <= 6) return value
  const name = String(value ?? '').toLowerCase()
  const index = DAY_NAMES.findIndex((day) => day.toLowerCase().startsWith(name.slice(0, 3)))
  if (index >= 0 && name.length >= 2) return index
  throw new Error(`Unknown day "${String(value)}". Use 0 for Sunday through 6 for Saturday.`)
}

function timeNumber(value: unknown): number {
  if (typeof value === 'number' && value >= 0 && value <= 24 * 60) return value
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!match) throw new Error(`Unknown time "${text}".`)
  let hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  const suffix = match[3]?.toLowerCase()
  if (suffix === 'pm' && hour < 12) hour += 12
  if (suffix === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

export function describeWeek(workouts: Workout[]): string {
  const lines = [...workouts]
    .sort((a, b) => a.day - b.day || a.start - b.start)
    .map((workout) => `${DAY_NAMES[workout.day]} ${clock(workout.start)}–${clock(workout.end)} ${workout.title} @ ${workout.place}`)
  return lines.join('\n')
}

export function describeClasses(): string {
  return meetings
    .map((meeting) => {
      const days = meeting.days.map((day) => DAY_NAMES[day].slice(0, 3)).join(', ')
      return `${days} ${clock(meeting.start)}–${clock(meeting.end)} ${meeting.kind} @ ${meeting.place}`
    })
    .join('\n')
}
