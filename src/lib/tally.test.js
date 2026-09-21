import { test } from 'node:test'
import assert from 'node:assert/strict'

import { completeness, tally } from './tally.js'
import { roundTo } from './scoring.js'

/** A competition where one sheet is split by colour, Phoenix style. */
function splitCompetition() {
  const criteria = [
    { id: 'y1', category: 'Campcraft', day: 'Saturday', slot: 'Afternoon', group: 'Dining Shelter', criterion: 'Sides taut?', maxMarks: 140, stream: 'Yellow' },
    { id: 'y2', category: 'Campcraft', day: 'Saturday', slot: 'Afternoon', group: 'Safety', criterion: 'Fire point?', maxMarks: 105, stream: 'Yellow' },
    { id: 'g1', category: 'Campcraft', day: 'Saturday', slot: 'Afternoon', group: 'Table', criterion: 'Top secured?', maxMarks: 140, stream: 'Green' },
    { id: 'g2', category: 'Campcraft', day: 'Saturday', slot: 'Afternoon', group: 'General Site', criterion: 'Boundaries taut?', maxMarks: 110, stream: 'Green' },
  ]
  return {
    id: 'current',
    name: 'Split',
    categories: ['Campcraft'],
    criteria,
    combineRules: { Campcraft: 'average' },
    conflictRule: false,
    teams: [{ id: 't1', name: 'Site 1' }, { id: 't2', name: 'Site 2' }],
    judges: [
      { id: 'j1', name: 'Yellow One', stream: 'Yellow' },
      { id: 'j2', name: 'Yellow Two', stream: 'Yellow' },
      { id: 'j3', name: 'Green One', stream: 'Green' },
      { id: 'j4', name: 'Green Two', stream: 'Green' },
    ],
  }
}

const mark = (judgeId, teamId, criterionId, value) => ({
  judgeId,
  teamId,
  criterionId,
  value,
})

test('a split sheet totals the two colours, out of 495', () => {
  const c = splitCompetition()
  const marks = [
    mark('j1', 't1', 'y1', 130), mark('j1', 't1', 'y2', 100), // 230
    mark('j2', 't1', 'y1', 120), mark('j2', 't1', 'y2', 90),  // 210 -> 220
    mark('j3', 't1', 'g1', 130), mark('j3', 't1', 'g2', 100), // 230
    mark('j4', 't1', 'g1', 120), mark('j4', 't1', 'g2', 90),  // 210 -> 220
  ]

  const ranked = tally(c, marks)
  const site1 = ranked.find((r) => r.team === 'Site 1')

  assert.equal(site1.maxMarks, 495)
  assert.equal(site1.total, 440, 'yellow 220 plus green 220')

  const slot = site1.categories[0].slots[0]
  assert.equal(slot.streamsTotal, 2)
  assert.equal(slot.streams.find((s) => s.name === 'Yellow').value, 220)
  assert.equal(slot.streams.find((s) => s.name === 'Green').value, 220)
})

test('judges who mark only their own colour are not listed as outstanding', () => {
  const c = splitCompetition()
  const marks = [
    mark('j1', 't1', 'y1', 130), mark('j1', 't1', 'y2', 100),
    mark('j2', 't1', 'y1', 120), mark('j2', 't1', 'y2', 90),
    mark('j3', 't1', 'g1', 130), mark('j3', 't1', 'g2', 100),
    mark('j4', 't1', 'g1', 120), mark('j4', 't1', 'g2', 90),
  ]

  const gaps = completeness(c, marks)
  // Site 1 is fully marked. Only Site 2 should appear.
  assert.ok(
    gaps.every((g) => g.team === 'Site 2'),
    `nothing outstanding on Site 1, got ${JSON.stringify(gaps.filter((g) => g.team === 'Site 1'))}`,
  )
  assert.equal(gaps.length, 4, 'four judges still to mark Site 2')
  assert.ok(gaps.every((g) => g.of === 2), 'each judge is down for 2 criteria, not 4')
})

test('a judge who has done half their own colour is listed as part done', () => {
  const c = splitCompetition()
  const marks = [
    mark('j1', 't1', 'y1', 130), // only one of their two
    mark('j2', 't1', 'y1', 120), mark('j2', 't1', 'y2', 90),
    mark('j3', 't1', 'g1', 130), mark('j3', 't1', 'g2', 100),
    mark('j4', 't1', 'g1', 120), mark('j4', 't1', 'g2', 90),
  ]
  const gaps = completeness(c, marks).filter((g) => g.team === 'Site 1')
  assert.equal(gaps.length, 1)
  assert.equal(gaps[0].judge, 'Yellow One')
  assert.equal(gaps[0].state, 'part done')
  assert.equal(gaps[0].marked, 1)
  assert.equal(gaps[0].of, 2)
  assert.equal(gaps[0].stream, 'Yellow')
})

test('a colour with no marks yet scores the other colour only', () => {
  const c = splitCompetition()
  const marks = [
    mark('j1', 't1', 'y1', 140), mark('j1', 't1', 'y2', 105),
    mark('j2', 't1', 'y1', 140), mark('j2', 't1', 'y2', 105),
  ]
  const site1 = tally(c, marks).find((r) => r.team === 'Site 1')
  assert.equal(site1.total, 245, 'yellow only')
  assert.equal(site1.maxMarks, 495)
})

test('a competition with no colours still works exactly as before', () => {
  const c = {
    id: 'current',
    name: 'Plain',
    categories: ['Campcraft'],
    criteria: [
      { id: 'a', category: 'Campcraft', day: 'Saturday', slot: 'Evening', group: '', criterion: 'Pegs?', maxMarks: 10 },
      { id: 'b', category: 'Campcraft', day: 'Saturday', slot: 'Evening', group: '', criterion: 'Guys?', maxMarks: 10 },
    ],
    combineRules: { Campcraft: 'average' },
    conflictRule: false,
    teams: [{ id: 't1', name: 'Kestrel' }],
    judges: [{ id: 'j1', name: 'Judge A' }, { id: 'j2', name: 'Judge B' }],
  }
  const marks = [
    mark('j1', 't1', 'a', 10), mark('j1', 't1', 'b', 8), // 18
    mark('j2', 't1', 'a', 8), mark('j2', 't1', 'b', 6),  // 14
  ]
  const row = tally(c, marks).find((r) => r.team === 'Kestrel')
  assert.equal(row.total, 16)
  assert.equal(row.maxMarks, 20)
  assert.deepEqual(completeness(c, marks), [])
})

test('the conflict rule and colours work together', () => {
  const c = splitCompetition()
  c.conflictRule = true
  c.teams = [{ id: 't1', name: 'Site 1', group: 'Group A' }]
  c.judges = [
    { id: 'j1', name: 'Yellow One', stream: 'Yellow', group: 'Group A' }, // stands down
    { id: 'j2', name: 'Yellow Two', stream: 'Yellow', group: 'Group B' },
    { id: 'j3', name: 'Green One', stream: 'Green', group: 'Group B' },
    { id: 'j4', name: 'Green Two', stream: 'Green', group: 'Group C' },
  ]
  const marks = [
    mark('j2', 't1', 'y1', 140), mark('j2', 't1', 'y2', 105), // yellow, alone
    mark('j3', 't1', 'g1', 140), mark('j3', 't1', 'g2', 110),
    mark('j4', 't1', 'g1', 140), mark('j4', 't1', 'g2', 110),
  ]
  const row = tally(c, marks).find((r) => r.team === 'Site 1')
  assert.equal(row.total, 495, 'full marks, and the conflicted judge is not missed')

  const gaps = completeness(c, marks)
  assert.deepEqual(gaps, [], 'the judge standing down is not an outstanding gap')
})

test('ranking and gaps come through the tally', () => {
  const c = splitCompetition()
  const marks = [
    mark('j1', 't1', 'y1', 140), mark('j1', 't1', 'y2', 105),
    mark('j3', 't1', 'g1', 140), mark('j3', 't1', 'g2', 110),
    mark('j1', 't2', 'y1', 100), mark('j1', 't2', 'y2', 100),
    mark('j3', 't2', 'g1', 100), mark('j3', 't2', 'g2', 100),
  ]
  const ranked = tally(c, marks)
  assert.deepEqual(
    ranked.map((r) => [r.placeLabel, r.team, roundTo(r.total)]),
    [
      ['1st', 'Site 1', 495],
      ['2nd', 'Site 2', 400],
    ],
  )
  assert.equal(ranked[1].gapToAbove, 95)
})

test('an empty competition does not fall over', () => {
  const c = { id: 'x', categories: [], criteria: [], teams: [], judges: [], combineRules: {} }
  assert.deepEqual(tally(c, []), [])
  assert.deepEqual(completeness(c, []), [])
})
