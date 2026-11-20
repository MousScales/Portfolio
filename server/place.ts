import { meetings } from '../src/admin/schedule.js'
import { gymWindow, poolWindows, travelGap, validateWorkouts, type DayHours, type Workout } from './plan.js'
import type { Shift } from './roster.js'

interface Span {
  day: number
  start: number
  end: number
  title: string
  place: string
  bike: boolean
}

interface Block {
  parts: Workout[]
  day: number
  start: number
  duration: number
  place: string
  bike: boolean
  swim: boolean
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Moves training off work shifts. A bike immediately followed by a run stays one brick.
 * shortcut: placement is rule-based because the chat model has no credits. Upgrade when the API can take the tool call.
 */
export function placeAround(
  workouts: Workout[],
  shifts: Shift[],
  poolClosedDays: number[] = [],
  hours?: DayHours,
): { workouts: Workout[]; notes: string[] } {
  const spans: Span[] = [
    ...meetings.flatMap((meeting) =>
      meeting.days.map((day) => ({
        day,
        start: meeting.start,
        end: meeting.end,
        title: meeting.kind,
        place: meeting.place,
        bike: false,
      })),
    ),
    ...shifts.map((shift) => ({ ...shift, bike: false })),
    ...[0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      start: 6 * 60,
      end: 7 * 60,
      title: 'Quran revision and review',
      place: 'Home',
      bike: false,
    })),
  ]
  const notes: string[] = []
  const placed: Workout[] = []
  const keepers: Block[] = []
  const movers: Block[] = []
  const blocks = blocksOf(
    workouts.map((workout) =>
      /swim/i.test(workout.title) ? workout : { ...workout, place: '404 Fitness · 404 Lafayette St' },
    ),
  )
  const reserved: Span[] = blocks.map((block) => ({
    day: block.day,
    start: block.start,
    end: block.start + block.duration,
    title: block.parts[0].id,
    place: block.place,
    bike: false,
  }))
  for (const block of blocks) {
    const here = { day: block.day, start: block.start, end: block.start + block.duration, place: block.place }
    const poolShut = block.swim && poolClosedDays.includes(block.day)
    if (poolShut || shifts.some((shift) => clashes(here, shift))) movers.push(block)
    else keepers.push(block)
  }

  const commit = (block: Block, day: number, start: number) => {
    if (day !== block.day || start !== block.start) {
      notes.push(
        `${DAY_NAMES[block.day]} ${clock(block.start)} ${block.parts.map((part) => part.title).join(' + ')} → ${DAY_NAMES[day]} ${clock(start)}`,
      )
    }
    let cursor = start
    for (const part of block.parts) {
      const duration = part.end - part.start
      const open = gymWindow(day, hours)
      const indoors = open != null && cursor >= open[0] && cursor + duration <= open[1]
      const place = /swim/i.test(part.title)
        ? part.place
        : indoors
          ? '404 Fitness · 404 Lafayette St'
          : 'Outside'
      const next = { ...part, day, start: cursor, end: cursor + duration, place }
      placed.push(next)
      spans.push({ ...next, bike: block.bike && part.end - part.start >= 60 })
      cursor += duration
    }
  }

  const place = (block: Block, day: number, start: number) => commit(block, day, start)
  const relocate = (block: Block) => {
    const slot = findSlot(block, spans, poolClosedDays, hours)
    if (!slot) throw new Error(`No open time left for ${block.parts.map((part) => part.title).join(' + ')}.`)
    place(block, slot.day, slot.start)
  }

  const anchored = movers.filter((block) => {
    const occupied = reserved.filter((span) => span.title !== block.parts[0].id)
    return findSlot(block, [...spans, ...occupied], poolClosedDays, hours)?.day === block.day
  })
  const loose = movers.filter((block) => !anchored.includes(block))
  const bumped: Block[] = []

  for (const block of keepers.filter((block) => block.swim)) place(block, block.day, block.start)
  for (const block of anchored.sort((a, b) => b.duration - a.duration)) relocate(block)
  for (const block of loose.filter((block) => block.swim).sort((a, b) => b.duration - a.duration)) relocate(block)
  for (const block of keepers.filter((block) => !block.swim)) {
    const here = { day: block.day, start: block.start, end: block.start + block.duration, place: block.place }
    if (spans.some((span) => clashes(here, span))) bumped.push(block)
    else place(block, block.day, block.start)
  }
  for (const block of [...bumped, ...loose.filter((block) => !block.swim)].sort((a, b) => b.duration - a.duration)) {
    relocate(block)
  }

  const problems = validateWorkouts(placed, shifts, hours)
  if (problems.length) throw new Error(problems.join('\n'))
  return { workouts: placed, notes }
}

function blocksOf(workouts: Workout[]): Block[] {
  const sorted = [...workouts].sort((a, b) => a.day - b.day || a.start - b.start)
  const used = new Set<string>()
  const blocks: Block[] = []
  for (const workout of sorted) {
    if (used.has(workout.id)) continue
    const run = sorted.find(
      (other) =>
        !used.has(other.id) &&
        other.day === workout.day &&
        other.start === workout.end &&
        /bike/i.test(workout.title) &&
        /run/i.test(other.title),
    )
    const parts = run ? [workout, run] : [workout]
    for (const part of parts) used.add(part.id)
    const end = parts[parts.length - 1].end
    blocks.push({
      parts,
      day: workout.day,
      start: workout.start,
      duration: end - workout.start,
      place: workout.place,
      bike: /bike/i.test(workout.title),
      swim: parts.some((part) => /swim/i.test(part.title)),
    })
  }
  return blocks.sort((a, b) => b.duration - a.duration)
}

function findSlot(
  block: Block,
  spans: Span[],
  poolClosedDays: number[],
  hours?: DayHours,
): { day: number; start: number } | null {
  const open = search(block, spans, true, poolClosedDays, hours)
  return open ?? (block.bike ? search(block, spans, false, poolClosedDays, hours) : null)
}

function search(
  block: Block,
  spans: Span[],
  avoidLongBike: boolean,
  poolClosedDays: number[],
  hours?: DayHours,
): { day: number; start: number } | null {
  const order = [block.day, ...[0, 1, 2, 3, 4, 5, 6].filter((day) => day !== block.day)]
  let best: { day: number; start: number; score: number } | null = null
  for (const day of order) {
    if (block.swim && poolClosedDays.includes(day)) continue
    if (avoidLongBike && day !== block.day && block.bike && spans.some((span) => span.day === day && span.bike)) continue
    const gym = gymWindow(day, hours)
    const lift = block.parts.some((part) => /anterior|posterior/i.test(part.title))
    const windows: Array<[number, number]> = block.swim ? (poolWindows[day] ?? []) : []
    if (!block.swim && gym) windows.push(gym)
    if (!block.swim && !lift) windows.push([7 * 60, 21 * 60])
    for (const [openAt, closeAt] of windows) {
      for (let start = openAt; start + block.duration <= closeAt; start += 5) {
        const candidate = { day, start, end: start + block.duration, place: block.place, title: block.parts[0].title }
        if (spans.some((span) => clashes(candidate, span))) continue
        const distance = Math.min(Math.abs(day - block.day), 7 - Math.abs(day - block.day))
        const inGym = gym != null && start >= gym[0] && start + block.duration <= gym[1]
        const score = (day === block.day ? 0 : 1 + distance) * 10000 + Math.abs(start - block.start) + (inGym ? 0 : 800)
        if (!best || score < best.score) best = { day, start, score }
      }
    }
  }
  return best ? { day: best.day, start: best.start } : null
}

function clashes(
  a: { day: number; start: number; end: number; place: string },
  b: { day: number; start: number; end: number; place: string },
): boolean {
  if (a.day !== b.day) return false
  if (a.start < b.end && b.start < a.end) return true
  const earlier = a.start <= b.start ? a : b
  const later = earlier === a ? b : a
  const gap = later.start - earlier.end
  const need = travelGap(earlier.place, later.place)
  return gap >= 0 && gap < need
}

function clock(mins: number): string {
  const suffix = mins >= 12 * 60 ? 'PM' : 'AM'
  const hour = Math.floor(mins / 60) % 12 || 12
  const minutes = mins % 60
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`
}
