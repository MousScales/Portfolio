import { inflateSync } from 'node:zlib'

export interface Shift {
  day: number
  start: number
  end: number
  title: string
  place: string
}

export interface RosterWeek {
  name: string
  /** Monday of the roster, `YYYY-MM-DD`. */
  week: string
  label: string
  shifts: Shift[]
}

const PLACE = '2615 Flatiron'
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Item {
  x: number
  y: number
  text: string
}

/** Pull the row with this name from a weekly roster PDF like the 2615 Flatiron export. */
export function parseRoster(pdf: Uint8Array, name = 'Moustapha'): RosterWeek {
  const pages = pagesOf(pdf)
  const wanted = name.trim().toLowerCase()
  if (!wanted) throw new Error('Say which name to look for.')

  let label = ''
  let best: { name: string; shifts: Shift[] } | null = null
  for (const items of pages) {
    if (!label) label = weekLabel(items)
    const row = rowFor(items, wanted)
    if (row && (!best || row.shifts.length > best.shifts.length)) best = row
  }

  if (!best) throw new Error(`No line on this roster matches “${name}”.`)
  if (!best.shifts.length) throw new Error(`${best.name} is on the roster, but that line has no shift times.`)
  if (!label) throw new Error('The roster has no week dates, like “23 Nov - 29 Nov, 2026”.')

  return { name: best.name, week: mondayKey(label), label, shifts: best.shifts }
}

function pagesOf(pdf: Uint8Array): Item[][] {
  const source = latin1(pdf)
  const pages: Item[][] = []
  const objects = source.matchAll(/(\d+) 0 obj[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)
  for (const match of objects) {
    let text: string
    try {
      text = latin1(inflateSync(bytes(match[2])))
    } catch {
      continue
    }
    if (!text.includes('Tj') && !text.includes('TJ')) continue
    const items = itemsOf(text)
    if (items.length) pages.push(items)
  }
  return pages
}

function itemsOf(text: string): Item[] {
  const items: Item[] = []
  for (const block of text.matchAll(/BT\r?\n([\s\S]*?)ET/g)) {
    const body = block[1]
    const placed = body.match(/1 0 0 1 ([0-9.]+) ([0-9.]+) Tm/)
    if (!placed) continue
    let value = ''
    for (const piece of body.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      value += unescapePdf(piece[0].slice(1, -1))
    }
    if (value.trim()) items.push({ x: Number(placed[1]), y: Number(placed[2]), text: value })
  }
  return items
}

function rowFor(items: Item[], wanted: string): { name: string; shifts: Shift[] } | null {
  const named = items.find((item) => item.text.toLowerCase().includes(wanted))
  if (!named) return null
  const headers = items
    .filter((item) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-\d{1,2}$/.test(item.text))
    .sort((a, b) => a.x - b.x)
  if (headers.length < 7) return null

  const cells = new Map<string, string[]>()
  for (const item of items) {
    if (Math.abs(item.y - named.y) > 1.6 || item.x < 60) continue
    const header = headers.reduce((near, next) =>
      Math.abs(next.x - item.x) < Math.abs(near.x - item.x) ? next : near,
    )
    if (Math.abs(header.x - item.x) > 55) continue
    const list = cells.get(header.text) ?? []
    list.push(item.text)
    cells.set(header.text, list)
  }

  const shifts: Shift[] = []
  for (const header of headers) {
    const times = (cells.get(header.text) ?? [])
      .map(clockToMinutes)
      .filter((time): time is number => time != null)
      .sort((a, b) => a - b)
    if (times.length < 2) continue
    const [start, end] = [times[0], times[times.length - 1]]
    if (end <= start) continue
    const code = (cells.get(header.text) ?? []).find((token) => /^[A-Za-z]{2,}\d?$/.test(token))
    const dayName = header.text.slice(0, 3)
    shifts.push({
      day: DAY_INDEX[dayName],
      start,
      end,
      title: code ? `Work · ${code}` : 'Work',
      place: PLACE,
    })
  }
  return { name: named.text.trim(), shifts }
}

function weekLabel(items: Item[]): string {
  const hit = items.find((item) =>
    /\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) - \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec), \d{4}/.test(
      item.text,
    ),
  )
  return hit?.text.trim() ?? ''
}

function mondayKey(label: string): string {
  const match = label.match(/(\d{1,2}) ([A-Za-z]{3}) - \d{1,2} [A-Za-z]{3}, (\d{4})/)
  if (!match) throw new Error(`Could not read the week from “${label}”.`)
  const month = MONTHS.indexOf(match[2].slice(0, 1).toUpperCase() + match[2].slice(1, 3).toLowerCase())
  if (month < 0) throw new Error(`Unknown month in “${label}”.`)
  const start = new Date(Number(match[3]), month, Number(match[1]))
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  const y = start.getFullYear()
  const m = String(start.getMonth() + 1).padStart(2, '0')
  const d = String(start.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clockToMinutes(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*([ap])m?$/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  const suffix = match[3].toLowerCase()
  if (suffix === 'p' && hour < 12) hour += 12
  if (suffix === 'a' && hour === 12) hour = 0
  return hour * 60 + minute
}

function unescapePdf(value: string): string {
  return value.replace(/\\([\\()])/g, '$1').replace(/\\[rn]/g, ' ')
}

function latin1(data: Uint8Array): string {
  let out = ''
  for (let i = 0; i < data.length; i += 1) out += String.fromCharCode(data[i])
  return out
}

function bytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 255
  return out
}
