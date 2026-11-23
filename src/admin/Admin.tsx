import { FormEvent, useEffect, useState } from 'react'
import { ADMIN_CODE, ADMIN_SESSION_KEY } from './code'
import { WeekCalendar } from './WeekCalendar'
import './admin.css'

export function Admin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === '1')
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    const previous = document.title
    document.title = unlocked ? 'Calendar' : 'Admin'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    return () => {
      document.title = previous
      robots.remove()
    }
  }, [unlocked])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim() === ADMIN_CODE) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
      setUnlocked(true)
      setError(false)
      return
    }
    setError(true)
  }

  if (unlocked) return <WeekCalendar />

  return (
    <main className="gate">
      <form className="gate__card" onSubmit={onSubmit}>
        <p className="gate__kicker">Admin</p>
        <h1>Enter the code</h1>
        <p className="gate__text">The weekly calendar is on the other side.</p>
        <label className="gate__label" htmlFor="admin-code">
          Code
        </label>
        <input
          id="admin-code"
          className="gate__input"
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            setError(false)
          }}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-invalid={error}
          aria-describedby={error ? 'admin-code-error' : undefined}
        />
        {error ? (
          <p className="gate__error" id="admin-code-error">
            That code is not right.
          </p>
        ) : null}
        <button className="gate__submit" type="submit">
          Open calendar
        </button>
        <a className="gate__back" href="/">
          Back to the site
        </a>
      </form>
    </main>
  )
}
