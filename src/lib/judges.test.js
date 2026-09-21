import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  checkComparability,
  checkEligibility,
  conflictedJudges,
  eligibleJudges,
  hasConflict,
} from './judges.js'
import { COMBINE_RULES, combine } from './scoring.js'

// One judge per competing Group, as the Cub County Challenge is staffed.
const JUDGES = [
  { name: 'Judge A', group: 'Group A' },
  { name: 'Judge B', group: 'Group B' },
  { name: 'Judge C', group: 'Group C' },
  { name: 'Judge D', group: 'Group D' },
]

test('a judge may not mark their own Group', () => {
  assert.equal(
    hasConflict({ name: 'Judge A', group: 'Group A' }, { group: 'Group A' }),
    true,
  )
  assert.equal(
    hasConflict({ name: 'Judge A', group: 'Group A' }, { group: 'Group B' }),
    false,
  )
})

test('Group matching ignores case and stray spaces', () => {
  assert.equal(
    hasConflict({ group: ' group a ' }, { group: 'Group A' }),
    true,
    'a trailing space should not let a judge mark their own Group',
  )
})

test('no conflict when a Group is not recorded', () => {
  assert.equal(hasConflict({ name: 'Judge A' }, { group: 'Group A' }), false)
  assert.equal(hasConflict({ group: 'Group A' }, {}), false)
})

test('three of four judges mark each team, and it is always the right three', () => {
  for (const group of ['Group A', 'Group B', 'Group C', 'Group D']) {
    const team = { team: `${group} team`, group }
    const eligible = eligibleJudges(JUDGES, team)
    const conflicted = conflictedJudges(JUDGES, team)

    assert.equal(eligible.length, 3)
    assert.equal(conflicted.length, 1)
    assert.equal(conflicted[0].group, group)
    assert.ok(!eligible.some((j) => j.group === group))
  }
})

test('two teams from the same Group both lose the same judge', () => {
  const a = eligibleJudges(JUDGES, { group: 'Group A' }).map((j) => j.name)
  const b = eligibleJudges(JUDGES, { group: 'Group A' }).map((j) => j.name)
  assert.deepEqual(a, b)
  assert.deepEqual(a, ['Judge B', 'Judge C', 'Judge D'])
})

test('a judge standing down is not counted as a missing mark', () => {
  const team = { group: 'Group A' }
  const eligible = eligibleJudges(JUDGES, team).map((j) => j.name)

  const r = combine(
    [
      { judge: 'Judge B', value: 85 },
      { judge: 'Judge C', value: 88 },
      { judge: 'Judge D', value: 88 },
    ],
    COMBINE_RULES.SUM,
    { expectedJudges: eligible },
  )

  assert.equal(r.value, 261)
  assert.deepEqual(r.missingJudges, [], 'Judge A stood down, that is not missing')
  assert.deepEqual(r.flags, [])
})

test('a judge who has not marked yet is named, ignoring the one standing down', () => {
  const eligible = eligibleJudges(JUDGES, { group: 'Group A' }).map((j) => j.name)
  const r = combine([{ judge: 'Judge B', value: 85 }], COMBINE_RULES.SUM, {
    expectedJudges: eligible,
  })
  assert.deepEqual(r.missingJudges, ['Judge C', 'Judge D'])
})

test('marking your own Group is caught on an import', () => {
  const check = checkEligibility(JUDGES, { group: 'Group A' }, [
    'Judge A',
    'Judge B',
    'Judge C',
  ])
  assert.deepEqual(check.inBreach, ['Judge A'])
  assert.deepEqual(check.awaiting, ['Judge D'])
  assert.deepEqual(check.conflicted, ['Judge A'])
  assert.deepEqual(check.eligible, ['Judge B', 'Judge C', 'Judge D'])
})

test('a clean submission is in breach of nothing', () => {
  const check = checkEligibility(JUDGES, { group: 'Group B' }, [
    'Judge A',
    'Judge C',
    'Judge D',
  ])
  assert.deepEqual(check.inBreach, [])
  assert.deepEqual(check.awaiting, [])
})

// -------------------------------------------- summed marks must be comparable

test('summed scores from an uneven number of judges are flagged', () => {
  // The real danger: with marks added rather than averaged, a team scored by
  // two judges is short by roughly a whole judge's worth.
  const result = checkComparability(
    [
      { team: 'Site 1', submitted: 3 },
      { team: 'Site 2', submitted: 3 },
      { team: 'Site 3', submitted: 2 },
      { team: 'Site 4', submitted: 3 },
    ],
    COMBINE_RULES.SUM,
  )
  assert.equal(result.comparable, false)
  assert.equal(result.expected, 3)
  assert.deepEqual(result.odd, [{ team: 'Site 3', submitted: 2, expected: 3 }])
})

test('an even number of judges everywhere is comparable', () => {
  const result = checkComparability(
    [
      { team: 'Site 1', submitted: 3 },
      { team: 'Site 2', submitted: 3 },
    ],
    COMBINE_RULES.SUM,
  )
  assert.equal(result.comparable, true)
  assert.deepEqual(result.odd, [])
})

test('averaging makes an uneven judge count harmless, so it is not flagged', () => {
  const teams = [
    { team: 'Site 1', submitted: 3 },
    { team: 'Site 2', submitted: 2 },
  ]
  assert.equal(checkComparability(teams, COMBINE_RULES.AVERAGE).comparable, true)
  assert.equal(checkComparability(teams, COMBINE_RULES.SUM).comparable, false)
})

test('comparability copes with an empty competition', () => {
  assert.equal(checkComparability([], COMBINE_RULES.SUM).comparable, true)
  assert.equal(checkComparability(undefined, COMBINE_RULES.SUM).comparable, true)
})

// ------------------------------------- against the real Cub Challenge figures

test('summing three judges reproduces the real Cub tally rows', () => {
  // Check-In, max 100 per judge, three judges each: the tally shows 261.
  const checkIn = combine(
    [
      { judge: 'Judge B', value: 85 },
      { judge: 'Judge C', value: 88 },
      { judge: 'Judge D', value: 88 },
    ],
    COMBINE_RULES.SUM,
  )
  assert.equal(checkIn.value, 261)

  // Campcraft - Boundary, max 130 each: the tally shows 355.
  const boundary = combine(
    [
      { judge: 'Judge B', value: 125 },
      { judge: 'Judge C', value: 120 },
      { judge: 'Judge D', value: 110 },
    ],
    COMBINE_RULES.SUM,
  )
  assert.equal(boundary.value, 355)
})

test('one forgotten mark under summing is bigger than the gap for first place', () => {
  // Real 2026 Cub totals: first 3772, second 3723. A 49 point gap.
  const withAllThree = combine(
    [
      { judge: 'Judge B', value: 115 },
      { judge: 'Judge C', value: 115 },
      { judge: 'Judge D', value: 112 },
    ],
    COMBINE_RULES.SUM,
  )
  const withOneMissing = combine(
    [
      { judge: 'Judge B', value: 115 },
      { judge: 'Judge C', value: 115 },
    ],
    COMBINE_RULES.SUM,
    { expectedJudges: ['Judge B', 'Judge C', 'Judge D'] },
  )

  assert.equal(withAllThree.value, 342)
  assert.equal(withOneMissing.value, 230)
  const cost = withAllThree.value - withOneMissing.value
  assert.equal(cost, 112)
  assert.ok(cost > 49, 'one missing mark outweighs the gap for first place')
  assert.deepEqual(withOneMissing.missingJudges, ['Judge D'])
})
