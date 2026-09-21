/**
 * Ranking teams, and the awards worked out from marks counted elsewhere.
 *
 * The results table in the existing spreadsheet is typed by hand, which is
 * how it ended up reading "1nd", "2rd", "3th". All of this is calculated.
 */

import { combine, judgeSlotTotal } from './scoring.js'

/**
 * Ordinal suffix for a place. 1st, 2nd, 3rd, 4th, and the awkward teens.
 */
export function ordinal(n) {
  if (!Number.isInteger(n) || n < 1) return String(n)
  const hundred = n % 100
  if (hundred >= 11 && hundred <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/**
 * Rank teams by total, highest first.
 *
 * Equal totals share a place and the next place skips, as a competition
 * normally works: two teams on 1st means the next team is 3rd.
 *
 * @param {Array<{team: string, total: number|null}>} teams
 * @returns {Array<{team, total, place, placeLabel, gapToAbove, gapToLeader, tied, behind}>}
 */
export function rank(teams) {
  const scored = (teams ?? []).filter((t) => typeof t.total === 'number')
  const unscored = (teams ?? []).filter((t) => typeof t.total !== 'number')

  const sorted = [...scored].sort((a, b) => b.total - a.total)

  const out = []
  let place = 0
  let lastTotal = null

  sorted.forEach((t, i) => {
    if (lastTotal === null || t.total !== lastTotal) {
      place = i + 1
      lastTotal = t.total
    }

    const above = i > 0 ? sorted[i - 1].total : null
    const tied = sorted.some((o, j) => j !== i && o.total === t.total)

    out.push({
      ...t,
      place,
      placeLabel: ordinal(place),
      gapToAbove: above === null ? null : above - t.total,
      gapToLeader: sorted.length > 0 ? sorted[0].total - t.total : null,
      tied,
      behind:
        i === 0
          ? 'Leader'
          : `${above - t.total} behind ${ordinal(out[i - 1].place)}`,
    })
  })

  // Teams with nothing scored yet go last rather than being ranked as zero.
  for (const t of unscored) {
    out.push({
      ...t,
      place: null,
      placeLabel: null,
      gapToAbove: null,
      gapToLeader: null,
      tied: false,
      behind: 'Not yet scored',
    })
  }

  return out
}

/**
 * An award built from criteria that already count somewhere else.
 *
 * The Environmental award pulls waste and bin criteria out of two different
 * categories. Its score must never be added to the overall total, or those
 * marks count twice.
 *
 * @param {object} args
 * @param {Array<{id: string, maxMarks: number}>} args.criteria all criteria
 * @param {string[]} args.criterionIds the ones feeding this award
 * @param {Object<string, Object<string, number>>} args.marksByJudge
 * @param {string} args.rule
 * @param {string[]} [args.expectedJudges]
 */
export function scoreDerivedAward({
  criteria,
  criterionIds,
  marksByJudge,
  rule,
  expectedJudges,
}) {
  const wanted = new Set(criterionIds)
  const picked = criteria.filter((c) => wanted.has(c.id))

  const unknown = criterionIds.filter(
    (id) => !criteria.some((c) => c.id === id),
  )
  if (unknown.length > 0) {
    throw new Error(
      `Award refers to criteria that do not exist: ${unknown.join(', ')}`,
    )
  }

  const perJudge = []
  for (const judge of Object.keys(marksByJudge ?? {})) {
    perJudge.push({ judge, ...judgeSlotTotal(picked, marksByJudge[judge]) })
  }

  const result = combine(
    perJudge.map((p) => ({ judge: p.judge, value: p.value })),
    rule,
    { expectedJudges: expectedJudges ?? Object.keys(marksByJudge ?? {}) },
  )

  return {
    ...result,
    perJudge,
    maxMarks: picked.reduce((t, c) => t + c.maxMarks, 0),
    criteriaCount: picked.length,
    countsTowardsTotal: false,
  }
}
