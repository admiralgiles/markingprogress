#!/usr/bin/env node
/**
 * Generate a blank marking criteria CSV from the command line.
 *
 * The admin screen will do this with date pickers and tick boxes. This exists
 * so the output can be looked at before that screen is built.
 *
 * Usage:
 *   node scripts/export-template.mjs --start 2026-05-30 --end 2026-06-01 \
 *     --categories "Campcraft,Cooking and Eating,Logbook,Campfire" \
 *     --name "Liffey West County Shield" --out criteria.csv
 */

import { writeFileSync } from 'node:fs'
import { buildTemplateCsv } from '../src/lib/template.js'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    if (!key.startsWith('--')) {
      throw new Error(`Unexpected argument "${key}"`)
    }
    args[key.slice(2)] = argv[i + 1]
  }
  return args
}

const USAGE = `
Generate a blank marking criteria CSV.

  --start       first day of the competition, YYYY-MM-DD   (required)
  --end         last day of the competition, YYYY-MM-DD    (required)
  --categories  comma separated, e.g. "Campcraft,Logbook"  (required)
  --name        competition name, used in the header
  --out         file to write to, otherwise prints to screen
`

try {
  const args = parseArgs(process.argv.slice(2))

  if (args.help !== undefined || !args.start || !args.end || !args.categories) {
    console.log(USAGE.trim())
    process.exit(args.help !== undefined ? 0 : 1)
  }

  const csv = buildTemplateCsv({
    competitionName: args.name ?? 'Competition',
    startDate: args.start,
    endDate: args.end,
    categories: args.categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  })

  if (args.out) {
    writeFileSync(args.out, csv, 'utf8')
    console.log(`Written to ${args.out}`)
  } else {
    process.stdout.write(csv)
  }
} catch (err) {
  console.error(`\n${err.message}\n`)
  process.exit(1)
}
