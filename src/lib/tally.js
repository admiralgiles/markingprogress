/**
 * Turning a pile of individual marks into a results table.
 *
 * Kept out of the screens so it can be tested on its own.
 */

import { DEFAULT_STREAM, scoreCategory, scoreSlot } from './scoring.js'
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

/** The slot a criterion belongs to, as shown on screen. */
export const slotKeyOf = (c) =>
  [c.day, c.slot].filter(Boolean).join(' ') || 'All'

/** The distinct slots of a set of criteria, in the order they appear. */
function slotKeys(criteria) {
  const seen = []
  for (const c of criteria) {
    const key = slotKeyOf(c)
    if (!seen.includes(key)) seen.push(key)
  }
  return seen
}

/** The judges covering a category, and which marking group each is on. */
function judgesOn(competition, category, team) {
  const onCategory = (competition.judges ?? []).filter(
    (j) => !j.categories || j.categories.includes(category),
  )
  const allowed = competition.conflictRule
    ? eligibleJudges(onCategory, team)
    : onCategory

  const byStream = {}
  for (const j of allowed) {
    const stream = j.stream ?? DEFAULT_STREAM
    byStream[stream] ??= []
    byStream[stream].push(j.name)
  }

  return { allowed, byStream }
}

/**
 * Marks keyed by judge name rather than id, which is what the scoring
 * functions work in.
 */
function marksByJudgeName(judges, marksById) {
  const out = {}
  for (const j of judges) {
    if (marksById[j.id]) {
      out[j.name] = Object.fromEntries(
        Object.entries(marksById[j.id]).map(([id, e]) => [id, e.value]),
      )
    }
  }
  return out
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
    const marksById = byTeam[team.id] ?? {}
    const categories = []

    for (const category of competition.categories ?? []) {
      const rule = competition.combineRules?.[category] ?? 'average'
      const criteria = competition.criteria.filter((c) => c.category === category)
      const { allowed, byStream } = judgesOn(competition, category, team)
      const marksByJudge = marksByJudgeName(allowed, marksById)

      // Only pass the stream map when the criteria actually use streams,
      // so an ordinary competition keeps the simpler behaviour.
      const usesStreams = criteria.some((c) => (c.stream ?? '') !== '')

      const slotResults = []
      for (const key of slotKeys(criteria)) {
        const slotCriteria = criteria.filter((c) => slotKeyOf(c) === key)
        const result = scoreSlot({
          criteria: slotCriteria,
          marksByJudge,
          rule,
          expectedJudges: allowed.map((j) => j.name),
          judgesByStream: usesStreams ? byStream : undefined,
        })
        slotResults.push({ ...result, name: key })
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
 * which judge has not submitted what they were down for.
 *
 * Counted **within each judge's own marking group**. A judge who marks only
 * the yellow blocks of a split sheet has finished, and must not be shown as
 * having half-marked the sheet.
 */
export function completeness(competition, marks) {
  const byTeam = indexMarks(marks)
  const gaps = []

  for (const team of competition.teams ?? []) {
    for (const category of competition.categories ?? []) {
      const { allowed } = judgesOn(competition, category, team)
      const criteria = competition.criteria.filter((c) => c.category === category)
      const usesStreams = criteria.some((c) => (c.stream ?? '') !== '')

      for (const judge of allowed) {
        // Only the criteria this judge is actually down to mark.
        const theirCriteria = usesStreams
          ? criteria.filter(
              (c) => (c.stream ?? DEFAULT_STREAM) === (judge.stream ?? DEFAULT_STREAM),
            )
          : criteria
        if (theirCriteria.length === 0) continue

        const theirs = byTeam[team.id]?.[judge.id] ?? {}
        const marked = theirCriteria.filter(
          (c) => typeof theirs[c.id]?.value === 'number',
        ).length

        if (marked < theirCriteria.length) {
          gaps.push({
            team: team.name,
            category,
            judge: judge.name,
            stream: usesStreams ? (judge.stream ?? DEFAULT_STREAM) : null,
            marked,
            of: theirCriteria.length,
            state: marked === 0 ? 'not started' : 'part done',
          })
        }
      }
    }
  }

  return gaps
}
