/** Weekly classes from the November 2026 schedule. Times are local. */

export interface Course {
  id: string
  title: string
  color: string
}

export interface Meeting {
  id: string
  courseId: string
  kind: 'Lecture' | 'Recitation'
  place: string
  /** 0 = Sunday … 6 = Saturday. Week columns start on Monday. */
  days: number[]
  /** Minutes from midnight. */
  start: number
  end: number
}

export const courses: Course[] = [
  { id: 'arabic', title: 'Elementary Arabic I', color: '#039be5' },
  { id: 'african', title: '18th and 19th Century African', color: '#0b8043' },
  { id: 'texts', title: 'Texts & Ideas: Topics', color: '#8e24aa' },
]

export const meetings: Meeting[] = [
  {
    id: 'texts-recitation',
    courseId: 'texts',
    kind: 'Recitation',
    place: '31 Washington Pl (Silver Ctr), Room 621 · Washington Square',
    days: [4],
    start: 8 * 60,
    end: 9 * 60 + 15,
  },
  {
    id: 'arabic-lecture',
    courseId: 'arabic',
    kind: 'Lecture',
    place: '194 Mercer St, Room 301 · Washington Square',
    days: [1, 2, 3, 4],
    start: 9 * 60 + 30,
    end: 10 * 60 + 45,
  },
  {
    id: 'african-lecture',
    courseId: 'african',
    kind: 'Lecture',
    place: '31 Washington Pl (Silver Ctr), Room 412 · Washington Square',
    days: [1, 3],
    start: 12 * 60 + 30,
    end: 13 * 60 + 45,
  },
  {
    id: 'texts-lecture',
    courseId: 'texts',
    kind: 'Lecture',
    place: '31 Washington Pl (Silver Ctr), Room 520 · Washington Square',
    days: [2, 4],
    start: 14 * 60,
    end: 15 * 60 + 15,
  },
]

export const HOUR_START = 6

/** Daily, before training. Minutes from midnight. */
export const quran = { title: 'Quran revision and review', start: 6 * 60, end: 7 * 60 }
export const HOUR_END = 23
export const HOUR_PX = 96

export function courseById(id: string): Course {
  const course = courses.find((item) => item.id === id)
  if (!course) throw new Error(`Unknown course ${id}`)
  return course
}
