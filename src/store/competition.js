/**
 * The competition itself: criteria, teams, judges and how it is scored.
 *
 * Pulled down onto the device when the judge enters the competition code,
 * because after that they may have no signal for an hour or two.
 */

import { STORES, get, put } from './db.js'
import { parseTemplateCsv } from '../lib/template.js'
import { COMBINE_RULES } from '../lib/scoring.js'

export const CURRENT_ID = 'current'

/** A stable id for a criterion, used as the key marks are stored against. */
export function criterionId(c) {
  return [c.category, c.day, c.slot, c.group, c.criterion]
    .join('|')
    .replace(/\s+/g, ' ')
}

/**
 * Build a competition from a criteria CSV plus the people involved.
 *
 * @param {object} args
 * @param {string} args.name
 * @param {string} args.code judges type this to get in
 * @param {string} args.criteriaCsv
 * @param {Array<{name: string, group?: string}>} args.teams
 * @param {Array<{name: string, group?: string, categories?: string[]}>} args.judges
 * @param {Object<string, string>} [args.combineRules] per category
 * @param {boolean} [args.conflictRule] stop a judge marking their own Group
 */
export function buildCompetition({
  name,
  code,
  criteriaCsv,
  teams = [],
  judges = [],
  combineRules = {},
  conflictRule = false,
}) {
  const { criteria, errors } = parseTemplateCsv(criteriaCsv)
  if (errors.length > 0) {
    return { competition: null, errors }
  }

  const withIds = criteria.map((c) => ({ ...c, id: criterionId(c) }))
  const categories = [...new Set(withIds.map((c) => c.category))]

  const rules = {}
  for (const cat of categories) {
    rules[cat] = combineRules[cat] ?? COMBINE_RULES.AVERAGE
  }

  return {
    competition: {
      id: CURRENT_ID,
      name: name?.trim() || 'Competition',
      code: (code ?? '').trim().toUpperCase(),
      criteria: withIds,
      categories,
      teams: teams.map((t, i) => ({ id: `t${i + 1}`, ...t })),
      judges: judges.map((j, i) => ({ id: `j${i + 1}`, ...j })),
      combineRules: rules,
      conflictRule,
      createdAt: new Date().toISOString(),
    },
    errors: [],
  }
}

export const saveCompetition = (competition) =>
  put(STORES.COMPETITION, competition)

export const loadCompetition = () => get(STORES.COMPETITION, CURRENT_ID)

/** Criteria grouped for the marking screen: category, then slot, then group. */
export function slotsFor(competition, category) {
  const slots = new Map()
  for (const c of competition.criteria) {
    if (c.category !== category) continue
    const key = [c.day, c.slot].filter(Boolean).join(' ') || 'All'
    if (!slots.has(key)) slots.set(key, { name: key, day: c.day, slot: c.slot, criteria: [] })
    slots.get(key).criteria.push(c)
  }
  return [...slots.values()]
}

/** Within a slot, the criteria under each heading, in the order given. */
export function groupsFor(criteria) {
  const groups = new Map()
  for (const c of criteria) {
    const key = c.group || ''
    if (!groups.has(key)) groups.set(key, { name: key, criteria: [] })
    groups.get(key).criteria.push(c)
  }
  return [...groups.values()]
}

export function maxMarksFor(criteria) {
  return criteria.reduce((t, c) => t + c.maxMarks, 0)
}
