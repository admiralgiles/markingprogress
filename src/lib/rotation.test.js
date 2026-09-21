import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRotation,
  scheduleFor,
  teamsFor,
  validateRotation,
} from './rotation.js'

const SITES = ['Site 1', 'Site 2', 'Site 3', 'Site 4', 'Site 5', 'Site 6', 'Site 7', 'Site 8']
const STATIONS = ['Hillwalking', 'Backwoods']

// Sites 1 to 4 start at Hillwalking, 5 to 8 at Backwoods, then they swap.
const CUB_ROTATION = buildRotation(STATIONS, [SITES.slice(0, 4), SITES.slice(4)])

test('the real Cub rotation comes out as two rounds that swap', () => {
  assert.equal(CUB_ROTATION.length, 2)

  assert.deepEqual(teamsFor(CUB_ROTATION, 'Hillwalking', 1), [
    'Site 1',
    'Site 2',
    'Site 3',
    'Site 4',
  ])
  assert.deepEqual(teamsFor(CUB_ROTATION, 'Backwoods', 1), [
    'Site 5',
    'Site 6',
    'Site 7',
    'Site 8',
  ])

  // Round two: they have swapped over.
  assert.deepEqual(teamsFor(CUB_ROTATION, 'Hillwalking', 2), [
    'Site 5',
    'Site 6',
    'Site 7',
    'Site 8',
  ])
  assert.deepEqual(teamsFor(CUB_ROTATION, 'Backwoods', 2), [
    'Site 1',
    'Site 2',
    'Site 3',
    'Site 4',
  ])
})

test('every team does both activities, in the right order', () => {
  assert.deepEqual(scheduleFor(CUB_ROTATION, 'Site 1'), [
    { round: 1, station: 'Hillwalking' },
    { round: 2, station: 'Backwoods' },
  ])
  assert.deepEqual(scheduleFor(CUB_ROTATION, 'Site 8'), [
    { round: 1, station: 'Backwoods' },
    { round: 2, station: 'Hillwalking' },
  ])
})

test('the real Cub rotation validates', () => {
  const result = validateRotation(CUB_ROTATION, {
    teams: SITES,
    stations: STATIONS,
  })
  assert.deepEqual(result.issues, [])
  assert.equal(result.valid, true)
})

test('three stations cycle rather than swap', () => {
  const stations = ['A', 'B', 'C']
  const rounds = buildRotation(stations, [['t1'], ['t2'], ['t3']])
  assert.equal(rounds.length, 3)

  // Each team visits all three, once each.
  for (const team of ['t1', 't2', 't3']) {
    const visited = scheduleFor(rounds, team).map((s) => s.station)
    assert.equal(visited.length, 3)
    assert.equal(new Set(visited).size, 3)
  }
  assert.equal(validateRotation(rounds, { teams: ['t1', 't2', 't3'], stations }).valid, true)
})

test('a team booked at two stations in one round is caught', () => {
  const rounds = [
    { round: 1, assignments: { Hillwalking: ['Site 1'], Backwoods: ['Site 1'] } },
    { round: 2, assignments: { Hillwalking: [], Backwoods: [] } },
  ]
  const r = validateRotation(rounds, { teams: ['Site 1'], stations: STATIONS })
  assert.equal(r.valid, false)
  assert.ok(r.issues.some((i) => /at 2 stations at once/.test(i)))
})

test('a team doing the same station twice is caught', () => {
  const rounds = [
    { round: 1, assignments: { Hillwalking: ['Site 1'], Backwoods: [] } },
    { round: 2, assignments: { Hillwalking: ['Site 1'], Backwoods: [] } },
  ]
  const r = validateRotation(rounds, { teams: ['Site 1'], stations: STATIONS })
  assert.equal(r.valid, false)
  assert.ok(r.issues.some((i) => /does Hillwalking 2 times/.test(i)))
})

test('a team left off the plan is caught', () => {
  const rounds = [
    { round: 1, assignments: { Hillwalking: ['Site 1'], Backwoods: ['Site 2'] } },
    { round: 2, assignments: { Hillwalking: ['Site 2'], Backwoods: ['Site 1'] } },
  ]
  const r = validateRotation(rounds, {
    teams: ['Site 1', 'Site 2', 'Site 3'],
    stations: STATIONS,
  })
  assert.equal(r.valid, false)
  assert.ok(
    r.issues.some((i) => /Site 3 never does: Hillwalking, Backwoods/.test(i)),
  )
})

test('a typo in a team or station name is caught, not silently ignored', () => {
  const rounds = [
    { round: 1, assignments: { Hilwalking: ['Site 1'] } },
    { round: 2, assignments: { Backwoods: ['Site 11'] } },
  ]
  const r = validateRotation(rounds, { teams: ['Site 1'], stations: STATIONS })
  assert.ok(r.issues.some((i) => /unknown station "Hilwalking"/.test(i)))
  assert.ok(r.issues.some((i) => /unknown team "Site 11"/.test(i)))
})

test('a mismatch between stations and team groups is refused', () => {
  assert.throws(
    () => buildRotation(STATIONS, [SITES]),
    /one group of teams per station: 2 station\(s\), 1 group\(s\)/,
  )
  assert.throws(() => buildRotation([], []), /at least one station/)
})

test('asking about a round that does not exist gives nothing, not a crash', () => {
  assert.deepEqual(teamsFor(CUB_ROTATION, 'Hillwalking', 3), [])
  assert.deepEqual(teamsFor(CUB_ROTATION, 'Canoeing', 1), [])
  assert.deepEqual(scheduleFor(undefined, 'Site 1'), [])
})
