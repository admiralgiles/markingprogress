/**
 * Teams rotating around activity stations.
 *
 * The Cub Challenge runs two Adventure Skills stations at once: half the
 * teams start at one, half at the other, then they swap. A judge at a
 * station should see only the teams actually coming to them, in order,
 * rather than picking from a list of every team in the competition.
 */

/**
 * Build a rotation from groups of teams and a list of stations.
 *
 * Group i starts at station i, then everyone moves on one station per
 * round, so every team visits every station exactly once.
 *
 * @param {string[]} stations
 * @param {string[][]} teamGroups one group of teams per station
 * @returns {Array<{round: number, assignments: Object<string, string[]>}>}
 */
export function buildRotation(stations, teamGroups) {
  if (!Array.isArray(stations) || stations.length === 0) {
    throw new Error('Give at least one station')
  }
  if (!Array.isArray(teamGroups) || teamGroups.length !== stations.length) {
    throw new Error(
      `Give one group of teams per station: ${stations.length} station(s), ` +
        `${teamGroups?.length ?? 0} group(s)`,
    )
  }

  const rounds = []
  for (let r = 0; r < stations.length; r++) {
    const assignments = {}
    stations.forEach((station, s) => {
      // In round r, the group that started at station (s - r) is here now.
      const from = (s - r + stations.length * 2) % stations.length
      assignments[station] = [...teamGroups[from]]
    })
    rounds.push({ round: r + 1, assignments })
  }
  return rounds
}

/** The teams due at a station in a given round. */
export function teamsFor(rounds, station, round) {
  const entry = (rounds ?? []).find((r) => r.round === round)
  if (!entry) return []
  return entry.assignments[station] ?? []
}

/** Where a team goes, in the order it goes there. */
export function scheduleFor(rounds, team) {
  const out = []
  for (const { round, assignments } of rounds ?? []) {
    for (const [station, teams] of Object.entries(assignments)) {
      if (teams.includes(team)) out.push({ round, station })
    }
  }
  return out.sort((a, b) => a.round - b.round)
}

/**
 * Is this rotation sound?
 *
 * Catches the ways a hand-built plan goes wrong: a team in two places at
 * once, a team doing the same station twice, or a team left off entirely.
 *
 * @param {Array<{round: number, assignments: Object<string, string[]>}>} rounds
 * @param {object} expected
 * @param {string[]} expected.teams
 * @param {string[]} expected.stations
 */
export function validateRotation(rounds, { teams, stations }) {
  const issues = []
  const seen = new Map() // team -> stations visited

  for (const team of teams) seen.set(team, [])

  for (const { round, assignments } of rounds ?? []) {
    const thisRound = new Map() // team -> stations this round

    for (const [station, stationTeams] of Object.entries(assignments)) {
      if (!stations.includes(station)) {
        issues.push(`Round ${round}: unknown station "${station}"`)
      }
      for (const team of stationTeams) {
        if (!teams.includes(team)) {
          issues.push(`Round ${round}: unknown team "${team}" at ${station}`)
          continue
        }
        thisRound.set(team, [...(thisRound.get(team) ?? []), station])
        seen.set(team, [...(seen.get(team) ?? []), station])
      }
    }

    for (const [team, where] of thisRound) {
      if (where.length > 1) {
        issues.push(
          `Round ${round}: ${team} is at ${where.length} stations at once (${where.join(', ')})`,
        )
      }
    }
  }

  for (const team of teams) {
    const visited = seen.get(team) ?? []
    const unique = new Set(visited)

    for (const station of unique) {
      const count = visited.filter((s) => s === station).length
      if (count > 1) {
        issues.push(`${team} does ${station} ${count} times`)
      }
    }

    const notVisited = stations.filter((s) => !unique.has(s))
    if (notVisited.length > 0) {
      issues.push(`${team} never does: ${notVisited.join(', ')}`)
    }
  }

  return { valid: issues.length === 0, issues }
}
