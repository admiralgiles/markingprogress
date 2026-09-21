/**
 * Turning a pile of individual marks into a results table.
 *
 * Kept out of the screens so it can be tested on its own.
 */

import { combine, scoreCategory } from './scoring.js'
import { eligibleJudges } from './judges.js'
import { rank } from './results.js'

/** Group marks into marks[teamId][judgeId][criterionId] = {value, reason}. */
export function indexMarks(marks) {
  const byTeam = {}
  for (const m of marks ?? []) {
    byTeam[m.teamId] ??= {}
    byTeam[m.teamId][m.judgeId] ??= {}
    byTeam[m.teamId][m.judgeId][m.criterionId] = {
      value: m.value,
      reason: m.reason,
    }
  }
  return byTeam
}

/** The distinct slots of a category, in the order the criteria give them. */
function slotKeys(criteria) {
  const seen = []
  for (const c of criteria) {
    const key = [c.day, c.slot].filter(Boolean).join(' ') || 'All'
    if (!seen.includes(key)) seen.push(key)
  }
  return seen
}

/**
 * Score every team in a competition.
 *
 * @param {object} competition
 * @param {Array<object>} marks flat list as stored on the device
 */
export function tally(competition, marks) {
  const byTeam = indexMarks(marks)
  const rows = []

  for (const team of competition.teams ?? []) {
    const judgeMarks = byTeam[team.id] ?? {}
    const categories = []

    for (const category of competition.categories ?? []) {
      const rule = competition.combineRules?.[category] ?? 'average'
      const criteria = competition.criteria.filter((c) => c.category === category)

      // Who was supposed to mark this category for this team.
      const onCategory = (competition.judges ?? []).filter(
        (j) => !j.categories || j.categories.includes(category),
      )
      const expected = competition.conflictRule
        ? eligibleJudges(onCategory, team).map((j) => j.name)
        : onCategory.map((j) => j.name)

      const slotResults = []
      for (const key of slotKeys(criteria)) {
        const slotCriteria = criteria.filter(
          (c) => ([c.day, c.slot].filter(Boolean).join(' ') || 'All') === key,
        )
        const ids = slotCriteria.map((c) => c.id)
        const maxMarks = slotCriteria.reduce((t, c) => t + c.maxMarks, 0)

        const perJudge = []
        for (const judge of onCategory) {
          const theirs = judgeMarks[judge.id]
          if (!theirs) continue
          const values = ids
            .map((id) => theirs[id]?.value)
            .filter((v) => typeof v === 'number' && Number.isFinite(v))
          if (values.length === 0) continue
          perJudge.push({
            judge: judge.name,
            value: values.reduce((t, v) => t + v, 0),
            marked: values.length,
            of: ids.length,
          })
        }

        const result = combine(perJudge, rule, { expectedJudges: expected })
        slotResults.push({ ...result, name: key, maxMarks, perJudge })
      }

      const cat = scoreCategory(slotResults)
      categories.push({ name: category, rule, ...cat, slots: slotResults })
    }

    const scored = categories.filter((c) => c.slotsScored > 0)

    rows.push({
      team: team.name,
      teamId: team.id,
      group: team.group,
      categories,
      total: scored.length > 0 ? scored.reduce((t, c) => t + c.value, 0) : null,
      maxMarks: categories.reduce((t, c) => t + c.maxMarks, 0),
      flags: [...new Set(categories.flatMap((c) => c.flags))],
    })
  }

  return rank(rows)
}

/**
 * Who still has marks outstanding.
 *
 * The thing the spreadsheet cannot tell you: for every team and category,
 * which eligible judge has not submitted anything yet.
 */
export function completeness(competition, marks) {
  const byTeam = indexMarks(marks)
  const gaps = []

  for (const team of competition.teams ?? []) {
    for (const category of competition.categories ?? []) {
      const onCategory = (competition.judges ?? []).filter(
        (j) => !j.categories || j.categories.includes(category),
      )
      const expected = competition.conflictRule
        ? eligibleJudges(onCategory, team)
        : onCategory

      const ids = competition.criteria
        .filter((c) => c.category === category)
        .map((c) => c.id)

      for (const judge of expected) {
        const theirs = byTeam[team.id]?.[judge.id] ?? {}
        const marked = ids.filter(
          (id) => typeof theirs[id]?.value === 'number',
        ).length

        if (marked < ids.length) {
          gaps.push({
            team: team.name,
            category,
            judge: judge.name,
            marked,
            of: ids.length,
            state: marked === 0 ? 'not started' : 'part done',
          })
        }
      }
    }
  }

  return gaps
}
