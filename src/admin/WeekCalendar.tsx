import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatPanel } from './ChatPanel'
import { TodoList } from './TodoList'
import { adminHeaders } from './code'
import { HOUR_END, HOUR_PX, HOUR_START, courseById, meetings, quran } from './schedule'
import {
  addDays,
  formatHourLabel,
  formatRange,
  minutesNow,
  sameDay,
  startOfWeek,
  timezoneLabel,
  weekKey,
  weekTitle,
} from './time'

const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index)
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const PAY_RATE = 23
const SCHOOL = '#5f6368'
const WORK = '#101114'
const QURAN = '#f9a825'

function paint(title: string, fallback: string): string {
  const name = title.toLowerCase()
  if (name.includes('swim')) return '#1565c0'
  if (name.includes('bike')) return '#c62828'
  if (name.includes('run')) return '#2e7d32'
  if (name.includes('anterior') || name.includes('posterior')) return '#5d4037'
  return fallback
}

function hourLabel(minutes: number): string {
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1)
}

interface Workout {
  id: string
  title: string
  day: number
  start: number
  end: number
  place: string
  color: string
}

interface Shift {
  day: number
  start: number
  end: number
  title: string
  place: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function WeekCalendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [cursor, setCursor] = useState(() => new Date())
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [extraMinutes, setExtraMinutes] = useState(0)
  const [rosterLabel, setRosterLabel] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setCursor(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = 0
  }, [weekStart])

  useEffect(() => {
    let cancel = false
    fetch(`/api/schedule?week=${weekKey(weekStart)}`, { headers: adminHeaders() })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load the week.')
        return data as {
          workouts: Workout[]
          shifts?: Shift[]
          extraMinutes?: number
          label?: string
          messages: ChatMessage[]
          pool: string[]
          note?: string
        }
      })
      .then((data) => {
        if (cancel) return
        setWorkouts(data.workouts)
        setShifts(data.shifts ?? [])
        setExtraMinutes(data.extraMinutes ?? 0)
        setRosterLabel(data.label ?? '')
        setMessages(data.messages ?? [])
        setNote(data.note ?? '')
      })
      .catch((error: unknown) => {
        if (!cancel) setChatError(error instanceof Error ? error.message : 'Could not load the week.')
      })
    return () => {
      cancel = true
    }
  }, [weekStart])

  const uploadRoster = async (file: File) => {
    setBusy(true)
    setChatError('')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
      const response = await fetch('/api/roster', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ pdf: btoa(binary), name: 'Moustapha' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not read that roster.')
      const [year, month, day] = String(data.week).split('-').map(Number)
      setWeekStart(new Date(year, month - 1, day))
      setWorkouts(data.workouts)
      setShifts(data.shifts ?? [])
      setRosterLabel(data.label ?? '')
      setMessages(data.messages ?? [])
      setNote(data.note ?? '')
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not read that roster.')
    } finally {
      setBusy(false)
    }
  }

  const send = async (message: string) => {
    setBusy(true)
    setChatError('')
    setMessages((current) => [...current, { role: 'user', content: message }])
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ message }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The chat did not answer.')
      if (!shifts.length) setWorkouts(data.workouts)
      setMessages(data.messages ?? [])
      setNote(data.note ?? '')
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'The chat did not answer.')
    } finally {
      setBusy(false)
    }
  }

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )

  const nowMinutes = minutesNow(cursor)
  const showNow =
    nowMinutes >= HOUR_START * 60 &&
    nowMinutes <= HOUR_END * 60 &&
    days.some((day) => sameDay(day, cursor))

  const jumpTo = (date: Date) => {
    setWeekStart(startOfWeek(date))
  }

  const trainingMinutes = workouts.reduce((sum, workout) => sum + (workout.end - workout.start), 0)
  const workMinutes = shifts.reduce((sum, shift) => sum + (shift.end - shift.start), 0) + extraMinutes
  const schoolMinutes = meetings.reduce(
    (sum, meeting) => sum + (meeting.end - meeting.start) * meeting.days.length,
    0,
  )
  const pay = (workMinutes / 60) * PAY_RATE

  return (
    <div className="gcal">
      <header className="gcal__bar">
        <div className="gcal__bar-start">
          <button className="gcal__today" type="button" onClick={() => jumpTo(new Date())}>
            Today
          </button>
          <div className="gcal__nav">
            <button type="button" aria-label="Previous week" onClick={() => jumpTo(addDays(weekStart, -7))}>
              <Chevron direction="left" />
            </button>
            <button type="button" aria-label="Next week" onClick={() => jumpTo(addDays(weekStart, 7))}>
              <Chevron direction="right" />
            </button>
          </div>
          <h1 className="gcal__title">{weekTitle(weekStart)}</h1>
        </div>
        <p className="gcal__quote">
          <span>Become the Uncommon of the Uncommon - goggins</span>
          <span>Perform without a purpose - goggins</span>
          <span>It's so easy to be great because most people are weak - goggins</span>
        </p>
        <div className="gcal__bar-end">
          <label className="gcal__file">
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void uploadRoster(file)
              }}
            />
            Roster
          </label>
          {rosterLabel ? <span className="gcal__roster">{rosterLabel}</span> : null}
          <button
            className="gcal__today"
            type="button"
            aria-expanded={chatOpen}
            onClick={() => setChatOpen((open) => !open)}
          >
            {chatOpen ? 'Hide chat' : 'Chat'}
          </button>
        </div>
      </header>
      <div className="gcal__stats">
        <span>
          Training <strong>{hourLabel(trainingMinutes)} hr</strong>
        </span>
        <span>
          Work <strong>{hourLabel(workMinutes)} hr</strong>
          {extraMinutes > 0 ? <em> incl. {hourLabel(extraMinutes)} hr online</em> : null}
        </span>
        <span>
          Pay <strong>${pay.toFixed(0)}</strong> <em>at ${PAY_RATE}/hr</em>
        </span>
        <span>
          School <strong>{hourLabel(schoolMinutes)} hr</strong>
        </span>
        <span>
          Quran <strong>7 hr</strong>
        </span>
      </div>

      <div className="gcal__body">
        <TodoList />
        <section className="gcal__week" aria-label={`Week of ${weekTitle(weekStart)}`}>
          <div className="gcal__head">
            <div className="gcal__tz">{timezoneLabel(cursor)}</div>
            {days.map((day, index) => {
              const today = sameDay(day, cursor)
              return (
                <div key={day.toISOString()} className={`gcal__dow${today ? ' is-today' : ''}`}>
                  <span>{WEEKDAYS[index]}</span>
                  <strong>{day.getDate()}</strong>
                </div>
              )
            })}
          </div>

          <div className="gcal__scroll" ref={scrollRef}>
            <div
              className="gcal__grid"
              style={{ height: (HOUR_END - HOUR_START) * HOUR_PX }}
            >
              <div className="gcal__gutter" aria-hidden="true">
                {HOURS.slice(1).map((hour) => (
                  <span
                    key={hour}
                    className="gcal__hour"
                    style={{ top: (hour - HOUR_START) * HOUR_PX }}
                  >
                    {formatHourLabel(hour)}
                  </span>
                ))}
              </div>

              <div className="gcal__cols">
                {days.map((day) => (
                  <div key={day.toISOString()} className="gcal__col">
                    {meetings
                      .filter((meeting) => meeting.days.includes(day.getDay()))
                      .map((meeting) => {
                        const course = courseById(meeting.courseId)
                        const top = ((meeting.start - HOUR_START * 60) / 60) * HOUR_PX
                        const height = ((meeting.end - meeting.start) / 60) * HOUR_PX
                        return (
                          <article
                            key={meeting.id}
                            className="gcal__event"
                            style={{ top, height, background: SCHOOL }}
                          >
                            <strong>{course.title}</strong>
                            <span>{meeting.kind}</span>
                            <span>{formatRange(meeting.start, meeting.end)}</span>
                            <span>{meeting.place}</span>
                          </article>
                        )
                      })}
                    <article
                      className="gcal__event gcal__event--quran"
                      style={{
                        top: ((quran.start - HOUR_START * 60) / 60) * HOUR_PX,
                        height: ((quran.end - quran.start) / 60) * HOUR_PX,
                        background: QURAN,
                        color: '#1a1a1a',
                      }}
                    >
                      <strong>{quran.title}</strong>
                      <span>{formatRange(quran.start, quran.end)}</span>
                    </article>
                    {shifts
                          .filter((shift) => shift.day === day.getDay())
                          .map((shift) => {
                            const top = ((shift.start - HOUR_START * 60) / 60) * HOUR_PX
                            const height = ((shift.end - shift.start) / 60) * HOUR_PX
                            return (
                              <article
                                key={`work-${shift.start}`}
                                className="gcal__event gcal__event--work"
                                style={{ top, height, background: WORK }}
                              >
                                <strong>{shift.title}</strong>
                                <span>{formatRange(shift.start, shift.end)}</span>
                                <span>{shift.place}</span>
                              </article>
                            )
                          })}
                    {dayWorkouts(workouts, day.getDay()).map((workout, index, list) => {
                          const top = ((workout.start - HOUR_START * 60) / 60) * HOUR_PX
                          const natural = ((workout.end - workout.start) / 60) * HOUR_PX
                          const next = list[index + 1]?.start
                          const room =
                            next == null ? 36 : ((next - workout.start) / 60) * HOUR_PX - 3
                          const height = Math.max(natural, Math.min(36, Math.max(room, natural)))
                          const short = height < 52
                          return (
                            <article
                              key={workout.id}
                              className={`gcal__event gcal__event--train${short ? ' is-short' : ''}`}
                              style={{ top, height, background: paint(workout.title, workout.color) }}
                            >
                              <strong>{workout.title}</strong>
                              {short ? null : <span>{formatRange(workout.start, workout.end)}</span>}
                              {short ? null : <span>{workout.place}</span>}
                            </article>
                          )
                        })}
                  </div>
                ))}
                {showNow ? (
                  <div
                    className="gcal__now"
                    style={{ top: ((nowMinutes - HOUR_START * 60) / 60) * HOUR_PX }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>
        {chatOpen ? (
          <ChatPanel messages={messages} busy={busy} error={chatError} note={note} onSend={send} />
        ) : null}
      </div>
    </div>
  )
}

function dayWorkouts(workouts: Workout[], day: number) {
  return workouts.filter((workout) => workout.day === day).sort((a, b) => a.start - b.start)
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gcal__chevron">
      <path
        d={direction === 'left' ? 'M14.5 6.5 9 12l5.5 5.5' : 'M9.5 6.5 15 12l-5.5 5.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
