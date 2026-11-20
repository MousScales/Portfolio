import { FormEvent, useEffect, useRef, useState } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  messages: ChatMessage[]
  busy: boolean
  error: string
  note: string
  onSend: (message: string) => void
}

export function ChatPanel({ messages, busy, error, note, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = logRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, busy])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message || busy) return
    setDraft('')
    onSend(message)
  }

  return (
    <aside className="chat" aria-label="Training chat">
      <header className="chat__bar">
        <h2>Training chat</h2>
        <p>Moves the week. It knows your classes and when the Palladium pool is open.</p>
      </header>
      <div className="chat__log" ref={logRef}>
        {messages.length === 0 ? (
          <p className="chat__empty">
            Try “move the long bike to Sunday morning” or “put Friday’s swim at 6:30 PM”.
          </p>
        ) : (
          messages.map((message, index) => (
            <p key={`${message.role}-${index}`} className={`chat__msg chat__msg--${message.role}`}>
              {message.content}
            </p>
          ))
        )}
        {busy ? <p className="chat__msg chat__msg--assistant">Thinking…</p> : null}
      </div>
      {note ? <p className="chat__note">{note}</p> : null}
      {error ? <p className="chat__error">{error}</p> : null}
      <form className="chat__form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="training-chat">
          Message
        </label>
        <textarea
          id="training-chat"
          value={draft}
          rows={3}
          placeholder="Move a workout…"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </aside>
  )
}
