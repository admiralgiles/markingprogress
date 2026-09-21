/**
 * Who is allowed to mark whom.
 *
 * Some competitions staff the judging from the competing Groups themselves,
 * one judge per Group, with every judge marking every team. A judge must
 * then not mark their own Group's team.
 *
 * In the Cub County Challenge this is done by hand: the tally sheet has an
 * `X` in the cell where a judge would have marked their own Group. It is
 * followed correctly there, but it depends on whoever built the sheet putting
 * the X in the right place eight times over.
 */

/**
 * A judge may not mark a team from their own Group.
 *
 * A marker can be one person or a pair running a station together and
 * submitting one agreed score. For a pair, either member's Group is enough
 * to rule them out: the conflict is with the people doing the judging, not
 * with whoever happens to type the marks in.
 */
export function hasConflict(judge, team) {
  const tg = team?.group
  if (!tg) return false

  for (const group of groupsOf(judge)) {
    if (normalise(group) === normalise(tg)) return true
  }
  return false
}

/** Every Group a marker brings with them, including a pair's members. */
export function groupsOf(judge) {
  const groups = []
  if (judge?.group) groups.push(judge.group)
  for (const m of judge?.members ?? []) {
    if (m?.group) groups.push(m.group)
  }
  return groups
}

/** True if this marker is a pair submitting one agreed score. */
export function isJointMarker(judge) {
  return Array.isArray(judge?.members) && judge.members.length > 1
}

function normalise(group) {
  return String(group).trim().toLowerCase()
}

/**
 * The judges who may mark a given team.
 *
 * @param {Array<{name: string, group?: string}>} judges
 * @param {{group?: string}} team
 */
export function eligibleJudges(judges, team) {
  return (judges ?? []).filter((j) => !hasConflict(j, team))
}

/**
 * The judges who must stand down for a team, and why.
 */
export function conflictedJudges(judges, team) {
  return (judges ?? []).filter((j) => hasConflict(j, team))
}

/**
 * Check submitted marks against who was allowed to submit them.
 *
 * Returns the names of anyone who marked a team they should not have, and
 * anyone eligible who has not marked yet.
 *
 * @param {Array<{name: string, group?: string}>} judges every judge on the section
 * @param {{group?: string}} team
 * @param {string[]} submittedBy names of judges who have submitted a mark
 */
export function checkEligibility(judges, team, submittedBy) {
  const eligible = eligibleJudges(judges, team).map((j) => j.name)
  const conflicted = conflictedJudges(judges, team).map((j) => j.name)
  const submitted = new Set(submittedBy ?? [])

  return {
    eligible,
    conflicted,
    // Someone marked their own Group's team. Should not be possible in the
    // app, but worth catching on an import from a spreadsheet.
    inBreach: conflicted.filter((name) => submitted.has(name)),
    awaiting: eligible.filter((name) => !submitted.has(name)),
  }
}

/**
 * Are these teams' scores comparable with each other?
 *
 * Only matters when marks are added together rather than averaged. If one
 * team's score is the sum of three judges and another's is the sum of two,
 * the second team is short by roughly a whole judge's marks and nothing on
 * screen would say so.
 *
 * With `average` this does not arise, which is why it goes unnoticed: the
 * same missing mark is nearly harmless under one rule and decisive under
 * the other.
 *
 * @param {Array<{team: string, submitted: number}>} teamResults
 * @param {string} rule
 */
export function checkComparability(teamResults, rule) {
  if (rule !== 'sum') {
    return { comparable: true, rule, counts: [], odd: [] }
  }

  const counts = [...new Set((teamResults ?? []).map((t) => t.submitted))]
  if (counts.length <= 1) {
    return { comparable: true, rule, counts, odd: [] }
  }

  // The commonest count is taken as what was intended.
  const tally = new Map()
  for (const t of teamResults) {
    tally.set(t.submitted, (tally.get(t.submitted) ?? 0) + 1)
  }
  const expected = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]

  return {
    comparable: false,
    rule,
    counts: counts.sort((a, b) => a - b),
    expected,
    odd: teamResults
      .filter((t) => t.submitted !== expected)
      .map((t) => ({ team: t.team, submitted: t.submitted, expected })),
  }
}
