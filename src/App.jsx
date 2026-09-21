import { useCallback, useEffect, useState } from 'react'

import SyncBadge from './components/SyncBadge.jsx'
import Judge from './screens/Judge.jsx'
import Results from './screens/Results.jsx'
import Setup from './screens/Setup.jsx'
import { COMBINE_RULES } from './lib/scoring.js'
import { STORES, getAll, resetEverything } from './store/db.js'
import { buildCompetition, loadCompetition, saveCompetition } from './store/competition.js'
import { SYNC_STATE, startAutoSync } from './store/queue.js'
import { send, stubTransport } from './transport.js'

import exampleCriteria from '../sample-data/example-criteria.csv?raw'
import splitCriteria from '../sample-data/example-split-criteria.csv?raw'

const VIEW = { HOME: 'home', SETUP: 'setup', JUDGE: 'judge', RESULTS: 'results' }

/** Enough of a competition to click through without filling anything in. */
function exampleCompetition() {
  return buildCompetition({
    name: 'Example Shield 2026',
    code: 'DEMO26',
    criteriaCsv: exampleCriteria,
    teams: [
      { name: 'Kestrel', group: 'Group A' },
      { name: 'Falcon', group: 'Group A' },
      { name: 'Osprey', group: 'Group B' },
      { name: 'Merlin', group: 'Group C' },
      { name: 'Harrier', group: 'Group D' },
    ],
    judges: [
      { name: 'Judge One', group: 'Group A' },
      { name: 'Judge Two', group: 'Group B' },
      { name: 'Judge Three', group: 'Group C' },
    ],
    combineRules: { Campcraft: COMBINE_RULES.AVERAGE },
    conflictRule: true,
  })
}

/**
 * A sheet split by colour, as Phoenix Campcraft is marked: two judges on the
 * Yellow blocks, two on the Green, averaged within each colour and added
 * across them.
 */
function splitCompetition() {
  return buildCompetition({
    name: 'Example Split Sheet 2026',
    code: 'SPLIT26',
    criteriaCsv: splitCriteria,
    teams: [
      { name: 'Site 1' },
      { name: 'Site 2' },
      { name: 'Site 3' },
    ],
    judges: [
      { name: 'Yellow One', stream: 'Yellow' },
      { name: 'Yellow Two', stream: 'Yellow' },
      { name: 'Green One', stream: 'Green' },
      { name: 'Green Two', stream: 'Green' },
    ],
    combineRules: { Campcraft: COMBINE_RULES.AVERAGE },
    conflictRule: false,
  })
}

export default function App() {
  const [view, setView] = useState(VIEW.HOME)
  const [competition, setCompetition] = useState(null)
  const [ready, setReady] = useState(false)
  const [marks, setMarks] = useState([])
  const [sync, setSync] = useState({ state: SYNC_STATE.IDLE, pending: 0 })
  const [offline, setOffline] = useState(false)
  const [codeEntry, setCodeEntry] = useState('')
  const [codeError, setCodeError] = useState(null)

  const refreshMarks = useCallback(() => {
    getAll(STORES.MARKS).then(setMarks)
  }, [])

  useEffect(() => {
    loadCompetition()
      .then((c) => {
        setCompetition(c ?? null)
        setReady(true)
      })
      .catch(() => setReady(true))
    refreshMarks()
  }, [refreshMarks])

  useEffect(() => {
    const stop = startAutoSync(send, {
      onState: (s) => {
        setSync(s)
        refreshMarks()
      },
      intervalMs: 4000,
    })
    return stop
  }, [refreshMarks])

  const load = async (build) => {
    const { competition: c, errors } = build()
    if (errors.length > 0) {
      setCodeError(errors.join('; '))
      return
    }
    await saveCompetition(c)
    setCompetition(c)
  }

  const reset = async () => {
    await resetEverything()
    setCompetition(null)
    setMarks([])
    setView(VIEW.HOME)
  }

  const enterAsJudge = () => {
    setCodeError(null)
    if (codeEntry.trim().toUpperCase() !== competition.code) {
      setCodeError('That code does not match this competition.')
      return
    }
    setView(VIEW.JUDGE)
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <strong>MarkingProgress</strong>
          {competition && <span className="sub">{competition.name}</span>}
        </div>
        <div className="header-right">
          <SyncBadge {...sync} />
          <label className="toggle" title="Pretend the signal has gone">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => {
                setOffline(e.target.checked)
                stubTransport.failing = e.target.checked
              }}
            />
            No signal
          </label>
        </div>
      </header>

      <main>
        {!ready && <p className="hint">Opening storage on this device…</p>}

        {ready && view === VIEW.SETUP && (
          <Setup
            onSaved={(c) => {
              setCompetition(c)
              setView(VIEW.HOME)
            }}
            onCancel={() => setView(VIEW.HOME)}
          />
        )}

        {ready && view === VIEW.JUDGE && competition && (
          <Judge
            competition={competition}
            onLeave={() => setView(VIEW.HOME)}
            onMarksChanged={refreshMarks}
          />
        )}

        {ready && view === VIEW.RESULTS && competition && (
          <Results
            competition={competition}
            marks={marks}
            onLeave={() => setView(VIEW.HOME)}
          />
        )}

        {ready && view === VIEW.HOME && (
          <div className="screen">
            {!competition ? (
              <>
                <h2>No competition on this device yet</h2>
                <p className="hint">
                  Set one up, or load the example to see how it works.
                </p>
                <div className="row">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setView(VIEW.SETUP)}
                  >
                    Set up a competition
                  </button>
                  <button type="button" onClick={() => load(exampleCompetition)}>
                    Load the example
                  </button>
                  <button type="button" onClick={() => load(splitCompetition)}>
                    Load the split-sheet example
                  </button>
                </div>
                {codeError && <p className="error">{codeError}</p>}
              </>
            ) : (
              <>
                <h2>{competition.name}</h2>
                <p className="hint">
                  {competition.criteria.length} criteria ·{' '}
                  {competition.teams.length} teams · {competition.judges.length}{' '}
                  judges
                  {competition.conflictRule &&
                    ' · a judge may not mark their own Group'}
                  {competition.streams?.length > 1 &&
                    ` · split between ${competition.streams.join(' and ')}`}
                </p>

                <section className="card">
                  <h3>Judging</h3>
                  <p className="hint">
                    Enter the competition code. For the example it is{' '}
                    <code>{competition.code}</code>.
                  </p>
                  <div className="row">
                    <input
                      value={codeEntry}
                      placeholder="Competition code"
                      onChange={(e) =>
                        setCodeEntry(e.target.value.toUpperCase())
                      }
                    />
                    <button type="button" className="primary" onClick={enterAsJudge}>
                      Start marking
                    </button>
                  </div>
                  {codeError && <p className="error">{codeError}</p>}
                </section>

                <section className="card">
                  <h3>Organiser</h3>
                  <div className="row">
                    <button type="button" onClick={() => setView(VIEW.RESULTS)}>
                      Results and progress
                    </button>
                    <button type="button" onClick={() => setView(VIEW.SETUP)}>
                      Set up a different competition
                    </button>
                    <button type="button" className="danger" onClick={reset}>
                      Clear this device
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      <footer>
        <span>
          {marks.length} mark{marks.length === 1 ? '' : 's'} on this device
        </span>
        <span className="muted">
          No database connected yet, so sending is simulated.
        </span>
      </footer>
    </div>
  )
}
