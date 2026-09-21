/**
 * Working out a score from several judges' marks.
 *
 * The rule is chosen per category when the competition is set up, because it
 * varies between competitions and between sections of the same competition.
 *
 * Marks are combined at **judge total** level, not per criterion: each
 * judge's marks for a slot are added up first, then the judges' totals are
 * combined. That matches how the existing spreadsheet works, and it is what
 * "drop the harshest judge" actually means. Combining per criterion instead
 * would let a judge be dropped on one line and kept on the next.
 */

export const COMBINE_RULES = Object.freeze({
  AVERAGE: 'average',
  DROP_HIGH_LOW: 'dropHighLow',
  SUM: 'sum',
  SINGLE: 'single',
  SEPARATE: 'separate',
})

export const COMBINE_RULE_LABELS = Object.freeze({
  average: 'Average of the judges who marked it',
  dropHighLow: 'Drop the highest and lowest, average the rest',
  sum: 'Add all the judges’ marks together',
  single: 'One judge only',
  separate: 'Show each judge separately, a person decides',
})

/** Minimum judges needed before dropping a high and a low leaves anything. */
export const DROP_HIGH_LOW_MIN_JUDGES = 3

export const FLAGS = Object.freeze({
  NO_MARKS: 'no-marks',
  INCOMPLETE: 'incomplete',
  PARTIAL_JUDGE: 'partial-judge',
  NEEDS_DECISION: 'needs-decision',
  UNEXPECTED_EXTRA_JUDGE: 'unexpected-extra-judge',
  DROP_FALLBACK: 'drop-high-low-fallback',
})

function assertRule(rule) {
  const known = Object.values(COMBINE_RULES)
  if (!known.includes(rule)) {
    throw new Error(
      `Unknown combining rule "${rule}". Expected one of: ${known.join(', ')}`,
    )
  }
}

/**
 * Combine a set of judge totals into one score.
 *
 * @param {Array<{judge: string, value: number|null}>} marks
 * @param {string} rule one of COMBINE_RULES
 * @param {object} [opts]
 * @param {string[]} [opts.expectedJudges] who was supposed to mark this
 * @returns {{
 *   value: number|null, rule: string, submitted: number,
 *   expected: number|null, missingJudges: string[],
 *   used: Array<{judge: string, value: number}>,
 *   dropped: Array<{judge: string, value: number}>,
 *   flags: string[],
 * }}
 */
export function combine(marks, rule, opts = {}) {
  assertRule(rule)

  const all = (marks ?? []).filter(
    (m) => m && typeof m.value === 'number' && Number.isFinite(m.value),
  )
  const expectedJudges = opts.expectedJudges ?? null
  const flags = []

  const submittedNames = new Set(all.map((m) => m.judge))
  const missingJudges = expectedJudges
    ? expectedJudges.filter((j) => !submittedNames.has(j))
    : []

  if (missingJudges.length > 0) flags.push(FLAGS.INCOMPLETE)

  if (expectedJudges) {
    const extra = all.filter((m) => !expectedJudges.includes(m.judge))
    if (extra.length > 0) flags.push(FLAGS.UNEXPECTED_EXTRA_JUDGE)
  }

  const base = {
    rule,
    submitted: all.length,
    expected: expectedJudges ? expectedJudges.length : null,
    missingJudges,
    used: [],
    dropped: [],
    flags,
  }

  if (all.length === 0) {
    flags.push(FLAGS.NO_MARKS)
    return { ...base, value: null }
  }

  if (rule === COMBINE_RULES.SEPARATE) {
    flags.push(FLAGS.NEEDS_DECISION)
    return { ...base, value: null, used: all }
  }

  if (rule === COMBINE_RULES.SINGLE) {
    if (all.length > 1) {
      // More than one judge marked something set up for a single judge.
      // Averaging would quietly invent a number nobody gave, so this needs
      // a person.
      flags.push(FLAGS.NEEDS_DECISION)
      return { ...base, value: null, used: all }
    }
    return { ...base, value: all[0].value, used: all }
  }

  if (rule === COMBINE_RULES.SUM) {
    const total = all.reduce((t, m) => t + m.value, 0)
    return { ...base, value: total, used: all }
  }

  if (rule === COMBINE_RULES.DROP_HIGH_LOW) {
    if (all.length < DROP_HIGH_LOW_MIN_JUDGES) {
      // Dropping a high and a low from two marks leaves nothing, so fall
      // back to a plain average and say so.
      flags.push(FLAGS.DROP_FALLBACK)
      return { ...base, value: mean(all.map((m) => m.value)), used: all }
    }
    const sorted = [...all].sort((a, b) => a.value - b.value)
    const dropped = [sorted[0], sorted[sorted.length - 1]]
    const kept = sorted.slice(1, -1)
    return {
      ...base,
      value: mean(kept.map((m) => m.value)),
      used: kept,
      dropped,
    }
  }

  // average
  return { ...base, value: mean(all.map((m) => m.value)), used: all }
}

function mean(values) {
  return values.reduce((t, v) => t + v, 0) / values.length
}

/**
 * One judge's total for a slot.
 *
 * A judge who marked only some of the criteria gets flagged. Their total is
 * not comparable with a judge who marked everything, and averaging the two
 * without saying so is how a team ends up quietly under-scored.
 *
 * @param {Array<{id: string, maxMarks: number}>} criteria
 * @param {Object<string, number>} marks keyed by criterion id
 */
export function judgeSlotTotal(criteria, marks) {
  let total = 0
  const missing = []

  for (const c of criteria) {
    const v = marks?.[c.id]
    if (typeof v === 'number' && Number.isFinite(v)) {
      total += v
    } else {
      missing.push(c.id)
    }
  }

  return {
    value: missing.length === criteria.length ? null : total,
    marked: criteria.length - missing.length,
    of: criteria.length,
    missingCriteria: missing,
    partial: missing.length > 0 && missing.length < criteria.length,
  }
}

/** A criterion with no stream set belongs to the one unnamed stream. */
export const DEFAULT_STREAM = ''

/**
 * Score one slot for one team.
 *
 * A slot can be divided into **streams**: named blocks of criteria, each
 * marked by its own set of judges. Phoenix Campcraft works this way. Every
 * sheet is split by colour, two judges mark the yellow blocks, two different
 * judges mark the green ones, each judge marks independently, and the two
 * colour scores add up to the sheet total.
 *
 * So within a stream the judges are combined by the usual rule, and across
 * streams the results are added. A slot with no streams is just the one
 * unnamed stream, which is why the ordinary case needs no special handling.
 *
 * This is also why a judge marking only the yellow blocks must not be
 * flagged as having marked "some but not all". Within their own stream they
 * are finished. Completeness is per stream, never across the whole slot.
 *
 * @param {object} args
 * @param {Array<{id: string, maxMarks: number, stream?: string}>} args.criteria
 * @param {Object<string, Object<string, number>>} args.marksByJudge
 * @param {string} args.rule
 * @param {string[]} [args.expectedJudges] when the slot has no streams
 * @param {Object<string, string[]>} [args.judgesByStream] who marks each stream
 */
export function scoreSlot({
  criteria,
  marksByJudge,
  rule,
  expectedJudges,
  judgesByStream,
}) {
  const marks = marksByJudge ?? {}
  const streamNames = []
  for (const c of criteria) {
    const name = c.stream ?? DEFAULT_STREAM
    if (!streamNames.includes(name)) streamNames.push(name)
  }

  const streams = []
  for (const name of streamNames) {
    const streamCriteria = criteria.filter(
      (c) => (c.stream ?? DEFAULT_STREAM) === name,
    )

    // Who was meant to mark this stream. Falling back to the slot-wide list
    // keeps a competition without streams behaving exactly as before.
    const expected =
      judgesByStream?.[name] ?? expectedJudges ?? Object.keys(marks)

    const perJudge = []
    const streamFlags = []

    for (const judge of Object.keys(marks)) {
      // A judge only counts towards a stream they were assigned to. Without
      // this, a yellow judge would look like a green judge who marked
      // nothing.
      if (judgesByStream && !expected.includes(judge)) continue

      const t = judgeSlotTotal(streamCriteria, marks[judge])
      if (judgesByStream && t.value === null) continue
      perJudge.push({ judge, ...t })
      if (t.partial) streamFlags.push(FLAGS.PARTIAL_JUDGE)
    }

    const result = combine(
      perJudge.map((p) => ({ judge: p.judge, value: p.value })),
      rule,
      { expectedJudges: expected },
    )

    streams.push({
      ...result,
      name,
      perJudge,
      flags: [...new Set([...result.flags, ...streamFlags])],
      maxMarks: streamCriteria.reduce((t, c) => t + c.maxMarks, 0),
    })
  }

  const scored = streams.filter((s) => typeof s.value === 'number')
  const singleStream = streams.length === 1 ? streams[0] : null

  return {
    // Streams add together. A sheet split 245 yellow and 250 green is a
    // 495 mark sheet, not a 495 mark average.
    value: scored.length > 0 ? scored.reduce((t, s) => t + s.value, 0) : null,
    rule,
    streams,
    streamsScored: scored.length,
    streamsTotal: streams.length,
    // The plain fields stay meaningful for a slot with no streams, so
    // nothing downstream has to know about streams to read a simple slot.
    submitted: singleStream ? singleStream.submitted : null,
    expected: singleStream ? singleStream.expected : null,
    missingJudges: singleStream ? singleStream.missingJudges : [],
    used: singleStream ? singleStream.used : [],
    dropped: singleStream ? singleStream.dropped : [],
    perJudge: singleStream ? singleStream.perJudge : streams.flatMap((s) => s.perJudge),
    flags: [...new Set(streams.flatMap((s) => s.flags))],
    maxMarks: criteria.reduce((t, c) => t + c.maxMarks, 0),
  }
}

/**
 * Add up a team's slot scores to a category total.
 *
 * Full precision is kept and rounding left to display. Rounding each slot
 * before adding them changes the total, and with places decided by fifty
 * marks out of eight and a half thousand that is not a rounding error worth
 * introducing.
 */
export function scoreCategory(slotResults) {
  const usable = slotResults.filter((s) => typeof s.value === 'number')
  const flags = new Set()
  for (const s of slotResults) for (const f of s.flags ?? []) flags.add(f)

  return {
    value: usable.reduce((t, s) => t + s.value, 0),
    maxMarks: slotResults.reduce((t, s) => t + (s.maxMarks ?? 0), 0),
    slotsScored: usable.length,
    slotsTotal: slotResults.length,
    flags: [...flags],
  }
}

/**
 * Check one mark before it is accepted.
 *
 * Two things the spreadsheets cannot catch:
 *
 * - A mark above the maximum available. The 2026 Cub sheet has 134 awarded
 *   against a maximum of 130. It happened not to change the placings, by
 *   about four points of luck.
 * - A criterion the judge must justify, such as bonus marks with no set
 *   criteria, submitted with no reason given.
 *
 * @param {{id?: string, criterion?: string, maxMarks: number, requiresReason?: boolean}} criterion
 * @param {{value: number|null, reason?: string}} entry
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateMarkEntry(criterion, entry) {
  const errors = []
  const label = criterion?.criterion ?? criterion?.id ?? 'this criterion'
  const value = entry?.value

  if (value === null || value === undefined || value === '') {
    // Not marked yet is a legitimate state, handled by the completeness
    // checks rather than treated as a bad entry.
    return { ok: true, errors }
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label}: "${value}" is not a number`)
    return { ok: false, errors }
  }

  if (value < 0) {
    errors.push(`${label}: cannot award less than zero`)
  }

  if (typeof criterion?.maxMarks === 'number' && value > criterion.maxMarks) {
    errors.push(
      `${label}: ${value} awarded but only ${criterion.maxMarks} available`,
    )
  }

  if (criterion?.requiresReason && value > 0) {
    const reason = String(entry?.reason ?? '').trim()
    if (!reason) {
      errors.push(`${label}: a reason is needed for these marks`)
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Round for display only, never for further arithmetic. */
export function roundTo(value, places = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const f = 10 ** places
  return Math.round(value * f) / f
}
