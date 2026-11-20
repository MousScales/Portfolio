import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultWorkouts, type Workout } from './plan.js'
import type { Shift } from './roster.js'

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
}

function config() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

async function rest(path: string, init: RequestInit = {}) {
  const settings = config()
  if (!settings) throw new Error('Supabase is not configured on the server.')
  const { url, key } = settings
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
create table if not exists public.calendar_weeks (
  week text primary key,
  label text not null default '',
  name text not null default '',
  shifts jsonb not null default '[]',
  workouts jsonb not null default '[]',
  extra_minutes int not null default 0
);
alter table public.calendar_workouts enable row level security;
alter table public.calendar_messages enable row level security;
create table if not exists public.calendar_lists (
  id text primary key,
  payload jsonb not null default '[]'
);
alter table public.calendar_weeks enable row level security;
alter table public.calendar_lists enable row level security;
notify pgrst, 'reload schema';
`

async function runSql(query: string) {
  const settings = config()
  if (!settings) throw new Error('Supabase is not configured on the server.')
  const { url, key } = settings
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
let memory: FileStore | null = null
let pushedLocalWeeks = false
const onVercel = Boolean(process.env.VERCEL)

function isNetwork(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}` : ''
  return /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|getaddrinfo/i.test(message)
}

async function storage(): Promise<StorageMode> {
  if (mode === 'supabase') return mode
  if (mode === 'file' && Date.now() < fileUntil) return 'file'
  if (!config()) {
    mode = 'file'
    fileUntil = Date.now() + 30_000
    return mode
  }
  try {
    await rest('calendar_lists?select=id&limit=1')
    mode = 'supabase'
    await pushLocalWeeks()
    return mode
  } catch (error) {
    const code = (error as { code?: string }).code
    const missing = code === 'PGRST205' || /calendar_lists|calendar_weeks|calendar_workouts/.test(String(error))
    if (missing) {
      try {
        await runSql(SCHEMA)
        mode = 'supabase'
        await pushLocalWeeks()
        return mode
      } catch {
        // Fall through to a local or in-memory week so the calendar still opens.
      }
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
  if (onVercel) {
    memory ??= { workouts: [], messages: [] }
    return memory
  }
  try {
    const path = storePath()
    if (!existsSync(path)) return memory ?? { workouts: [], messages: [] }
    return JSON.parse(readFileSync(path, 'utf8')) as FileStore
  } catch {
    return memory ?? { workouts: [], messages: [] }
  }
}

function writeStore(store: FileStore) {
  if (onVercel) {
    memory = store
    return
  }
  try {
    mkdirSync(join(process.cwd(), '.calendar'), { recursive: true })
    writeFileSync(storePath(), JSON.stringify(store, null, 2))
  } catch {
    memory = store
  }
}

export async function storageNote(): Promise<string | null> {
  const current = await storage()
  if (current === 'supabase') return null
  if (onVercel) return 'Supabase is not connected, so this week stays in memory until the server restarts.'
  return 'Supabase did not resolve from this computer, so this week is saved locally and will move to the project when the host answers.'
}

function weekFromRow(row: {
  label?: string
  name?: string
  shifts?: Shift[]
  workouts?: Workout[]
  extra_minutes?: number
}): WeekPlan {
  return {
    label: row.label ?? '',
    name: row.name ?? '',
    shifts: Array.isArray(row.shifts) ? row.shifts : [],
    workouts: Array.isArray(row.workouts) ? row.workouts : [],
    extraMinutes: row.extra_minutes ?? 0,
  }
}

async function upsertWeek(week: string, plan: WeekPlan) {
  await rest('calendar_weeks?on_conflict=week', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      week,
      label: plan.label,
      name: plan.name,
      shifts: plan.shifts,
      workouts: plan.workouts,
      extra_minutes: plan.extraMinutes ?? 0,
    }),
  })
}

async function pushLocalWeeks() {
  if (pushedLocalWeeks || onVercel) return
  pushedLocalWeeks = true
  const weeks = readStore().weeks ?? {}
  for (const [week, plan] of Object.entries(weeks)) {
    await upsertWeek(week, plan)
  }
}

export async function loadWeek(week: string): Promise<WeekPlan> {
  if ((await storage()) === 'supabase') {
    const rows = (await rest(`calendar_weeks?week=eq.${week}&select=*`)) as Array<{
      label?: string
      name?: string
      shifts?: Shift[]
      workouts?: Workout[]
      extra_minutes?: number
    }>
    if (rows[0]) return weekFromRow(rows[0])
  }
  const saved = readStore().weeks?.[week]
  if (saved) return saved
  return { label: '', name: '', shifts: [], workouts: await loadWorkouts() }
}

export async function saveWeek(week: string, plan: WeekPlan) {
  if ((await storage()) === 'supabase') await upsertWeek(week, plan)
  if (onVercel) return
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

export async function loadLists(): Promise<{ todos: unknown; notes: unknown }> {
  if ((await storage()) !== 'supabase') return { todos: null, notes: null }
  const rows = (await rest('calendar_lists?select=id,payload')) as Array<{ id: string; payload: unknown }>
  return {
    todos: rows.find((row) => row.id === 'todos')?.payload ?? null,
    notes: rows.find((row) => row.id === 'notes')?.payload ?? null,
  }
}

export async function saveList(id: 'todos' | 'notes', payload: unknown) {
  if ((await storage()) !== 'supabase') return
  await rest('calendar_lists?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, payload }),
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
