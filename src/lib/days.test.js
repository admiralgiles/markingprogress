import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  WEEK_ORDER,
  compareDays,
  dayIndex,
  eventDays,
  parseDate,
  dayName,
} from './days.js'

test('the week starts on Thursday', () => {
  assert.deepEqual(WEEK_ORDER, [
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
  ])
})

test('day names sort into competition order, not calendar order', () => {
  // The case that reads as nonsense under a Monday-first week.
  const satToMon = ['Monday', 'Saturday', 'Sunday']
  assert.deepEqual(
    [...satToMon].sort(compareDays),
    ['Saturday', 'Sunday', 'Monday'],
  )
})

test('dayIndex is case and whitespace tolerant, and flags the unknown', () => {
  assert.equal(dayIndex('Thursday'), 0)
  assert.equal(dayIndex('  sunday '), 3)
  assert.equal(dayIndex('Wednesday'), 6)
  assert.equal(dayIndex('Caturday'), -1)
  assert.equal(dayIndex(undefined), -1)
})

test('2026-05-28 is a Thursday', () => {
  assert.equal(dayName(parseDate('2026-05-28')), 'Thursday')
})

test('the four real event shapes come out in the right order', () => {
  const names = (a, b) => eventDays(a, b).map((d) => d.name)

  // Thursday to Saturday
  assert.deepEqual(names('2026-05-28', '2026-05-30'), [
    'Thursday',
    'Friday',
    'Saturday',
  ])
  // Friday to Sunday
  assert.deepEqual(names('2026-05-29', '2026-05-31'), [
    'Friday',
    'Saturday',
    'Sunday',
  ])
  // Saturday to Monday, the one that goes wrong under a normal week
  assert.deepEqual(names('2026-05-30', '2026-06-01'), [
    'Saturday',
    'Sunday',
    'Monday',
  ])
  // Thursday to Sunday, as Phoenix runs
  assert.deepEqual(names('2026-05-28', '2026-05-31'), [
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ])
})

test('a single day event is allowed', () => {
  assert.deepEqual(eventDays('2026-05-30', '2026-05-30'), [
    { name: 'Saturday', date: '2026-05-30' },
  ])
})

test('days carry their real dates, and cross a month boundary', () => {
  assert.deepEqual(eventDays('2026-05-30', '2026-06-01'), [
    { name: 'Saturday', date: '2026-05-30' },
    { name: 'Sunday', date: '2026-05-31' },
    { name: 'Monday', date: '2026-06-01' },
  ])
})

test('dates the wrong way round are rejected', () => {
  assert.throws(
    () => eventDays('2026-05-31', '2026-05-28'),
    /finish date is before the start date/,
  )
})

test('an absurd range is rejected rather than generating thousands of rows', () => {
  assert.throws(() => eventDays('2026-05-28', '2027-05-28'), /longest event/)
})

test('a date that does not exist is rejected', () => {
  assert.throws(() => parseDate('2026-02-30'), /not a real date/)
  assert.throws(() => parseDate('30-05-2026'), /YYYY-MM-DD/)
  assert.throws(() => parseDate(''), /YYYY-MM-DD/)
})
