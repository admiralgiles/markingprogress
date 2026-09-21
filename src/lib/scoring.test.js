import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  COMBINE_RULES,
  FLAGS,
  combine,
  judgeSlotTotal,
  roundTo,
  scoreCategory,
  scoreSlot,
  validateMarkEntry,
  DEFAULT_STREAM,
} from './scoring.js'

const marks = (...values) =>
  values.map((value, i) => ({ judge: `Judge ${'ABCDEF'[i]}`, value }))

const JUDGES = ['Judge A', 'Judge B', 'Judge C']

// ---------------------------------------------------------------- the rules

test('average takes the mean of the judges who marked it', () => {
  const r = combine(marks(878, 866, 930), COMBINE_RULES.AVERAGE)
  assert.equal(r.value, 2674 / 3)
  assert.equal(r.submitted, 3)
  assert.deepEqual(r.flags, [])
})

test('average ignores a judge who did not mark, as the spreadsheet does', () => {
  const r = combine(
    [
      { judge: 'Judge A', value: 140 },
      { judge: 'Judge B', value: null },
      { judge: 'Judge C', value: 118 },
    ],
    COMBINE_RULES.AVERAGE,
  )
  assert.equal(r.value, 129)
  assert.equal(r.submitted, 2)
})

test('drop high and low keeps the middle of three', () => {
  const r = combine(marks(878, 866, 930), COMBINE_RULES.DROP_HIGH_LOW)
  assert.equal(r.value, 878)
  assert.deepEqual(
    r.dropped.map((d) => d.value),
    [866, 930],
  )
  assert.deepEqual(
    r.used.map((d) => d.value),
    [878],
  )
})

test('drop high and low averages what is left of four', () => {
  const r = combine(marks(10, 20, 30, 40), COMBINE_RULES.DROP_HIGH_LOW)
  assert.equal(r.value, 25)
  assert.deepEqual(
    r.dropped.map((d) => d.value),
    [10, 40],
  )
})

test('drop high and low copes with every judge giving the same mark', () => {
  const r = combine(marks(10, 10, 10), COMBINE_RULES.DROP_HIGH_LOW)
  assert.equal(r.value, 10)
})

test('drop high and low falls back to an average below three judges, and says so', () => {
  const r = combine(marks(100, 200), COMBINE_RULES.DROP_HIGH_LOW)
  assert.equal(r.value, 150)
  assert.ok(r.flags.includes(FLAGS.DROP_FALLBACK))
})

test('sum adds every judge together', () => {
  const r = combine(marks(878, 866, 930), COMBINE_RULES.SUM)
  assert.equal(r.value, 2674)
})

test('single takes the one mark given', () => {
  const r = combine(marks(146), COMBINE_RULES.SINGLE)
  assert.equal(r.value, 146)
  assert.deepEqual(r.flags, [])
})

test('single refuses to guess when two judges have both marked', () => {
  const r = combine(marks(146, 140), COMBINE_RULES.SINGLE)
  assert.equal(r.value, null)
  assert.ok(r.flags.includes(FLAGS.NEEDS_DECISION))
  assert.equal(r.used.length, 2, 'both marks kept for the organiser to see')
})

test('separate hands every mark back without inventing a score', () => {
  const r = combine(marks(325, 350, 340), COMBINE_RULES.SEPARATE)
  assert.equal(r.value, null)
  assert.ok(r.flags.includes(FLAGS.NEEDS_DECISION))
  assert.deepEqual(
    r.used.map((u) => u.value),
    [325, 350, 340],
  )
})

test('no marks at all gives no score rather than zero', () => {
  const r = combine([], COMBINE_RULES.AVERAGE)
  assert.equal(r.value, null)
  assert.ok(r.flags.includes(FLAGS.NO_MARKS))
})

test('a zero mark is a real mark, not a missing one', () => {
  const r = combine(marks(0, 10), COMBINE_RULES.AVERAGE)
  assert.equal(r.value, 5)
  assert.equal(r.submitted, 2)
})

test('an unknown rule is refused loudly', () => {
  assert.throws(() => combine(marks(1), 'median'), /Unknown combining rule/)
})

// ------------------------------------------------------------ completeness

test('a judge who has not marked is named', () => {
  const r = combine(
    [
      { judge: 'Judge A', value: 140 },
      { judge: 'Judge C', value: 118 },
    ],
    COMBINE_RULES.AVERAGE,
    { expectedJudges: JUDGES },
  )
  assert.equal(r.value, 129)
  assert.deepEqual(r.missingJudges, ['Judge B'])
  assert.ok(r.flags.includes(FLAGS.INCOMPLETE))
  assert.equal(r.expected, 3)
  assert.equal(r.submitted, 2)
})

test('a judge marking something they were not assigned is flagged', () => {
  const r = combine(marks(10, 20, 30, 40), COMBINE_RULES.AVERAGE, {
    expectedJudges: JUDGES,
  })
  assert.ok(r.flags.includes(FLAGS.UNEXPECTED_EXTRA_JUDGE))
})

test('a judge who marked only some criteria is flagged as partial', () => {
  const criteria = [
    { id: 'c1', maxMarks: 10 },
    { id: 'c2', maxMarks: 10 },
    { id: 'c3', maxMarks: 10 },
  ]
  const t = judgeSlotTotal(criteria, { c1: 8, c3: 7 })
  assert.equal(t.value, 15)
  assert.equal(t.marked, 2)
  assert.equal(t.of, 3)
  assert.deepEqual(t.missingCriteria, ['c2'])
  assert.equal(t.partial, true)
})

test('a judge who marked nothing is not counted as scoring zero', () => {
  const criteria = [
    { id: 'c1', maxMarks: 10 },
    { id: 'c2', maxMarks: 10 },
  ]
  const t = judgeSlotTotal(criteria, {})
  assert.equal(t.value, null)
  assert.equal(t.partial, false)
})

// -------------------------------------------------------- slots and totals

test('a slot is judge totals first, then combined', () => {
  const criteria = [
    { id: 'pegs', maxMarks: 10 },
    { id: 'guys', maxMarks: 10 },
    { id: 'gear', maxMarks: 10 },
  ]
  const r = scoreSlot({
    criteria,
    marksByJudge: {
      'Judge A': { pegs: 10, guys: 9, gear: 8 }, // 27
      'Judge B': { pegs: 9, guys: 9, gear: 9 }, // 27
      'Judge C': { pegs: 8, guys: 8, gear: 8 }, // 24
    },
    rule: COMBINE_RULES.AVERAGE,
    expectedJudges: JUDGES,
  })
  assert.equal(r.value, 26)
  assert.equal(r.maxMarks, 30)
  assert.deepEqual(r.flags, [])
})

test('a partly marked slot still scores, but carries the flag', () => {
  const criteria = [
    { id: 'a', maxMarks: 10 },
    { id: 'b', maxMarks: 10 },
  ]
  const r = scoreSlot({
    criteria,
    marksByJudge: {
      'Judge A': { a: 10, b: 10 }, // 20, complete
      'Judge B': { a: 6 }, // 6, partial
    },
    rule: COMBINE_RULES.AVERAGE,
    expectedJudges: ['Judge A', 'Judge B'],
  })
  assert.equal(r.value, 13)
  assert.ok(r.flags.includes(FLAGS.PARTIAL_JUDGE))
  assert.equal(r.perJudge.find((p) => p.judge === 'Judge B').partial, true)
})

// ------------------------------------- against the real 2026 Shield figures

test('a full Campcraft category matches the 2026 sheet: 2709', () => {
  // Six slots, three judges, every mark present.
  const slots = [
    [128, 137, 136],
    [131, 131, 142],
    [878, 866, 930],
    [983, 962, 915],
    [244, 242, 237],
    [399, 323, 343],
  ]
  const maxima = [150, 150, 1200, 1200, 300, 455]

  const results = slots.map((values, i) => {
    const r = combine(marks(...values), COMBINE_RULES.AVERAGE, {
      expectedJudges: JUDGES,
    })
    return { ...r, maxMarks: maxima[i] }
  })

  // Each slot against the spreadsheet, to 10 decimal places.
  assert.deepEqual(
    results.map((r) => roundTo(r.value, 10)),
    [
      133.6666666667, 134.6666666667, 891.3333333333, 953.3333333333, 241, 355,
    ],
  )

  const cat = scoreCategory(results)
  assert.equal(roundTo(cat.value, 6), 2709)
  assert.equal(cat.maxMarks, 3455)
  assert.equal(cat.slotsScored, 6)
})

test('a Campcraft category with one judge absent throughout matches the sheet: 3218', () => {
  // The middle judge marked nothing all weekend. The spreadsheet averages
  // the two who did, and so do we.
  const slots = [
    [140, null, 118],
    [142, null, 141],
    [1165, null, 1155],
    [1090, null, 1110],
    [276, null, 262],
    [433, null, 404],
  ]
  const maxima = [150, 150, 1200, 1200, 300, 455]

  const results = slots.map((values, i) => {
    const r = combine(marks(...values), COMBINE_RULES.AVERAGE, {
      expectedJudges: JUDGES,
    })
    return { ...r, maxMarks: maxima[i] }
  })

  assert.deepEqual(
    results.map((r) => r.value),
    [129, 141.5, 1160, 1100, 269, 418.5],
  )
  // Every slot knows a judge was missing, which the spreadsheet cannot say.
  for (const r of results) {
    assert.deepEqual(r.missingJudges, ['Judge B'])
    assert.ok(r.flags.includes(FLAGS.INCOMPLETE))
  }

  const cat = scoreCategory(results)
  assert.equal(cat.value, 3218)
  assert.ok(cat.flags.includes(FLAGS.INCOMPLETE))
})

test('a category total ignores slots nobody has marked yet', () => {
  const results = [
    { value: 100, maxMarks: 150, flags: [] },
    { value: null, maxMarks: 150, flags: [FLAGS.NO_MARKS] },
  ]
  const cat = scoreCategory(results)
  assert.equal(cat.value, 100)
  assert.equal(cat.maxMarks, 300)
  assert.equal(cat.slotsScored, 1)
  assert.equal(cat.slotsTotal, 2)
  assert.ok(cat.flags.includes(FLAGS.NO_MARKS))
})

test('rounding is for display only', () => {
  assert.equal(roundTo(356.6666666666667), 356.67)
  assert.equal(roundTo(407.33333333, 2), 407.33)
  assert.equal(roundTo(null), null)
  assert.equal(roundTo(undefined), null)
})

// ------------------------------------------------- one mark at a time

test('a mark above the maximum available is refused', () => {
  // The 2026 Cub sheet has 134 awarded against a maximum of 130.
  const r = validateMarkEntry(
    { criterion: 'Campcraft Safety', maxMarks: 130 },
    { value: 134 },
  )
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /134 awarded but only 130 available/)
})

test('full marks are fine', () => {
  const r = validateMarkEntry({ criterion: 'x', maxMarks: 130 }, { value: 130 })
  assert.deepEqual(r.errors, [])
  assert.equal(r.ok, true)
})

test('a negative mark is refused', () => {
  const r = validateMarkEntry({ criterion: 'x', maxMarks: 10 }, { value: -1 })
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /less than zero/)
})

test('something that is not a number is refused', () => {
  const r = validateMarkEntry({ criterion: 'x', maxMarks: 10 }, { value: 'nine' })
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /not a number/)
})

test('not marked yet is a legitimate state, not a bad entry', () => {
  for (const value of [null, undefined, '']) {
    assert.equal(validateMarkEntry({ maxMarks: 10 }, { value }).ok, true)
  }
})

test('bonus marks need a reason', () => {
  const bonus = { criterion: 'Bonus marks awarded', maxMarks: 50, requiresReason: true }

  const noReason = validateMarkEntry(bonus, { value: 15 })
  assert.equal(noReason.ok, false)
  assert.match(noReason.errors[0], /a reason is needed/)

  const blankReason = validateMarkEntry(bonus, { value: 15, reason: '   ' })
  assert.equal(blankReason.ok, false)

  const withReason = validateMarkEntry(bonus, {
    value: 15,
    reason: 'Helped another team strike camp',
  })
  assert.equal(withReason.ok, true)
})

test('awarding no bonus needs no explanation', () => {
  const bonus = { criterion: 'Bonus marks awarded', maxMarks: 50, requiresReason: true }
  assert.equal(validateMarkEntry(bonus, { value: 0 }).ok, true)
})

test('an ordinary criterion needs no reason', () => {
  const r = validateMarkEntry({ criterion: 'x', maxMarks: 10 }, { value: 8 })
  assert.equal(r.ok, true)
})

// ---------------------------------------------- streams within one slot

// Phoenix Campcraft: every sheet is split by colour. Two judges mark the
// yellow blocks, two different judges mark the green, each independently,
// and the two colour scores add up to the sheet total.
const YELLOW = [
  { id: 'y1', maxMarks: 100, stream: 'Yellow' },
  { id: 'y2', maxMarks: 145, stream: 'Yellow' }, // 245 yellow
]
const GREEN = [
  { id: 'g1', maxMarks: 140, stream: 'Green' },
  { id: 'g2', maxMarks: 110, stream: 'Green' }, // 250 green
]
const SPLIT_SHEET = [...YELLOW, ...GREEN] // 495, as the real sheet totals
const BY_STREAM = {
  Yellow: ['Judge A', 'Judge B'],
  Green: ['Judge C', 'Judge D'],
}

test('a split sheet adds the colour scores rather than averaging them', () => {
  const r = scoreSlot({
    criteria: SPLIT_SHEET,
    marksByJudge: {
      'Judge A': { y1: 90, y2: 130 }, // 220
      'Judge B': { y1: 80, y2: 120 }, // 200  -> yellow average 210
      'Judge C': { g1: 130, g2: 100 }, // 230
      'Judge D': { g1: 120, g2: 90 }, // 210  -> green average 220
    },
    rule: COMBINE_RULES.AVERAGE,
    judgesByStream: BY_STREAM,
  })

  assert.equal(r.maxMarks, 495)
  assert.equal(r.streamsTotal, 2)
  assert.equal(r.streamsScored, 2)

  const yellow = r.streams.find((s) => s.name === 'Yellow')
  const green = r.streams.find((s) => s.name === 'Green')
  assert.equal(yellow.value, 210)
  assert.equal(yellow.maxMarks, 245)
  assert.equal(green.value, 220)
  assert.equal(green.maxMarks, 250)

  assert.equal(r.value, 430, 'yellow 210 plus green 220')
  assert.deepEqual(r.flags, [])
})

test('a judge marking only their own colour is not flagged as half done', () => {
  // The whole point. Judge A marks yellow and nothing else. That is their
  // job finished, not a gap.
  const r = scoreSlot({
    criteria: SPLIT_SHEET,
    marksByJudge: {
      'Judge A': { y1: 90, y2: 130 },
      'Judge B': { y1: 90, y2: 130 },
      'Judge C': { g1: 130, g2: 100 },
      'Judge D': { g1: 130, g2: 100 },
    },
    rule: COMBINE_RULES.AVERAGE,
    judgesByStream: BY_STREAM,
  })
  assert.ok(
    !r.flags.includes(FLAGS.PARTIAL_JUDGE),
    'marking only your own colour is complete',
  )
  assert.ok(!r.flags.includes(FLAGS.INCOMPLETE))
  assert.equal(r.value, 450)
})

test('a judge missing a criterion inside their own colour is still flagged', () => {
  const r = scoreSlot({
    criteria: SPLIT_SHEET,
    marksByJudge: {
      'Judge A': { y1: 90 }, // y2 skipped: a real gap
      'Judge B': { y1: 90, y2: 130 },
      'Judge C': { g1: 130, g2: 100 },
      'Judge D': { g1: 130, g2: 100 },
    },
    rule: COMBINE_RULES.AVERAGE,
    judgesByStream: BY_STREAM,
  })
  assert.ok(r.flags.includes(FLAGS.PARTIAL_JUDGE))
})

test('a colour nobody has marked yet is named, and the rest still scores', () => {
  const r = scoreSlot({
    criteria: SPLIT_SHEET,
    marksByJudge: {
      'Judge A': { y1: 90, y2: 130 },
      'Judge B': { y1: 90, y2: 130 },
    },
    rule: COMBINE_RULES.AVERAGE,
    judgesByStream: BY_STREAM,
  })
  assert.equal(r.streamsScored, 1)
  assert.equal(r.value, 220, 'yellow only, green not marked')
  const green = r.streams.find((s) => s.name === 'Green')
  assert.equal(green.value, null)
  assert.deepEqual(green.missingJudges, ['Judge C', 'Judge D'])
  assert.ok(green.flags.includes(FLAGS.NO_MARKS))
})

test('one judge short in a colour is flagged, and that colour averages the rest', () => {
  const r = scoreSlot({
    criteria: SPLIT_SHEET,
    marksByJudge: {
      'Judge A': { y1: 90, y2: 130 }, // 220, alone on yellow
      'Judge C': { g1: 130, g2: 100 },
      'Judge D': { g1: 120, g2: 90 },
    },
    rule: COMBINE_RULES.AVERAGE,
    judgesByStream: BY_STREAM,
  })
  const yellow = r.streams.find((s) => s.name === 'Yellow')
  assert.equal(yellow.value, 220)
  assert.deepEqual(yellow.missingJudges, ['Judge B'])
  assert.ok(r.flags.includes(FLAGS.INCOMPLETE))
  assert.equal(r.value, 440)
})

test('a slot with no streams behaves exactly as it did before', () => {
  const criteria = [
    { id: 'a', maxMarks: 10 },
    { id: 'b', maxMarks: 10 },
  ]
  const r = scoreSlot({
    criteria,
    marksByJudge: {
      'Judge A': { a: 10, b: 8 }, // 18
      'Judge B': { a: 8, b: 6 }, // 14
    },
    rule: COMBINE_RULES.AVERAGE,
    expectedJudges: ['Judge A', 'Judge B'],
  })
  assert.equal(r.value, 16)
  assert.equal(r.maxMarks, 20)
  assert.equal(r.streamsTotal, 1)
  assert.equal(r.submitted, 2, 'plain fields still readable without streams')
  assert.deepEqual(r.missingJudges, [])
})

test('the real Phoenix Saturday Afternoon sheet totals 495', () => {
  // Yellow: Dining Shelter 140 + Safety, Hygiene & Theme 105 = 245
  // Green:  Table and Seating 140 + General Site 110        = 250
  const criteria = [
    { id: 'dining', maxMarks: 140, stream: 'Yellow' },
    { id: 'safety', maxMarks: 105, stream: 'Yellow' },
    { id: 'table', maxMarks: 140, stream: 'Green' },
    { id: 'general', maxMarks: 110, stream: 'Green' },
  ]
  const r = scoreSlot({
    criteria,
    marksByJudge: {
      'Judge A': { dining: 140, safety: 105 },
      'Judge B': { dining: 140, safety: 105 },
      'Judge C': { table: 140, general: 110 },
      'Judge D': { table: 140, general: 110 },
    },
    rule: COMBINE_RULES.AVERAGE,
    judgesByStream: BY_STREAM,
  })
  assert.equal(r.maxMarks, 495)
  assert.equal(r.value, 495, 'full marks everywhere comes to the sheet total')
  assert.equal(r.streams.find((s) => s.name === 'Yellow').maxMarks, 245)
  assert.equal(r.streams.find((s) => s.name === 'Green').maxMarks, 250)
})
