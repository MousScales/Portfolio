import { FormEvent, useRef, useState } from 'react'
import { ADMIN_CODE, ADMIN_SESSION_KEY } from '../admin/code'
import { links, navItems, person } from '../data/site'
import { ExternalLink } from './ExternalLink'
import { LinkedInIcon, MailIcon, StravaIcon } from './Icons'

export function Footer() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const openAdmin = () => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === '1') {
      window.location.assign('/admin')
      return
    }
    setCode('')
    setError(false)
    dialogRef.current?.showModal()
    dialogRef.current?.querySelector('input')?.focus()
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim() === ADMIN_CODE) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
      window.location.assign('/admin')
      return
    }
    setError(true)
  }
  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <div className="footer__identity">
          <p className="footer__name">{person.name}</p>
          <p className="footer__line">
            Mathematics &amp; Computer Science · Financial Engineering Minor · Aspiring Quantitative
            Developer · Ironman in Training · It won&rsquo;t always be 70 and sunny
          </p>
        </div>

        <nav className="footer__nav" aria-label="Footer">
          <ul>
            {navItems.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__social">
          <ExternalLink
            href={links.linkedin}
            className="icon-link"
            label="Moustapha Gueye on LinkedIn"
            withArrow={false}
          >
            <LinkedInIcon />
          </ExternalLink>
          <ExternalLink
            href={links.strava}
            className="icon-link"
            label="Moustapha Gueye on Strava"
            withArrow={false}
          >
            <StravaIcon />
          </ExternalLink>
          <a className="icon-link" href={`mailto:${person.email}`} aria-label="Email Moustapha Gueye">
            <MailIcon />
          </a>
        </div>
      </div>

      <div className="shell footer__base">
        <p>© {new Date().getFullYear()} Moustapha Gueye</p>
        <p>
          <button className="btn btn--secondary btn--sm" type="button" onClick={openAdmin}>
            Admin
          </button>
          <ExternalLink href={links.mousApps} className="footer__link" label="Mous Apps website">
            Mous Apps
          </ExternalLink>
          <ExternalLink
            href={links.hillWebWorks}
            className="footer__link"
            label="Hill Web Works website"
          >
            Hill Web Works
          </ExternalLink>
        </p>
      </div>
      <dialog
        className="admin-pop"
        ref={dialogRef}
        aria-labelledby="admin-pop-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current.close()
        }}
      >
        <form className="admin-pop__card" onSubmit={onSubmit}>
          <p className="admin-pop__kicker">Admin</p>
          <h2 id="admin-pop-title">Enter the code</h2>
          <label className="admin-pop__label" htmlFor="admin-code-pop">
            Code
          </label>
          <input
            id="admin-code-pop"
            className="admin-pop__input"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setError(false)
            }}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={error}
            aria-describedby={error ? 'admin-code-pop-error' : undefined}
          />
          {error ? (
            <p className="admin-pop__error" id="admin-code-pop-error">
              That code is not right.
            </p>
          ) : null}
          <div className="admin-pop__actions">
            <button className="btn btn--primary btn--sm" type="submit">
              Open calendar
            </button>
            <button className="btn btn--ghost btn--sm" type="button" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </footer>
  )
}
