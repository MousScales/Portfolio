import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultWorkouts, type Workout } from './plan.ts'
import type { Shift } from './roster.ts'

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
}

function config() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase is not configured on the server.')
  return { url: url.replace(/\/$/, ''), key }
}

async function rest(path: string, init: RequestInit = {}) {
  const { url, key } = config()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = body?.message || body?.error || response.statusText
    const error = new Error(message) as Error & { code?: string }
    error.code = body?.code
    throw error
  }
  return body
}

const SCHEMA = `
create table if not exists public.calendar_workouts (
  id text primary key,
  title text not null,
  day smallint not null,
  start_min int not null,
  end_min int not null,
  place text not null default '',
  color text not null default '#5c6bc0'
);
create table if not exists public.calendar_messages (
  id bigint generated always as identity primary key,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.calendar_workouts enable row level security;
alter table public.calendar_messages enable row level security;
notify pgrst, 'reload schema';
`

async function runSql(query: string) {
  const { url, key } = config()
  const ref = new URL(url).hostname.split('.')[0]
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  const attempts = [
    `${url}/pg/query`,
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
  ]
  let last = 'Could not create the Supabase tables.'
  for (const endpoint of attempts) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    })
    if (response.ok) return
    last = `${response.status} ${await response.text()}`
  }
  throw new Error(last)
}

export type StorageMode = 'supabase' | 'file'

let mode: StorageMode | null = null
let fileUntil = 0

function isNetwork(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}` : ''
  return /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|getaddrinfo/i.test(message)
}

async function storage(): Promise<StorageMode> {
  if (mode === 'supabase') return mode
  if (mode === 'file' && Date.now() < fileUntil) return 'file'
  try {
    await rest('calendar_workouts?select=id&limit=1')
    mode = 'supabase'
    return mode
  } catch (error) {
    const code = (error as { code?: string }).code
    const missing = code === 'PGRST205' || /calendar_workouts/.test(String(error))
    if (missing) {
      try {
        await runSql(SCHEMA)
        mode = 'supabase'
        return mode
      } catch (sqlError) {
        if (!isNetwork(sqlError) && !isNetwork(error)) throw sqlError
      }
    } else if (!isNetwork(error)) {
      throw error
    }
    mode = 'file'
    fileUntil = Date.now() + 30_000
    return mode
  }
}

export interface WeekPlan {
  label: string
  name: string
  shifts: Shift[]
  workouts: Workout[]
  /** Paid time that is not a clock shift, such as online training. */
  extraMinutes?: number
}

interface FileStore {
  workouts: Workout[]
  messages: StoredMessage[]
  weeks?: Record<string, WeekPlan>
}

function storePath() {
  return join(process.cwd(), '.calendar', 'store.json')
}

function readStore(): FileStore {
  const path = storePath()
  if (!existsSync(path)) return { workouts: [], messages: [] }
  return JSON.parse(readFileSync(path, 'utf8')) as FileStore
}

function writeStore(store: FileStore) {
  mkdirSync(join(process.cwd(), '.calendar'), { recursive: true })
  writeFileSync(storePath(), JSON.stringify(store, null, 2))
}

export async function storageNote(): Promise<string | null> {
  const current = await storage()
  if (current === 'supabase') return null
  return 'Supabase did not resolve from this computer, so this week is saved locally and will move to the project when the host answers.'
}

export async function loadWeek(week: string): Promise<WeekPlan> {
  const saved = readStore().weeks?.[week]
  if (saved) return saved
  return { label: '', name: '', shifts: [], workouts: await loadWorkouts() }
}

export async function saveWeek(week: string, plan: WeekPlan) {
  const store = readStore()
  store.weeks = store.weeks ?? {}
  store.weeks[week] = plan
  if (!store.workouts?.length) store.workouts = await loadWorkouts()
  writeStore(store)
}

export async function loadWorkouts(): Promise<Workout[]> {
  if ((await storage()) === 'file') {
    const store = readStore()
    if (!store.workouts.length) {
      store.workouts = defaultWorkouts
      writeStore(store)
    }
    return store.workouts
  }
  const rows = (await rest('calendar_workouts?select=*&order=day.asc,start_min.asc')) as Array<{
    id: string
    title: string
    day: number
    start_min: number
    end_min: number
    place: string
    color: string
  }>
  if (!rows.length) {
    await saveWorkouts(defaultWorkouts)
    return defaultWorkouts
  }
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    day: row.day,
    start: row.start_min,
    end: row.end_min,
    place: row.place,
    color: row.color,
  }))
}

export async function saveWorkouts(workouts: Workout[]) {
  if ((await storage()) === 'file') {
    const store = readStore()
    store.workouts = workouts
    writeStore(store)
    return
  }
  await rest('calendar_workouts?id=not.is.null', { method: 'DELETE' })
  if (!workouts.length) return
  await rest('calendar_workouts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(
      workouts.map((workout) => ({
        id: workout.id,
        title: workout.title,
        day: workout.day,
        start_min: workout.start,
        end_min: workout.end,
        place: workout.place,
        color: workout.color,
      })),
    ),
  })
}

export async function loadMessages(): Promise<StoredMessage[]> {
  if ((await storage()) === 'file') return (readStore().messages ?? []).slice(-16)
  const rows = (await rest('calendar_messages?select=role,content&order=id.desc&limit=16')) as StoredMessage[]
  return rows.reverse()
}

export async function saveMessage(role: StoredMessage['role'], content: string) {
  if ((await storage()) === 'file') {
    const store = readStore()
    store.messages = store.messages ?? []
    store.messages.push({ role, content })
    writeStore(store)
    return
  }
  await rest('calendar_messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ role, content }),
  })
}
