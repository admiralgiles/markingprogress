import { test } from 'node:test'
import assert from 'node:assert/strict'

import { COMBINE_RULES, roundTo } from './scoring.js'
import { ordinal, rank, scoreDerivedAward } from './results.js'

test('ordinals are right, including the ones the spreadsheet got wrong', () => {
  // The 2026 sheet has "1nd", "2rd" and "3th" typed in by hand.
  assert.equal(ordinal(1), '1st')
  assert.equal(ordinal(2), '2nd')
  assert.equal(ordinal(3), '3rd')
  assert.equal(ordinal(4), '4th')
  assert.equal(ordinal(5), '5th')
  assert.equal(ordinal(6), '6th')
})

test('ordinals handle the teens and the twenties', () => {
  assert.equal(ordinal(11), '11th')
  assert.equal(ordinal(12), '12th')
  assert.equal(ordinal(13), '13th')
  assert.equal(ordinal(21), '21st')
  assert.equal(ordinal(22), '22nd')
  assert.equal(ordinal(23), '23rd')
  assert.equal(ordinal(101), '101st')
  assert.equal(ordinal(111), '111th')
})

test('the 2026 results table comes out with the same places and gaps', () => {
  // Totals from the Main tab. Team names left out on purpose.
  const teams = [
    { team: 'Site 1', total: 7445.5 },
    { team: 'Site 2', total: 6835.333333333333 },
    { team: 'Site 3', total: 7038.166666666667 },
    { team: 'Site 4', total: 6783.666666666667 },
    { team: 'Site 5', total: 6970.5 },
    { team: 'Site 6', total: 6589.333333333333 },
  ]

  const ranked = rank(teams)

  assert.deepEqual(
    ranked.map((r) => [r.placeLabel, r.team]),
    [
      ['1st', 'Site 1'],
      ['2nd', 'Site 3'],
      ['3rd', 'Site 5'],
      ['4th', 'Site 2'],
      ['5th', 'Site 4'],
      ['6th', 'Site 6'],
    ],
  )

  // The gaps the spreadsheet shows, to two places.
  assert.deepEqual(
    ranked.map((r) => roundTo(r.gapToAbove)),
    [null, 407.33, 67.67, 135.17, 51.67, 194.33],
  )

  assert.equal(ranked[0].behind, 'Leader')
  assert.equal(roundTo(ranked[5].gapToLeader), 856.17)
})

test('teams on the same total share a place and the next one skips', () => {
  const ranked = rank([
    { team: 'A', total: 100 },
    { team: 'B', total: 90 },
    { team: 'C', total: 90 },
    { team: 'D', total: 80 },
  ])
  assert.deepEqual(
    ranked.map((r) => [r.team, r.place, r.tied]),
    [
      ['A', 1, false],
      ['B', 2, true],
      ['C', 2, true],
      ['D', 4, false],
    ],
  )
  assert.equal(ranked[2].gapToAbove, 0)
})

test('a team with nothing scored yet is not ranked as zero', () => {
  const ranked = rank([
    { team: 'A', total: 100 },
    { team: 'B', total: null },
    { team: 'C', total: 50 },
  ])
  assert.deepEqual(
    ranked.map((r) => [r.team, r.placeLabel]),
    [
      ['A', '1st'],
      ['C', '2nd'],
      ['B', null],
    ],
  )
  assert.equal(ranked[2].behind, 'Not yet scored')
})

test('ranking an empty competition does not fall over', () => {
  assert.deepEqual(rank([]), [])
  assert.deepEqual(rank(undefined), [])
})

// --------------------------------------------------- the Environmental award

// The four existing groups plus the two litter criteria that were agreed.
const ENVIRONMENTAL = [
  { id: 'cc-sat-eve-bins-provided', maxMarks: 10 },
  { id: 'cc-sat-eve-bins-used', maxMarks: 10 },
  { id: 'cc-sun-aft-waste-seg', maxMarks: 30 },
  { id: 'cc-sun-aft-bins-used', maxMarks: 30 },
  { id: 'cc-sun-aft-water-fit', maxMarks: 30 },
  { id: 'cc-sun-aft-water-inuse', maxMarks: 30 },
  { id: 'cc-sun-aft-sustainable', maxMarks: 30 },
  { id: 'ce-sat-eve-rubbish', maxMarks: 15 },
  { id: 'ce-sun-eve-rubbish', maxMarks: 15 },
  // added: previously not counted
  { id: 'cc-sun-aft-litter', maxMarks: 15 },
  { id: 'cc-mon-site-clean', maxMarks: 20 },
]

const OTHER_CRITERIA = [
  { id: 'cc-sat-eve-pegs', maxMarks: 10 },
  { id: 'ce-sat-aft-menu', maxMarks: 15 },
]

test('the agreed Environmental award is worth 235', () => {
  const allCriteria = [...ENVIRONMENTAL, ...OTHER_CRITERIA]
  const ids = ENVIRONMENTAL.map((c) => c.id)

  // One judge full marks on everything environmental.
  const fullMarks = Object.fromEntries(ENVIRONMENTAL.map((c) => [c.id, c.maxMarks]))

  const r = scoreDerivedAward({
    criteria: allCriteria,
    criterionIds: ids,
    marksByJudge: { 'Judge A': fullMarks },
    rule: COMBINE_RULES.AVERAGE,
  })

  assert.equal(r.maxMarks, 235)
  assert.equal(r.criteriaCount, 11)
  assert.equal(r.value, 235)
})

test('the award ignores criteria outside it, so nothing leaks in', () => {
  const allCriteria = [...ENVIRONMENTAL, ...OTHER_CRITERIA]
  const r = scoreDerivedAward({
    criteria: allCriteria,
    criterionIds: ['ce-sat-eve-rubbish', 'ce-sun-eve-rubbish'],
    marksByJudge: {
      'Judge A': {
        'ce-sat-eve-rubbish': 14,
        'ce-sun-eve-rubbish': 15,
        'cc-sat-eve-pegs': 10, // counted elsewhere, must not appear here
        'ce-sat-aft-menu': 15,
      },
    },
    rule: COMBINE_RULES.AVERAGE,
  })
  assert.equal(r.value, 29)
  assert.equal(r.maxMarks, 30)
})

test('the award never counts towards the overall total', () => {
  const r = scoreDerivedAward({
    criteria: ENVIRONMENTAL,
    criterionIds: ['ce-sat-eve-rubbish'],
    marksByJudge: { 'Judge A': { 'ce-sat-eve-rubbish': 15 } },
    rule: COMBINE_RULES.AVERAGE,
  })
  assert.equal(r.countsTowardsTotal, false)
})

test('an award pointing at a criterion that does not exist is refused', () => {
  assert.throws(
    () =>
      scoreDerivedAward({
        criteria: ENVIRONMENTAL,
        criterionIds: ['does-not-exist', 'nor-this'],
        marksByJudge: {},
        rule: COMBINE_RULES.AVERAGE,
      }),
    /do not exist: does-not-exist, nor-this/,
  )
})

test('three judges on the Environmental award average out', () => {
  // The real 2026 Cooking and Eating environmental marks for one site.
  const criteria = [
    { id: 'ce-sat-eve-rubbish', maxMarks: 15 },
    { id: 'ce-sun-eve-rubbish', maxMarks: 15 },
  ]
  const r = scoreDerivedAward({
    criteria,
    criterionIds: criteria.map((c) => c.id),
    marksByJudge: {
      'Judge A': { 'ce-sat-eve-rubbish': 14, 'ce-sun-eve-rubbish': 15 }, // 29
      'Judge B': { 'ce-sat-eve-rubbish': 13, 'ce-sun-eve-rubbish': 12 }, // 25
      'Judge C': { 'ce-sat-eve-rubbish': 15, 'ce-sun-eve-rubbish': 15 }, // 30
    },
    rule: COMBINE_RULES.AVERAGE,
    expectedJudges: ['Judge A', 'Judge B', 'Judge C'],
  })
  assert.equal(r.value, 28)
  assert.equal(r.maxMarks, 30)
  assert.deepEqual(r.flags, [])
})
