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

interface DayGroup {
  day: number
  blocks: Block[]
}

interface Timed {
  block: Block
  day: number
  start: number
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Keeps each training day together. A day stays put when its sessions still fit.
 * Work or a closure moves the whole day, not one workout off it.
 * A bike immediately followed by a run stays one brick.
 */
export function placeAround(
  workouts: Workout[],
  shifts: Shift[],
  poolClosedDays: number[] = [],
  hours?: DayHours,
): { workouts: Workout[]; notes: string[] } {
  const fixed = fixedSpans(shifts)
  const groups = groupDays(
    blocksOf(
      workouts.map((workout) =>
        /swim/i.test(workout.title) ? workout : { ...workout, place: '404 Fitness · 404 Lafayette St' },
      ),
    ),
  )
  const stayers: DayGroup[] = []
  const movers: DayGroup[] = []
  for (const group of groups) {
    if (layout(group, group.day, fixed, true, poolClosedDays, hours)) stayers.push(group)
    else movers.push(group)
  }

  const solved = solve(stayers, movers, fixed, poolClosedDays, hours)
  const placed: Workout[] = []
  const notes: string[] = []
  for (const timed of solved) {
    if (timed.day !== timed.block.day || timed.start !== timed.block.start) {
      notes.push(
        `${DAY_NAMES[timed.block.day]} ${clock(timed.block.start)} ${timed.block.parts.map((part) => part.title).join(' + ')} → ${DAY_NAMES[timed.day]} ${clock(timed.start)}`,
      )
    }
    let cursor = timed.start
    for (const part of timed.block.parts) {
      const duration = part.end - part.start
      const open = gymWindow(timed.day, hours)
      const indoors = open != null && cursor >= open[0] && cursor + duration <= open[1]
      const place = /swim/i.test(part.title)
        ? part.place
        : indoors
          ? '404 Fitness · 404 Lafayette St'
          : 'Outside'
      placed.push({ ...part, day: timed.day, start: cursor, end: cursor + duration, place })
      cursor += duration
    }
  }

  const problems = validateWorkouts(placed, shifts, hours)
  if (problems.length) throw new Error(problems.join('\n'))
  return { workouts: placed, notes }
}

function solve(
  stayers: DayGroup[],
  movers: DayGroup[],
  fixed: Span[],
  poolClosedDays: number[],
  hours?: DayHours,
): Timed[] {
  let best: { score: number; timed: Timed[] } | null = null
  const assign = new Map<number, number>()

  const scoreOf = (timed: Timed[], flexed: boolean) => {
    let score = flexed ? 50_000 : 0
    for (const item of timed) {
      const distance = Math.min(
        Math.abs(item.day - item.block.day),
        7 - Math.abs(item.day - item.block.day),
      )
      if (item.day !== item.block.day) score += 10_000 + distance * 1_000
      score += Math.abs(item.start - item.block.start)
    }
    return score
  }

  const consider = (flexed: boolean) => {
    const timed = arrange(stayers, movers, assign, fixed, flexed, poolClosedDays, hours)
    if (!timed) return
    const score = scoreOf(timed, flexed)
    if (!best || score < best.score) best = { score, timed }
  }

  const walk = (index: number) => {
    if (index === movers.length) {
      consider(false)
      consider(true)
      return
    }
    for (let day = 0; day < 7; day += 1) {
      assign.set(movers[index].day, day)
      walk(index + 1)
    }
  }

  walk(0)
  if (!best) {
    const names = movers.map((group) => DAY_NAMES[group.day]).join(', ')
    throw new Error(`No day can hold ${names || 'the week'} without splitting it.`)
  }
  return best.timed
}

function arrange(
  stayers: DayGroup[],
  movers: DayGroup[],
  assign: Map<number, number>,
  fixed: Span[],
  flexStayers: boolean,
  poolClosedDays: number[],
  hours?: DayHours,
): Timed[] | null {
  const order = flexStayers
    ? [...movers].sort((a, b) => durationOf(b) - durationOf(a))
    : stayers
  const rest = flexStayers ? stayers : [...movers].sort((a, b) => durationOf(b) - durationOf(a))
  let spans = fixed.map((span) => ({ ...span }))
  const timed: Timed[] = []
  for (const group of [...order, ...rest]) {
    const day = assign.get(group.day) ?? group.day
    const pin = !flexStayers && !assign.has(group.day)
    const placed = layout(group, day, spans, pin, poolClosedDays, hours)
    if (!placed) return null
    timed.push(...placed)
    spans = spans.concat(placed.flatMap((item) => occupy(item, hours)))
  }
  return timed
}

function layout(
  group: DayGroup,
  day: number,
  spans: Span[],
  pin: boolean,
  poolClosedDays: number[],
  hours?: DayHours,
): Timed[] | null {
  const working = spans.map((span) => ({ ...span }))
  const timed: Timed[] = []
  for (const block of group.blocks) {
    const own = pin && fits(block, day, block.start, working, poolClosedDays, hours)
    const start = own ? block.start : closest(block, day, working, poolClosedDays, hours)
    if (start == null) return null
    const item = { block, day, start }
    timed.push(item)
    working.push(...occupy(item, hours))
  }
  return timed
}

function closest(
  block: Block,
  day: number,
  spans: Span[],
  poolClosedDays: number[],
  hours?: DayHours,
): number | null {
  let best: { start: number; score: number } | null = null
  for (const [openAt, closeAt] of windowsFor(block, day, poolClosedDays, hours)) {
    const gym = gymWindow(day, hours)
    for (let start = openAt; start + block.duration <= closeAt; start += 5) {
      if (!fits(block, day, start, spans, poolClosedDays, hours)) continue
      const inGym = gym != null && start >= gym[0] && start + block.duration <= gym[1]
      const score = Math.abs(start - block.start) + (inGym ? 0 : 400)
      if (!best || score < best.score) best = { start, score }
    }
  }
  return best ? best.start : null
}

function fits(
  block: Block,
  day: number,
  start: number,
  spans: Span[],
  poolClosedDays: number[],
  hours?: DayHours,
): boolean {
  const allowed = windowsFor(block, day, poolClosedDays, hours).some(
    ([openAt, closeAt]) => start >= openAt && start + block.duration <= closeAt,
  )
  if (!allowed) return false
  const open = gymWindow(day, hours)
  const indoors = !block.swim && open != null && start >= open[0] && start + block.duration <= open[1]
  const candidate = {
    day,
    start,
    end: start + block.duration,
    place: block.swim ? block.place : indoors ? '404 Fitness · 404 Lafayette St' : 'Outside',
  }
  return !spans.some((span) => clashes(candidate, span))
}

function windowsFor(
  block: Block,
  day: number,
  poolClosedDays: number[],
  hours?: DayHours,
): Array<[number, number]> {
  if (block.swim) {
    if (poolClosedDays.includes(day)) return []
    return poolWindows[day] ?? []
  }
  const lift = block.parts.some((part) => /anterior|posterior/i.test(part.title))
  const gym = gymWindow(day, hours)
  const windows: Array<[number, number]> = []
  if (gym) windows.push(gym)
  if (!lift) windows.push([7 * 60, 21 * 60])
  return windows
}

function occupy(item: Timed, hours?: DayHours): Span[] {
  let cursor = item.start
  return item.block.parts.map((part) => {
    const duration = part.end - part.start
    const open = gymWindow(item.day, hours)
    const indoors = open != null && cursor >= open[0] && cursor + duration <= open[1]
    const place = /swim/i.test(part.title)
      ? part.place
      : indoors
        ? '404 Fitness · 404 Lafayette St'
        : 'Outside'
    const span = {
      day: item.day,
      start: cursor,
      end: cursor + duration,
      title: part.title,
      place,
      bike: item.block.bike && duration >= 60,
    }
    cursor += duration
    return span
  })
}

function fixedSpans(shifts: Shift[]): Span[] {
  return [
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
}

function groupDays(blocks: Block[]): DayGroup[] {
  const grouped = new Map<number, Block[]>()
  for (const block of blocks) {
    const list = grouped.get(block.day) ?? []
    list.push(block)
    grouped.set(block.day, list)
  }
  return [...grouped.entries()]
    .map(([day, dayBlocks]) => ({
      day,
      blocks: dayBlocks.sort((a, b) => a.start - b.start),
    }))
    .sort((a, b) => a.day - b.day)
}

function durationOf(group: DayGroup): number {
  return group.blocks.reduce((sum, block) => sum + block.duration, 0)
}

function blocksOf(workouts: Workout[]): Block[] {
  const sorted = [...workouts].sort((a, b) => a.day - b.day || a.start - b.start)
  const used = new Set<string>()
  const blocks: Block[] = []
  for (const workout of sorted) {
    if (used.has(workout.id)) continue
    const parts = [workout]
    let cursor = workout
    for (;;) {
      const next = sorted.find(
        (other) => !used.has(other.id) && other.day === cursor.day && other.start === cursor.end,
      )
      if (!next) break
      parts.push(next)
      used.add(next.id)
      cursor = next
    }
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
  return blocks
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
