import { replyTo } from './chat.js'
import { placeAround } from './place.js'
import { poolLines, type DayHours } from './plan.js'
import { parseRoster } from './roster.js'
import { loadMessages, loadWeek, loadWorkouts, saveWeek, storageNote } from './supabase.js'

/** Palladium pool is closed Nov 25–28, 2026. */
function closedPoolDays(week: string): number[] {
  const [year, month, day] = week.split('-').map(Number)
  if (!year || !month || !day) return []
  const monday = new Date(year, month - 1, day)
  const shut = new Set(['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'])
  const days: number[] = []
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (shut.has(key)) days.push(date.getDay())
  }
  return days
}

/** 404 Fitness closures for the week of Nov 23, 2026. */
function gymForWeek(week: string): DayHours | undefined {
  if (week !== '2026-11-23') return undefined
  return {
    0: [10 * 60, 20 * 60],
    1: [6 * 60, 22 * 60 + 30],
    2: [6 * 60, 22 * 60 + 30],
    3: [6 * 60, 12 * 60],
    4: null,
    5: null,
    6: null,
  }
}

function queryValue(path: string, key: string): string {
  const query = path.split('?')[1] ?? ''
  for (const part of query.split('&')) {
    const [name, value = ''] = part.split('=')
    if (decodeURIComponent(name) === key) return decodeURIComponent(value)
  }
  return ''
}

function allowed(headers: Record<string, string | string[] | undefined> | undefined) {
  if (!headers) return false
  const raw = headers['x-admin-code'] ?? headers['X-Admin-Code']
  const code = Array.isArray(raw) ? raw[0] : raw
  return code === (process.env.ADMIN_CODE || '1953')
}

export async function handleApi(
  method: string,
  path: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): Promise<{ status: number; body: unknown }> {
  try {
    if (!allowed(headers)) return { status: 401, body: { error: 'That code is not right.' } }
    const route = path.split('?')[0]
    const week = queryValue(path, 'week')

    if (route === '/api/schedule' && method === 'GET') {
      const [plan, messages, note] = await Promise.all([
        /^\d{4}-\d{2}-\d{2}$/.test(week)
          ? loadWeek(week)
          : loadWorkouts().then((workouts) => ({ workouts, shifts: [], label: '', name: '', extraMinutes: 0 })),
        loadMessages(),
        storageNote(),
      ])
      return {
        status: 200,
        body: {
          workouts: plan.workouts,
          shifts: plan.shifts,
          label: plan.label,
          extraMinutes: plan.extraMinutes ?? 0,
          messages,
          pool: poolLines,
          note,
        },
      }
    }

    if (route === '/api/roster' && method === 'POST') {
      const payload = rawBody ? (JSON.parse(rawBody) as { pdf?: string; name?: string }) : {}
      if (!payload.pdf) return { status: 400, body: { error: 'Choose a roster PDF.' } }
      const roster = parseRoster(Buffer.from(payload.pdf, 'base64'), payload.name || 'Moustapha')
      const base = await loadWorkouts()
      const placed = placeAround(base, roster.shifts, closedPoolDays(roster.week), gymForWeek(roster.week))
      await saveWeek(roster.week, {
        label: roster.label,
        name: roster.name,
        shifts: roster.shifts,
        workouts: placed.workouts,
      })
      const note = placed.notes.join('\n')
      const [messages, storage] = await Promise.all([loadMessages(), storageNote()])
      return {
        status: 200,
        body: {
          week: roster.week,
          label: roster.label,
          name: roster.name,
          shifts: roster.shifts,
          workouts: placed.workouts,
          notes: placed.notes,
          messages,
          pool: poolLines,
          note: [note, storage].filter(Boolean).join('\n'),
        },
      }
    }

    if (route === '/api/chat' && method === 'POST') {
      const payload = rawBody ? (JSON.parse(rawBody) as { message?: string }) : {}
      const message = payload.message?.trim()
      if (!message) return { status: 400, body: { error: 'Say something first.' } }
      const result = await replyTo(message)
      const [messages, note] = await Promise.all([loadMessages(), storageNote()])
      return { status: 200, body: { ...result, messages, pool: poolLines, note } }
    }

    return { status: 404, body: { error: 'Not found.' } }
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined
    const detail = cause instanceof Error ? `${error instanceof Error ? error.message : ''}: ${cause.message}` : null
    return {
      status: 500,
      body: { error: detail || (error instanceof Error ? error.message : 'Something went wrong.') },
    }
  }
}
