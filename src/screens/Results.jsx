import { useMemo, useState } from 'react'

import { roundTo } from '../lib/scoring.js'
import { checkComparability } from '../lib/judges.js'
import { completeness, tally } from '../lib/tally.js'

export default function Results({ competition, marks, onLeave }) {
  const [expanded, setExpanded] = useState(null)

  const ranked = useMemo(() => tally(competition, marks), [competition, marks])
  const gaps = useMemo(
    () => completeness(competition, marks),
    [competition, marks],
  )

  // Only meaningful where a category sums its judges.
  const summedCategories = Object.entries(competition.combineRules ?? {})
    .filter(([, rule]) => rule === 'sum')
    .map(([cat]) => cat)

  const comparability = summedCategories
    .map((cat) => {
      const counts = ranked
        .filter((r) => r.total !== null)
        .map((r) => ({
          team: r.team,
          submitted: Math.max(
            0,
            ...r.categories
              .filter((c) => c.name === cat)
              .flatMap((c) => c.slots.map((s) => s.submitted)),
          ),
        }))
      return { category: cat, ...checkComparability(counts, 'sum') }
    })
    .filter((c) => !c.comparable)

  const anyMarks = ranked.some((r) => r.total !== null)

  return (
    <div className="screen">
      <div className="crumbs">
        <button type="button" className="link" onClick={onLeave}>
          ← Back
        </button>
        <span>Results</span>
      </div>

      <h2>{competition.name}</h2>

      {!anyMarks && (
        <p className="hint">
          Nothing marked yet. Go to Judge marking and put some marks in, then
          come back.
        </p>
      )}

      {comparability.length > 0 && (
        <div className="warning">
          <strong>These totals are not comparable with each other.</strong>
          {comparability.map((c) => (
            <p key={c.category}>
              {c.category} adds its judges together, but{' '}
              {c.odd.map((o) => `${o.team} was marked by ${o.submitted}`).join(', ')}{' '}
              where the rest were marked by {c.expected}. A team short of a
              judge loses roughly a whole judge's worth of marks.
            </p>
          ))}
        </div>
      )}

      {anyMarks && (
        <table className="leaderboard">
          <thead>
            <tr>
              <th>Place</th>
              <th>Team</th>
              <th>Group</th>
              <th>Total</th>
              <th>Behind</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr
                key={r.teamId}
                className={expanded === r.teamId ? 'open' : undefined}
                onClick={() =>
                  setExpanded(expanded === r.teamId ? null : r.teamId)
                }
              >
                <td>{r.placeLabel ?? '—'}</td>
                <td>{r.team}</td>
                <td>{r.group ?? ''}</td>
                <td>
                  {r.total === null ? '—' : roundTo(r.total)}
                  <span className="of"> / {r.maxMarks}</span>
                </td>
                <td>
                  {r.gapToAbove === null
                    ? (r.placeLabel ? 'Leader' : 'Not yet scored')
                    : roundTo(r.gapToAbove)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {expanded && (
        <section className="card">
          <h3>{ranked.find((r) => r.teamId === expanded)?.team}</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Combined by</th>
                <th>Score</th>
                <th>Out of</th>
              </tr>
            </thead>
            <tbody>
              {ranked
                .find((r) => r.teamId === expanded)
                ?.categories.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.rule}</td>
                    <td>{c.slotsScored === 0 ? '—' : roundTo(c.value)}</td>
                    <td>{c.maxMarks}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h3>Who still has marks outstanding</h3>
        {gaps.length === 0 ? (
          <p className="hint">
            Nothing outstanding. Every judge has marked every team they are
            down for.
          </p>
        ) : (
          <>
            <p className="hint">
              {gaps.length} still to come. This is the bit a spreadsheet cannot
              tell you.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Category</th>
                  <th>Judge</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {gaps.slice(0, 40).map((g, i) => (
                  <tr key={i}>
                    <td>{g.team}</td>
                    <td>{g.category}</td>
                    <td>{g.judge}</td>
                    <td>
                      <span className={g.state === 'not started' ? 'muted' : ''}>
                        {g.marked} of {g.of}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gaps.length > 40 && (
              <p className="hint">and {gaps.length - 40} more.</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
