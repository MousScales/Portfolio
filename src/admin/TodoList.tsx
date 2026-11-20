import { useEffect, useState } from 'react'
import { adminHeaders } from './code'

const TODO_KEY = 'cal-todos'
const NOTES_KEY = 'cal-notes'

interface Item {
  id: string
  text: string
  checkedOn: string
}

interface Folder {
  id: string
  title: string
  items: Item[]
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

function asItem(value: Partial<Item> & { done?: boolean }): Item {
  const checkedOn = typeof value.checkedOn === 'string' ? value.checkedOn : value.done ? todayKey() : ''
  return { id: value.id || uid(), text: value.text ?? '', checkedOn }
}

function blankFolders(fallback: string): Folder[] {
  return [{ id: uid(), title: fallback, items: [] }]
}

function parseFolders(value: unknown, fallback: string): Folder[] {
  if (!Array.isArray(value) || value.length === 0) return blankFolders(fallback)
  const rows = value as Array<Partial<Folder> & Partial<Item>>
  if (rows.every((row) => Array.isArray(row.items))) {
    return rows.map((folder) => ({
      id: folder.id || uid(),
      title: folder.title ?? '',
      items: (folder.items ?? []).map(asItem),
    }))
  }
  return [{ id: uid(), title: fallback, items: rows.map(asItem) }]
}

function loadFolders(key: string, fallback: string): Folder[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return blankFolders(fallback)
    return parseFolders(JSON.parse(raw), fallback)
  } catch {
    return blankFolders(fallback)
  }
}

function meaningful(folders: Folder[], fallback: string): boolean {
  return folders.length > 1 || folders.some((folder) => folder.items.length > 0 || folder.title !== fallback)
}

function Folders({
  heading,
  folders,
  today,
  onChange,
}: {
  heading: string
  folders: Folder[]
  today: string
  onChange: (next: Folder[]) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)

  const addItem = (folderId: string) => {
    const text = (drafts[folderId] ?? '').trim()
    if (!text) return
    onChange(
      folders.map((folder) =>
        folder.id === folderId
          ? { ...folder, items: [...folder.items, { id: uid(), text, checkedOn: '' }] }
          : folder,
      ),
    )
    setDrafts((current) => ({ ...current, [folderId]: '' }))
  }

  const renameItem = (folderId: string, itemId: string, text: string) => {
    const next = text.trim()
    if (next) {
      onChange(
        folders.map((entry) =>
          entry.id === folderId
            ? { ...entry, items: entry.items.map((row) => (row.id === itemId ? { ...row, text: next } : row)) }
            : entry,
        ),
      )
    }
    setEditing(null)
  }

  return (
    <div className="todo__pane">
      <div className="todo__bar">
        <h2>{heading}</h2>
        <button type="button" onClick={() => onChange([...folders, { id: uid(), title: 'New folder', items: [] }])}>
          Folder
        </button>
      </div>
      <div className="todo__scroll">
        {folders.map((folder) => (
          <section key={folder.id}>
            <div className="todo__title">
              <input
                aria-label="Folder name"
                value={folder.title}
                onChange={(event) =>
                  onChange(folders.map((item) => (item.id === folder.id ? { ...item, title: event.target.value } : item)))
                }
              />
              <button
                type="button"
                aria-label={`Remove ${folder.title || 'folder'}`}
                onClick={() => onChange(folders.filter((item) => item.id !== folder.id))}
              >
                ×
              </button>
            </div>
            <ul>
              {folder.items.map((item) => (
                <li key={item.id} className={item.checkedOn === today ? 'is-done' : undefined}>
                  <input
                    type="checkbox"
                    checked={item.checkedOn === today}
                    aria-label={`Done: ${item.text}`}
                    onChange={() =>
                      onChange(
                        folders.map((entry) =>
                          entry.id === folder.id
                            ? {
                                ...entry,
                                items: entry.items.map((row) =>
                                  row.id === item.id
                                    ? { ...row, checkedOn: row.checkedOn === today ? '' : today }
                                    : row,
                                ),
                              }
                            : entry,
                        ),
                      )
                    }
                  />
                  {editing === item.id ? (
                    <input
                      aria-label={`Edit ${item.text}`}
                      defaultValue={item.text}
                      autoFocus
                      onBlur={(event) => {
                        if (event.currentTarget.dataset.cancel === '1') {
                          setEditing(null)
                          return
                        }
                        renameItem(folder.id, item.id, event.currentTarget.value)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                        if (event.key === 'Escape') {
                          event.currentTarget.dataset.cancel = '1'
                          event.currentTarget.blur()
                        }
                      }}
                    />
                  ) : (
                    <button type="button" className="todo__text" onClick={() => setEditing(item.id)}>
                      {item.text}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${item.text}`}
                    onClick={() =>
                      onChange(
                        folders.map((entry) =>
                          entry.id === folder.id
                            ? { ...entry, items: entry.items.filter((row) => row.id !== item.id) }
                            : entry,
                        ),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                addItem(folder.id)
              }}
            >
              <input
                aria-label={`Add to ${folder.title || 'folder'}`}
                placeholder="Add"
                value={drafts[folder.id] ?? ''}
                onChange={(event) => setDrafts((current) => ({ ...current, [folder.id]: event.target.value }))}
              />
              <button type="submit">Add</button>
            </form>
          </section>
        ))}
      </div>
    </div>
  )
}

export function TodoList() {
  const [sections, setSections] = useState<Folder[]>(() => loadFolders(TODO_KEY, 'Reminders'))
  const [notes, setNotes] = useState<Folder[]>(() => loadFolders(NOTES_KEY, 'Notes'))
  const [today, setToday] = useState(todayKey)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setToday(todayKey()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancel = false
    const localTodos = loadFolders(TODO_KEY, 'Reminders')
    const localNotes = loadFolders(NOTES_KEY, 'Notes')
    fetch('/api/lists', { headers: adminHeaders() })
      .then(async (response) => {
        const data = (await response.json()) as { todos?: unknown; notes?: unknown }
        if (!response.ok) throw new Error('Could not load lists.')
        return data
      })
      .then((data) => {
        if (cancel) return
        const remoteTodos = data.todos == null ? null : parseFolders(data.todos, 'Reminders')
        const remoteNotes = data.notes == null ? null : parseFolders(data.notes, 'Notes')
        const todos = remoteTodos && meaningful(remoteTodos, 'Reminders') ? remoteTodos : localTodos
        const nextNotes = remoteNotes && meaningful(remoteNotes, 'Notes') ? remoteNotes : localNotes
        setSections(todos)
        setNotes(nextNotes)
        setReady(true)
        const body: { todos?: Folder[]; notes?: Folder[] } = {}
        if ((!remoteTodos || !meaningful(remoteTodos, 'Reminders')) && meaningful(localTodos, 'Reminders')) body.todos = localTodos
        if ((!remoteNotes || !meaningful(remoteNotes, 'Notes')) && meaningful(localNotes, 'Notes')) body.notes = localNotes
        if (body.todos || body.notes) {
          void fetch('/api/lists', { method: 'PUT', headers: adminHeaders(true), body: JSON.stringify(body) })
        }
      })
      .catch(() => {
        if (!cancel) setReady(true)
      })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(TODO_KEY, JSON.stringify(sections))
    if (!ready) return
    const timer = window.setTimeout(() => {
      void fetch('/api/lists', {
        method: 'PUT',
        headers: adminHeaders(true),
        body: JSON.stringify({ todos: sections }),
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [sections, ready])

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
    if (!ready) return
    const timer = window.setTimeout(() => {
      void fetch('/api/lists', {
        method: 'PUT',
        headers: adminHeaders(true),
        body: JSON.stringify({ notes }),
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [notes, ready])

  return (
    <aside className="todo" aria-label="To-do list and notes">
      <Folders heading="To-do" folders={sections} today={today} onChange={setSections} />
      <Folders heading="Notes" folders={notes} today={today} onChange={setNotes} />
    </aside>
  )
}
