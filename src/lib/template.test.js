import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fromCsv, toCsv } from './csv.js'
import {
  COLUMNS,
  buildTemplateCsv,
  parseTemplateCsv,
  summarise,
} from './template.js'

const dataRows = (csv) => fromCsv(csv).slice(1)

test('criteria text with commas, quotes and apostrophes survives a round trip', () => {
  const awkward = [
    'Are cooking utensils, pots and pans to be used clean?',
    "Are the chefs' hands clean and covered safely in instance of cuts/injury?",
    'Is the food being prepared hygenically, e.g. no cross-contamination etc.',
    'He said "put the bins out"',
    'Line one\nline two',
  ]
  const round = fromCsv(toCsv(awkward.map((a) => [a, 15])))
  assert.deepEqual(
    round.map((r) => r[0]),
    awkward,
  )
  assert.deepEqual(
    round.map((r) => r[1]),
    ['15', '15', '15', '15', '15'],
  )
})

test('a byte order mark from Excel does not corrupt the first column', () => {
  const rows = fromCsv('﻿Category,Day\nCampcraft,Saturday')
  assert.equal(rows[0][0], 'Category')
})

test('the export carries a row for every category on every day', () => {
  const csv = buildTemplateCsv({
    competitionName: 'Liffey West County Shield',
    startDate: '2026-05-30',
    endDate: '2026-06-01',
    categories: ['Campcraft', 'Cooking and Eating'],
  })

  assert.deepEqual(fromCsv(csv)[0], COLUMNS)

  const rows = dataRows(csv)
  assert.equal(rows.length, 6) // 2 categories x 3 days
  assert.deepEqual(rows[0].slice(0, 3), ['Campcraft', 'Saturday', '2026-05-30'])
  assert.deepEqual(rows[2].slice(0, 3), ['Campcraft', 'Monday', '2026-06-01'])
  assert.deepEqual(rows[3].slice(0, 3), [
    'Cooking and Eating',
    'Saturday',
    '2026-05-30',
  ])
})

test('a category can be limited to the days it actually runs', () => {
  const csv = buildTemplateCsv({
    startDate: '2026-05-30',
    endDate: '2026-06-01',
    categories: [
      'Campcraft',
      { name: 'Campfire', days: ['Saturday'] },
      { name: 'Check In', days: ['Saturday'] },
    ],
  })
  const rows = dataRows(csv)
  assert.equal(rows.length, 5) // 3 + 1 + 1
  assert.deepEqual(
    rows.filter((r) => r[0] === 'Campfire').map((r) => r[1]),
    ['Saturday'],
  )
})

test('the instruction block is ignored when the file comes back', () => {
  const csv = buildTemplateCsv({
    startDate: '2026-05-30',
    endDate: '2026-05-30',
    categories: ['Campcraft'],
  })
  assert.ok(csv.startsWith('#'), 'export should open with instructions')
  // The example row inside the comments must not be read as real data.
  const rows = dataRows(csv)
  assert.equal(rows.length, 1)
  assert.equal(rows[0][5], '')
})

test('no categories is refused with a usable message', () => {
  assert.throws(
    () =>
      buildTemplateCsv({
        startDate: '2026-05-30',
        endDate: '2026-05-30',
        categories: [],
      }),
    /at least one category/,
  )
})

test('a filled-in template is read back with its marks', () => {
  const csv = [
    COLUMNS.join(','),
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Are all pegs and poles correct?,10',
    'Campcraft,Saturday,2026-05-30,Evening,General Site,Have segregated bins been provided?,10',
    'Logbook,Sunday,2026-05-31,,,Overall presentation,600',
  ].join('\n')

  const { criteria, errors } = parseTemplateCsv(csv)
  assert.deepEqual(errors, [])
  assert.equal(criteria.length, 3)
  assert.deepEqual(criteria[0], {
    category: 'Campcraft',
    day: 'Saturday',
    date: '2026-05-30',
    slot: 'Evening',
    group: 'Tentage',
    criterion: 'Are all pegs and poles correct?',
    maxMarks: 10,
    requiresReason: false,
  })
  assert.equal(criteria[2].slot, '')
})

test('unused skeleton rows are skipped without complaint', () => {
  const csv = [
    COLUMNS.join(','),
    'Campcraft,Saturday,2026-05-30,,,,',
    'Campcraft,Sunday,2026-05-31,Evening,Tentage,Are pegs correct?,10',
  ].join('\n')
  const { criteria, errors } = parseTemplateCsv(csv)
  assert.deepEqual(errors, [])
  assert.equal(criteria.length, 1)
})

test('bad marks are reported with the row number, not quietly dropped', () => {
  const csv = [
    COLUMNS.join(','),
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Half a mark,7.5',
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Nothing at stake,0',
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Not a number,ten',
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,No marks at all,',
    ',Saturday,2026-05-30,Evening,Tentage,No category,10',
  ].join('\n')

  const { criteria, errors } = parseTemplateCsv(csv)
  assert.equal(criteria.length, 0)
  assert.equal(errors.length, 5)
  assert.match(errors[0], /Row 2: Max Marks must be a whole number, got "7.5"/)
  assert.match(errors[1], /Row 3: Max Marks must be more than zero/)
  assert.match(errors[2], /Row 4: Max Marks must be a whole number, got "ten"/)
  assert.match(errors[3], /Row 5: no Max Marks/)
  assert.match(errors[4], /Row 6: no Category/)
})

test('the same criterion twice in one group is caught', () => {
  const csv = [
    COLUMNS.join(','),
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Are pegs correct?,10',
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,are pegs correct?,10',
  ].join('\n')
  const { criteria, errors } = parseTemplateCsv(csv)
  assert.equal(criteria.length, 1)
  assert.match(errors[0], /appears twice/)
})

test('the same wording in a different group is allowed', () => {
  // "Is non-perishable food organised?" genuinely appears in two groups of
  // the real Cooking and Eating sheet.
  const csv = [
    COLUMNS.join(','),
    'Cooking and Eating,Saturday,2026-05-30,Afternoon,Food Storage,Is non-perishable food organised?,15',
    'Cooking and Eating,Saturday,2026-05-30,Evening,Hygiene,Is non-perishable food organised?,15',
  ].join('\n')
  const { criteria, errors } = parseTemplateCsv(csv)
  assert.deepEqual(errors, [])
  assert.equal(criteria.length, 2)
})

test('a missing column is reported rather than guessed at', () => {
  const { criteria, errors } = parseTemplateCsv('Category,Day,Criterion\nCampcraft,Saturday,x')
  assert.equal(criteria.length, 0)
  assert.match(errors[0], /Missing columns: Date, Slot, Group, Max Marks/)
})

test('columns in a different order still work', () => {
  const csv = [
    'Max Marks,Criterion,Group,Slot,Date,Day,Category',
    '10,Are pegs correct?,Tentage,Evening,2026-05-30,Saturday,Campcraft',
  ].join('\n')
  const { criteria, errors } = parseTemplateCsv(csv)
  assert.deepEqual(errors, [])
  assert.equal(criteria[0].maxMarks, 10)
  assert.equal(criteria[0].category, 'Campcraft')
})

test('totals match the real Cooking and Eating Saturday Afternoon sheet', () => {
  // The actual 11 criteria and marks from the 2026 sheet, which totals 155.
  const rows = [
    ['Gas Cooker', 'Is the Gas Cooker fit for purpose?', 15],
    ['Gas Cooker', 'Are the patrol able to attach and detach the regulator?', 15],
    ['Gas Cooker', 'Have the hose and regulator been replaced in the last 2 years?', 15],
    ['Food Storage', 'Is there an adequate provision for cold food storage?', 15],
    ['Food Storage', 'Are uncooked meats stored seperately from cooked meets and dairy?', 15],
    ['Food Storage', 'Is all non-perishable food stored in a box?', 15],
    ['Food Storage', 'Is non-perishable food organised?', 15],
    ['Menu', 'Have the patrol prepared and planned a menu for the weekend?', 15],
    ['Menu', 'Is it a balanced menu?', 15],
    ['Menu', 'Has there been an effort made to connect the menu to the theme?', 10],
    ['Menu', 'Does the menu match the food in the boxes?', 10],
  ]
  const csv = [
    COLUMNS.join(','),
    ...rows.map(([group, criterion, marks]) =>
      toCsv([
        [
          'Cooking and Eating',
          'Saturday',
          '2026-05-30',
          'Afternoon',
          group,
          criterion,
          marks,
        ],
      ]),
    ),
  ].join('\r\n')

  const { criteria, errors } = parseTemplateCsv(csv)
  assert.deepEqual(errors, [])
  assert.equal(criteria.length, 11)

  const s = summarise(criteria)
  assert.equal(s.criteriaCount, 11)
  assert.equal(s.overallTotal, 155)
  assert.equal(s.categories[0].total, 155)
  assert.deepEqual(s.categories[0].slots, [
    { name: 'Saturday Afternoon', total: 155, count: 11 },
  ])
})

test('summarise splits totals by category and slot', () => {
  const criteria = [
    { category: 'Campcraft', day: 'Saturday', slot: 'Evening', group: 'a', criterion: 'x', maxMarks: 100 },
    { category: 'Campcraft', day: 'Sunday', slot: 'Morning', group: 'a', criterion: 'y', maxMarks: 50 },
    { category: 'Logbook', day: 'Sunday', slot: '', group: '', criterion: 'z', maxMarks: 600 },
  ]
  const s = summarise(criteria)
  assert.equal(s.overallTotal, 750)

  const campcraft = s.categories.find((c) => c.name === 'Campcraft')
  assert.equal(campcraft.total, 150)
  assert.equal(campcraft.slots.length, 2)

  const logbook = s.categories.find((c) => c.name === 'Logbook')
  assert.deepEqual(logbook.slots, [{ name: 'Sunday', total: 600, count: 1 }])
})

// --------------------------------------------- criteria that need a reason

test('Requires Reason is read, and defaults to no', () => {
  const csv = [
    COLUMNS.join(','),
    'Campcraft,Saturday,2026-05-30,Evening,Bonus Points,Bonus marks awarded,50,yes',
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Are pegs correct?,10,no',
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Are guys taut?,10,',
  ].join('\n')

  const { criteria, errors } = parseTemplateCsv(csv)
  assert.deepEqual(errors, [])
  assert.deepEqual(
    criteria.map((c) => c.requiresReason),
    [true, false, false],
  )
})

test('yes and no are accepted in the forms people actually type', () => {
  const rows = ['YES', 'Yes', 'y', 'true', '1']
  for (const yes of rows) {
    const csv = [
      COLUMNS.join(','),
      `Campcraft,Saturday,2026-05-30,Evening,Bonus,Bonus marks,50,${yes}`,
    ].join('\n')
    const { criteria, errors } = parseTemplateCsv(csv)
    assert.deepEqual(errors, [], `"${yes}" should be accepted`)
    assert.equal(criteria[0].requiresReason, true, `"${yes}" should mean yes`)
  }
})

test('something that is neither yes nor no is reported', () => {
  const csv = [
    COLUMNS.join(','),
    'Campcraft,Saturday,2026-05-30,Evening,Bonus,Bonus marks,50,maybe',
  ].join('\n')
  const { criteria, errors } = parseTemplateCsv(csv)
  assert.equal(criteria.length, 0)
  assert.match(errors[0], /Row 2: Requires Reason must be yes or no, got "maybe"/)
})

test('a file written before the column existed still imports', () => {
  const csv = [
    'Category,Day,Date,Slot,Group,Criterion,Max Marks',
    'Campcraft,Saturday,2026-05-30,Evening,Tentage,Are pegs correct?,10',
  ].join('\n')
  const { criteria, errors } = parseTemplateCsv(csv)
  assert.deepEqual(errors, [])
  assert.equal(criteria[0].requiresReason, false)
})

test('the export writes the Requires Reason column', () => {
  const csv = buildTemplateCsv({
    startDate: '2026-05-30',
    endDate: '2026-05-30',
    categories: ['Campcraft'],
  })
  const rows = fromCsv(csv)
  assert.deepEqual(rows[0], COLUMNS)
  assert.equal(rows[0].length, 8)
  assert.equal(rows[1].length, 8)
})
