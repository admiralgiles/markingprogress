import { useEffect, useMemo, useRef, useState } from 'react'

import { validateMarkEntry } from '../lib/scoring.js'
import { conflictedJudges, eligibleJudges } from '../lib/judges.js'
import { groupsFor, maxMarksFor, slotsFor } from '../store/competition.js'
import { marksFor, saveMark } from '../store/queue.js'

/** Steps a judge walks through after typing the code. */
const STEP = {
  CATEGORY: 'category',
  NAME: 'name',
  SLOT: 'slot',
  TEAM: 'team',
  MARKING: 'marking',
}

export default function Judge({ competition, onLeave, onMarksChanged }) {
  const [step, setStep] = useState(STEP.CATEGORY)
  const [category, setCategory] = useState(null)
  const [judge, setJudge] = useState(null)
  const [slot, setSlot] = useState(null)
  const [team, setTeam] = useState(null)

  const slots = useMemo(
    () => (category ? slotsFor(competition, category) : []),
    [competition, category],
  )

  const back = () => {
    if (step === STEP.MARKING) return setStep(STEP.TEAM)
    if (step === STEP.TEAM) return setStep(STEP.SLOT)
    if (step === STEP.SLOT) return setStep(STEP.NAME)
    if (step === STEP.NAME) return setStep(STEP.CATEGORY)
    onLeave()
  }

  const judgesOnCategory = (competition.judges ?? []).filter(
    (j) => !j.categories || j.categories.includes(category),
  )

  const teamsForJudge = competition.conflictRule
    ? eligibleJudges([judge].filter(Boolean), {}).length === 0
      ? []
      : (competition.teams ?? []).filter(
          (t) => conflictedJudges([judge], t).length === 0,
        )
    : (competition.teams ?? [])

  const blockedTeams = competition.conflictRule && judge
    ? (competition.teams ?? []).filter(
        (t) => conflictedJudges([judge], t).length > 0,
      )
    : []

  return (
    <div className="screen">
      <div className="crumbs">
        <button type="button" className="link" onClick={back}>
          ← Back
        </button>
        {category && <span>{category}</span>}
        {judge && <span>{judge.name}</span>}
        {slot && <span>{slot.name}</span>}
        {team && <span>{team.name}</span>}
      </div>

      {step === STEP.CATEGORY && (
        <Pick
          title="What are you marking?"
          options={competition.categories}
          render={(c) => c}
          onPick={(c) => {
            setCategory(c)
            setStep(STEP.NAME)
          }}
        />
      )}

      {step === STEP.NAME && (
        <Pick
          title="Which one are you?"
          hint="Whoever is holding this iPad."
          options={judgesOnCategory}
          render={(j) => (j.group ? `${j.name} (${j.group})` : j.name)}
          onPick={(j) => {
            setJudge(j)
            setStep(STEP.SLOT)
          }}
        />
      )}

      {step === STEP.SLOT && (
        <Pick
          title="When is this?"
          options={slots}
          render={(s) => `${s.name} — ${maxMarksFor(s.criteria)} marks`}
          onPick={(s) => {
            setSlot(s)
            setStep(STEP.TEAM)
          }}
        />
      )}

      {step === STEP.TEAM && (
        <>
          <Pick
            title="Which team?"
            options={teamsForJudge}
            render={(t) => (t.group ? `${t.name} (${t.group})` : t.name)}
            onPick={(t) => {
              setTeam(t)
              setStep(STEP.MARKING)
            }}
          />
          {blockedTeams.length > 0 && (
            <p className="hint">
              Not shown, because they are from your own Group:{' '}
              {blockedTeams.map((t) => t.name).join(', ')}
            </p>
          )}
        </>
      )}

      {step === STEP.MARKING && (
        <MarkingSheet
          competition={competition}
          judge={judge}
          team={team}
          slot={slot}
          onDone={() => setStep(STEP.TEAM)}
          onMarksChanged={onMarksChanged}
        />
      )}
    </div>
  )
}

function Pick({ title, hint, options, render, onPick }) {
  return (
    <>
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {options.length === 0 ? (
        <p className="hint">Nothing to choose from. Check the setup.</p>
      ) : (
        <div className="picker">
          {options.map((o, i) => (
            <button type="button" key={i} onClick={() => onPick(o)}>
              {render(o)}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function MarkingSheet({ competition, judge, team, slot, onDone, onMarksChanged }) {
  const [entries, setEntries] = useState({})
  const [loaded, setLoaded] = useState(false)
  const timers = useRef({})

  const ids = useMemo(() => slot.criteria.map((c) => c.id), [slot])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    marksFor(
      { competitionId: competition.id, judgeId: judge.id, teamId: team.id },
      ids,
    ).then((existing) => {
      if (cancelled) return
      setEntries(existing)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [competition.id, judge.id, team.id, ids])

  // Written to the device a moment after typing stops, so holding down a key
  // does not queue a dozen versions of the same mark.
  const persist = (criterionId, entry) => {
    clearTimeout(timers.current[criterionId])
    timers.current[criterionId] = setTimeout(() => {
      saveMark({
        competitionId: competition.id,
        judgeId: judge.id,
        teamId: team.id,
        criterionId,
        value: entry.value,
        reason: entry.reason,
      }).then(() => onMarksChanged?.())
    }, 400)
  }

  const update = (criterion, patch) => {
    const next = { ...(entries[criterion.id] ?? {}), ...patch }
    setEntries((prev) => ({ ...prev, [criterion.id]: next }))
    if (typeof next.value === 'number') persist(criterion.id, next)
  }

  const groups = groupsFor(slot.criteria)
  const max = maxMarksFor(slot.criteria)
  const awarded = slot.criteria.reduce((t, c) => {
    const v = entries[c.id]?.value
    return t + (typeof v === 'number' ? v : 0)
  }, 0)
  const marked = slot.criteria.filter(
    (c) => typeof entries[c.id]?.value === 'number',
  ).length

  const problems = slot.criteria.flatMap(
    (c) => validateMarkEntry(c, entries[c.id] ?? {}).errors,
  )

  if (!loaded) return <p className="hint">Loading marks already given…</p>

  return (
    <>
      <h2>{team.name}</h2>
      <p className="hint">
        {slot.name} · marked by {judge.name}
      </p>

      <div className="running">
        <strong>
          {awarded} / {max}
        </strong>
        <span>
          {marked} of {slot.criteria.length} criteria marked
        </span>
      </div>

      {problems.length > 0 && (
        <div className="error-list">
          {problems.map((p) => (
            <div key={p}>{p}</div>
          ))}
        </div>
      )}

      {groups.map((group) => (
        <section className="card" key={group.name || 'ungrouped'}>
          {group.name && <h3>{group.name}</h3>}
          {group.criteria.map((c) => {
            const entry = entries[c.id] ?? {}
            const bad = validateMarkEntry(c, entry).errors.length > 0
            return (
              <div className="criterion" key={c.id}>
                <label>
                  <span className="criterion-text">{c.criterion}</span>
                  <span className="criterion-input">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={c.maxMarks}
                      className={bad ? 'bad' : undefined}
                      value={entry.value ?? ''}
                      onChange={(e) =>
                        update(c, {
                          value:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                    <span className="of">/ {c.maxMarks}</span>
                  </span>
                </label>
                {c.requiresReason && (
                  <input
                    className="reason"
                    placeholder="Why these marks? (required)"
                    value={entry.reason ?? ''}
                    onChange={(e) => update(c, { reason: e.target.value })}
                  />
                )}
              </div>
            )
          })}
        </section>
      ))}

      <div className="row">
        <button type="button" className="primary" onClick={onDone}>
          Done, next team
        </button>
      </div>
      <p className="hint">
        Marks are saved on this device as you type. They send themselves when a
        signal comes back.
      </p>
    </>
  )
}
