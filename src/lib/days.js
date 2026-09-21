/**
 * Day handling for competitions.
 *
 * The week deliberately starts on Thursday. Shield events run Thursday to
 * Saturday, Friday to Sunday, Saturday to Monday, or Thursday to Sunday for
 * Phoenix. Sorting those by a conventional Monday-first or Sunday-first week
 * puts a Saturday-to-Monday event in the order Monday, Saturday, Sunday,
 * which reads as nonsense on a marking sheet.
 */

export const WEEK_ORDER = [
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
]

/** Longest event we will generate a template for. */
export const MAX_EVENT_DAYS = 14

// Sunday = 0 in JavaScript's getUTCDay().
const JS_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** Position of a day name in the Thursday-first week, or -1 if unknown. */
export function dayIndex(name) {
  if (typeof name !== 'string') return -1
  const wanted = name.trim().toLowerCase()
  return WEEK_ORDER.findIndex((d) => d.toLowerCase() === wanted)
}

/** Comparator that sorts day names into Thursday-first order. */
export function compareDays(a, b) {
  const ia = dayIndex(a)
  const ib = dayIndex(b)
  if (ia === -1 || ib === -1) return String(a).localeCompare(String(b))
  return ia - ib
}

/**
 * Parse a YYYY-MM-DD string as a UTC date.
 *
 * Deliberately UTC. Parsing as local time means someone setting up a
 * competition in a different timezone can see the day names shift.
 */
export function parseDate(text) {
  if (typeof text !== 'string') {
    throw new Error('Date must be text in the form YYYY-MM-DD')
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (!m) {
    throw new Error(`Date must be in the form YYYY-MM-DD, got "${text}"`)
  }
  const [, y, mo, d] = m.map(Number)
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`"${text}" is not a real date`)
  }
  return date
}

/** Format a UTC date back to YYYY-MM-DD. */
export function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

/** Day name for a UTC date, e.g. "Saturday". */
export function dayName(date) {
  return JS_DAY_NAMES[date.getUTCDay()]
}

/**
 * Every day of a competition, in the order it happens.
 *
 * Chronological rather than sorted by weekday, so a Saturday to Monday event
 * comes back as Saturday, Sunday, Monday.
 *
 * @returns {Array<{name: string, date: string}>}
 */
export function eventDays(startDate, endDate) {
  const start = parseDate(startDate)
  const end = parseDate(endDate)

  if (end < start) {
    throw new Error('The finish date is before the start date')
  }

  const span = Math.round((end - start) / 86400000) + 1
  if (span > MAX_EVENT_DAYS) {
    throw new Error(
      `That is ${span} days. The longest event supported is ${MAX_EVENT_DAYS} days, ` +
        'so check the dates are the right way round and in the right year.',
    )
  }

  const days = []
  for (let i = 0; i < span; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    days.push({ name: dayName(d), date: formatDate(d) })
  }
  return days
}
