/**
 * The marking criteria template.
 *
 * The admin gives a start date, a finish date and the categories being run.
 * That produces a CSV shaped to their event, which they fill in with their
 * own criteria and upload back.
 */

import { eventDays } from './days.js'
import { toCsv, fromCsv } from './csv.js'

export const COLUMNS = [
  'Category',
  'Day',
  'Date',
  'Slot',
  'Group',
  'Criterion',
  'Max Marks',
  'Requires Reason',
  'Marking Group',
]

/**
 * Columns an upload may leave out entirely, so a file written against an
 * earlier version of the template still imports.
 */
export const OPTIONAL_COLUMNS = ['Requires Reason', 'Marking Group']

const YES = new Set(['yes', 'y', 'true', '1'])
const NO = new Set(['', 'no', 'n', 'false', '0'])

/** Normalise the categories argument into {name, days} objects. */
function normaliseCategories(categories, days) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('Give at least one category, for example Campcraft')
  }
  const allDays = days.map((d) => d.name)
  return categories.map((c) => {
    const name = typeof c === 'string' ? c : c?.name
    if (!name || !String(name).trim()) {
      throw new Error('Every category needs a name')
    }
    const wanted = typeof c === 'string' ? allDays : (c.days ?? allDays)
    return { name: String(name).trim(), days: wanted }
  })
}

/**
 * Build the CSV the admin downloads.
 *
 * @param {object} opts
 * @param {string} [opts.competitionName]
 * @param {string} opts.startDate  YYYY-MM-DD
 * @param {string} opts.endDate    YYYY-MM-DD
 * @param {Array<string|{name: string, days?: string[]}>} opts.categories
 * @returns {string} CSV text
 */
export function buildTemplateCsv({
  competitionName = 'Competition',
  startDate,
  endDate,
  categories,
}) {
  const days = eventDays(startDate, endDate)
  const cats = normaliseCategories(categories, days)

  const notes = [
    `MarkingProgress: marking criteria for ${competitionName}`,
    `${startDate} to ${endDate}`,
    '',
    'Fill in one row for each thing a judge marks. Add as many rows as you',
    'need. Copying an existing row and changing it is easier than starting',
    'from scratch.',
    '',
    'Slot       When in the day, for example Morning, Afternoon, Evening,',
    '           Final Inspection. Leave it blank for a category marked once',
    '           only, like Logbook.',
    'Group      The heading a criterion sits under, for example Tentage.',
    'Criterion  The question the judge answers.',
    'Max Marks  A whole number greater than zero.',
    'Requires   yes or no. Put yes where the judge must write a reason for the',
    'Reason     marks they give, such as bonus points with no set criteria.',
    '           Leave blank for no.',
    'Marking    Only needed where one sheet is split between different sets of',
    'Group      judges, e.g. Yellow and Green. Judges marking Yellow see only',
    '           the Yellow rows. The groups add up to the sheet total.',
    '           Leave blank when every judge marks everything.',
    '',
    'Example of a filled-in row:',
    `${cats[0].name},${days[0].name},${days[0].date},Evening,Tentage,Are all pegs and poles correct?,10,no,`,
    '',
    'Bonus points, where the judge decides and must say why:',
    `${cats[0].name},${days[0].name},${days[0].date},Evening,Bonus Points,Bonus marks awarded,50,yes,`,
    '',
    'A sheet split by colour between two sets of judges:',
    `${cats[0].name},${days[0].name},${days[0].date},Evening,Dining Shelter,Are the sides pulled taut?,15,no,Yellow`,
    `${cats[0].name},${days[0].name},${days[0].date},Evening,Table and Seating,Is the table top secured?,20,no,Green`,
    '',
    'Delete any rows below for a category that is not running that day.',
    'Lines starting with # are ignored when you upload this back.',
  ]

  const rows = [COLUMNS]
  for (const cat of cats) {
    for (const day of days) {
      if (!cat.days.includes(day.name)) continue
      const row = COLUMNS.map(() => '')
      row[0] = cat.name
      row[1] = day.name
      row[2] = day.date
      rows.push(row)
    }
  }

  const header = notes.map((line) => (line ? `# ${line}` : '#')).join('\r\n')
  return `${header}\r\n${toCsv(rows)}\r\n`
}

/** Find each expected column, allowing for reordering and odd spacing. */
function mapHeader(headerRow) {
  const seen = headerRow.map((h) => h.trim().toLowerCase())
  const index = {}
  const missing = []
  for (const col of COLUMNS) {
    const at = seen.indexOf(col.toLowerCase())
    if (at === -1) {
      if (!OPTIONAL_COLUMNS.includes(col)) missing.push(col)
    } else {
      index[col] = at
    }
  }
  return { index, missing }
}

/**
 * Read a filled-in template back.
 *
 * Rows with no Criterion are treated as skeleton rows the admin did not use
 * and are skipped quietly. Anything else wrong is reported rather than
 * guessed at, because a wrong max mark is invisible once the marking starts.
 *
 * @returns {{criteria: Array, errors: string[]}}
 */
export function parseTemplateCsv(text) {
  const rows = fromCsv(String(text ?? ''))
  if (rows.length === 0) {
    return { criteria: [], errors: ['The file is empty'] }
  }

  const { index, missing } = mapHeader(rows[0])
  if (missing.length > 0) {
    return {
      criteria: [],
      errors: [`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`],
    }
  }

  const criteria = []
  const errors = []
  const seen = new Set()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (col) =>
      index[col] === undefined ? '' : (row[index[col]] ?? '').trim()
    const line = r + 1

    const criterion = get('Criterion')
    const category = get('Category')
    const rawMarks = get('Max Marks')

    // An untouched skeleton row: category and day filled in by the export,
    // nothing else. Not an error, they just did not use it.
    if (!criterion && !rawMarks && !get('Group') && !get('Slot')) continue

    if (!category) errors.push(`Row ${line}: no Category`)
    if (!criterion) errors.push(`Row ${line}: no Criterion`)

    let maxMarks = null
    if (!rawMarks) {
      errors.push(`Row ${line}: no Max Marks`)
    } else if (!/^\d+$/.test(rawMarks)) {
      errors.push(
        `Row ${line}: Max Marks must be a whole number, got "${rawMarks}"`,
      )
    } else if (Number(rawMarks) === 0) {
      errors.push(`Row ${line}: Max Marks must be more than zero`)
    } else {
      maxMarks = Number(rawMarks)
    }

    const rawReason = get('Requires Reason').toLowerCase()
    let requiresReason = false
    if (YES.has(rawReason)) {
      requiresReason = true
    } else if (!NO.has(rawReason)) {
      errors.push(
        `Row ${line}: Requires Reason must be yes or no, got "${get('Requires Reason')}"`,
      )
      continue
    }

    if (!category || !criterion || maxMarks === null) continue

    const entry = {
      category,
      day: get('Day'),
      date: get('Date'),
      slot: get('Slot'),
      group: get('Group'),
      criterion,
      maxMarks,
      requiresReason,
      stream: get('Marking Group'),
    }

    const key = [entry.category, entry.day, entry.slot, entry.group, entry.criterion]
      .join('\u0000')
      .toLowerCase()
    if (seen.has(key)) {
      errors.push(`Row ${line}: the same criterion appears twice ("${criterion}")`)
      continue
    }
    seen.add(key)

    criteria.push(entry)
  }

  if (criteria.length === 0 && errors.length === 0) {
    errors.push('No criteria found. Every row was blank.')
  }

  return { criteria, errors }
}

/**
 * Totals per category and per slot.
 *
 * Lets the admin check the numbers against what they expect before the
 * competition, which is the sort of thing that otherwise gets noticed on the
 * Sunday.
 */
export function summarise(criteria) {
  const categories = new Map()

  for (const c of criteria) {
    if (!categories.has(c.category)) {
      categories.set(c.category, { name: c.category, total: 0, count: 0, slots: new Map() })
    }
    const cat = categories.get(c.category)
    cat.total += c.maxMarks
    cat.count += 1

    const slotKey = [c.day, c.slot].filter(Boolean).join(' ') || '(no slot)'
    if (!cat.slots.has(slotKey)) {
      cat.slots.set(slotKey, { name: slotKey, total: 0, count: 0 })
    }
    const slot = cat.slots.get(slotKey)
    slot.total += c.maxMarks
    slot.count += 1
  }

  const list = [...categories.values()].map((c) => ({
    ...c,
    slots: [...c.slots.values()],
  }))

  return {
    categories: list,
    overallTotal: list.reduce((sum, c) => sum + c.total, 0),
    criteriaCount: criteria.length,
  }
}
