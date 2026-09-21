import { useState } from 'react'

import { buildTemplateCsv, parseTemplateCsv, summarise } from '../lib/template.js'
import { COMBINE_RULES, COMBINE_RULE_LABELS } from '../lib/scoring.js'
import { buildCompetition, saveCompetition } from '../store/competition.js'

/**
 * Categories seen across the Shield, the Cub County Challenge and Phoenix.
 * Tick what you are running and add anything missing.
 */
const KNOWN_CATEGORIES = [
  { name: 'Check In', on: true },
  { name: 'Campcraft', on: true },
  { name: 'Cooking and Eating', on: true },
  { name: 'Programme', on: true },
  { name: 'Logbook', on: true },
  { name: 'Campfire', on: true },
  { name: 'Bases', on: false },
  { name: 'Adventure Skills', on: false },
  { name: 'Waste Management', on: false },
  { name: 'Leave No Trace', on: false },
  { name: 'Test Meal', on: false },
]

let nextRowId = 1
const blankRow = () => ({ id: `r${nextRowId++}`, name: '', group: '', stream: '' })
const rowsFrom = (people) =>
  people.map((p) => ({ id: `r${nextRowId++}`, stream: '', ...p }))

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Setup({ onSaved, onCancel }) {
  const [name, setName] = useState('County Shield 2026')
  const [code, setCode] = useState('ESKER26')
  const [startDate, setStartDate] = useState('2026-05-30')
  const [endDate, setEndDate] = useState('2026-06-01')

  const [categories, setCategories] = useState(() =>
    KNOWN_CATEGORIES.map((c) => ({ ...c, custom: false })),
  )
  const [newCategory, setNewCategory] = useState('')
  const [categoryError, setCategoryError] = useState(null)

  const [criteriaCsv, setCriteriaCsv] = useState('')
  const [teams, setTeams] = useState(() =>
    rowsFrom([
      { name: 'Kestrel', group: 'Group A' },
      { name: 'Falcon', group: 'Group A' },
      { name: 'Osprey', group: 'Group B' },
    ]),
  )
  const [judges, setJudges] = useState(() =>
    rowsFrom([
      { name: '', group: '' },
      { name: '', group: '' },
      { name: '', group: '' },
    ]),
  )

  const [conflictRule, setConflictRule] = useState(false)
  const [rules, setRules] = useState({})
  const [problems, setProblems] = useState([])
  const [summary, setSummary] = useState(null)
  const [exportError, setExportError] = useState(null)

  const chosen = categories.filter((c) => c.on).map((c) => c.name)
  const uploadedCategories = summary?.categories.map((c) => c.name) ?? []
  const anyStream = judges.some((j) => j.stream.trim())

  const toggleCategory = (target) =>
    setCategories((cs) =>
      cs.map((c) => (c.name === target ? { ...c, on: !c.on } : c)),
    )

  const addCategory = () => {
    const wanted = newCategory.trim()
    setCategoryError(null)
    if (!wanted) return
    if (categories.some((c) => c.name.toLowerCase() === wanted.toLowerCase())) {
      setCategoryError(`"${wanted}" is already in the list.`)
      return
    }
    setCategories((cs) => [...cs, { name: wanted, on: true, custom: true }])
    setNewCategory('')
  }

  const removeCategory = (target) =>
    setCategories((cs) => cs.filter((c) => c.name !== target))

  const handleExport = () => {
    setExportError(null)
    try {
      const csv = buildTemplateCsv({ startDate, endDate, categories: chosen })
      download(
        `${(name || 'competition').replace(/\W+/g, '-').toLowerCase()}-criteria.csv`,
        csv,
      )
    } catch (err) {
      setExportError(err.message)
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const { criteria, errors } = parseTemplateCsv(text)
    setProblems(errors)
    if (errors.length === 0) {
      setCriteriaCsv(text)
      setSummary(summarise(criteria))
    } else {
      setCriteriaCsv('')
      setSummary(null)
    }
  }

  const usedRows = (rows) =>
    rows
      .filter((r) => r.name.trim())
      .map((r) => {
        const person = { name: r.name.trim() }
        if (r.group.trim()) person.group = r.group.trim()
        if (r.stream.trim()) person.stream = r.stream.trim()
        return person
      })

  const handleSave = async () => {
    const { competition, errors } = buildCompetition({
      name,
      code,
      criteriaCsv,
      teams: usedRows(teams),
      judges: usedRows(judges),
      combineRules: rules,
      conflictRule,
    })
    if (errors.length > 0) {
      setProblems(errors)
      return
    }
    await saveCompetition(competition)
    onSaved(competition)
  }

  return (
    <div className="screen">
      <h2>Set up a competition</h2>

      <section className="card">
        <h3>1. The basics</h3>
        <div className="grid">
          <label>
            Competition name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Code judges type in
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            First day
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            Last day
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>2. What is being marked</h3>
        <p className="hint">
          Tick the categories this competition has. Add anything that is not
          listed.
        </p>

        <div className="checks">
          {categories.map((c) => (
            <label className="check chip" key={c.name}>
              <input
                type="checkbox"
                checked={c.on}
                onChange={() => toggleCategory(c.name)}
              />
              {c.name}
              {c.custom && (
                <button
                  type="button"
                  className="remove"
                  title={`Remove ${c.name}`}
                  onClick={(e) => {
                    e.preventDefault()
                    removeCategory(c.name)
                  }}
                >
                  ×
                </button>
              )}
            </label>
          ))}
        </div>

        <div className="row">
          <input
            value={newCategory}
            placeholder="Add your own, e.g. Pioneering"
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCategory()
              }
            }}
          />
          <button type="button" onClick={addCategory}>
            Add category
          </button>
        </div>
        {categoryError && <p className="error">{categoryError}</p>}
        {chosen.length === 0 && (
          <p className="error">Tick at least one category.</p>
        )}
      </section>

      <section className="card">
        <h3>3. The marking criteria</h3>
        <p className="hint">
          The download is a plain spreadsheet: a heading row, then one row for
          each category on each day of your competition. Fill in your criteria
          and upload it back.
        </p>

        <table className="guide">
          <thead>
            <tr>
              <th>Column</th>
              <th>What goes in it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Category, Day, Date</td>
              <td>Already filled in. Delete any row you are not using.</td>
            </tr>
            <tr>
              <td>Slot</td>
              <td>
                When in the day, e.g. Morning, Evening, Final Inspection. Blank
                if it is marked once only, like Logbook.
              </td>
            </tr>
            <tr>
              <td>Group</td>
              <td>The heading it sits under, e.g. Tentage, Altar Fire.</td>
            </tr>
            <tr>
              <td>Criterion</td>
              <td>The question the judge answers.</td>
            </tr>
            <tr>
              <td>Max Marks</td>
              <td>A whole number above zero.</td>
            </tr>
            <tr>
              <td>Requires Reason</td>
              <td>
                <code>yes</code> where the judge must say why, such as bonus
                marks. Blank means no.
              </td>
            </tr>
            <tr>
              <td>Marking Group</td>
              <td>
                Only for a sheet split between different judges, e.g.{' '}
                <code>Yellow</code> and <code>Green</code>. Blank if everyone
                marks everything.
              </td>
            </tr>
          </tbody>
        </table>

        <p className="hint">
          Copy a row and change it rather than starting each one from scratch.
          One row per thing a judge marks, so a 40 item inspection is 40 rows.
        </p>

        <div className="row">
          <button
            type="button"
            onClick={handleExport}
            disabled={chosen.length === 0}
          >
            Download blank criteria file
          </button>
          <label className="file">
            Upload filled-in file
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
          </label>
        </div>
        {exportError && <p className="error">{exportError}</p>}

        {problems.length > 0 && (
          <div className="error-list">
            <strong>
              {problems.length} problem{problems.length === 1 ? '' : 's'} in that
              file:
            </strong>
            <ul>
              {problems.slice(0, 12).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {problems.length > 12 && <p>and {problems.length - 12} more.</p>}
          </div>
        )}

        {summary && (
          <div className="summary">
            <p>
              <strong>{summary.criteriaCount} criteria</strong> loaded, worth{' '}
              <strong>{summary.overallTotal}</strong> in total. Check these
              against what you expect before anyone starts marking.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Criteria</th>
                  <th>Marks</th>
                  <th>Slots</th>
                </tr>
              </thead>
              <tbody>
                {summary.categories.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.count}</td>
                    <td>{c.total}</td>
                    <td>{c.slots.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>4. Teams</h3>
        <p className="hint">
          The Group is the Scout Group or unit they come from. Two teams can
          share a Group.
        </p>
        <PeopleRows
          rows={teams}
          setRows={setTeams}
          nameLabel="Team name"
          namePlaceholder="Kestrel"
          groupPlaceholder="142nd Dublin"
          addLabel="Add team"
        />
      </section>

      <section className="card">
        <h3>5. Judges</h3>
        <p className="hint">
          Leave Marking Group blank unless a sheet is split between different
          judges, then put the colour or label they cover.
        </p>
        <PeopleRows
          rows={judges}
          setRows={setJudges}
          nameLabel="Judge name"
          namePlaceholder="Aoife Byrne"
          groupPlaceholder="142nd Dublin"
          addLabel="Add judge"
          withStream
        />
        <label className="check">
          <input
            type="checkbox"
            checked={conflictRule}
            onChange={(e) => setConflictRule(e.target.checked)}
          />
          A judge may not mark a team from their own Group
        </label>
        {conflictRule && anyStream && (
          <p className="hint">
            Both rules apply together: a judge sees only their own Marking
            Group, and never their own Group&apos;s teams.
          </p>
        )}
      </section>

      {uploadedCategories.length > 0 && (
        <section className="card">
          <h3>6. How several judges&apos; marks are combined</h3>
          <p className="hint">Set per category. It varies between competitions.</p>
          {uploadedCategories.map((cat) => (
            <label key={cat}>
              {cat}
              <select
                value={rules[cat] ?? COMBINE_RULES.AVERAGE}
                onChange={(e) => setRules({ ...rules, [cat]: e.target.value })}
              >
                {Object.values(COMBINE_RULES).map((r) => (
                  <option key={r} value={r}>
                    {COMBINE_RULE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}

      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={!criteriaCsv}
          onClick={handleSave}
        >
          Save competition
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {!criteriaCsv && (
        <p className="hint">
          Upload a criteria file before saving. Without it there is nothing to
          mark.
        </p>
      )}
    </div>
  )
}

/**
 * One box per field rather than a comma-separated list, so a stray comma or a
 * missing space cannot quietly create a team called "Kestrel Group A".
 */
function PeopleRows({
  rows,
  setRows,
  nameLabel,
  namePlaceholder,
  groupPlaceholder,
  addLabel,
  withStream = false,
}) {
  const update = (id, field, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const remove = (id) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs))

  const add = () => setRows((rs) => [...rs, blankRow()])

  // Flagged rather than blocked: a repeat is usually a slip, but two patrols
  // really can be called the same thing in different Groups.
  //
  // Compared case-insensitively but reported back in the casing that was
  // typed, so the message names what is actually on screen.
  const duplicates = new Map()
  const seen = new Set()
  for (const r of rows) {
    const name = r.name.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) duplicates.set(key, name)
    seen.add(key)
  }

  return (
    <>
      <div className={`people-head ${withStream ? 'with-stream' : ''}`}>
        <span>{nameLabel}</span>
        <span>Group</span>
        {withStream && <span>Marking Group</span>}
        <span />
      </div>

      {rows.map((r) => (
        <div
          className={`people-row ${withStream ? 'with-stream' : ''}`}
          key={r.id}
        >
          <input
            value={r.name}
            placeholder={namePlaceholder}
            className={
              duplicates.has(r.name.trim().toLowerCase()) ? 'warn' : undefined
            }
            onChange={(e) => update(r.id, 'name', e.target.value)}
          />
          <input
            value={r.group}
            placeholder={groupPlaceholder}
            onChange={(e) => update(r.id, 'group', e.target.value)}
          />
          {withStream && (
            <input
              value={r.stream}
              placeholder="Yellow"
              onChange={(e) => update(r.id, 'stream', e.target.value)}
            />
          )}
          <button
            type="button"
            className="remove"
            title="Remove this row"
            onClick={() => remove(r.id)}
            disabled={rows.length === 1}
          >
            ×
          </button>
        </div>
      ))}

      <div className="row">
        <button type="button" onClick={add}>
          {addLabel}
        </button>
        <span className="hint" style={{ margin: 0 }}>
          {rows.filter((r) => r.name.trim()).length} filled in
        </span>
      </div>

      {duplicates.size > 0 && (
        <p className="hint">
          The same name appears more than once:{' '}
          {[...duplicates.values()].join(', ')}. Fine if that is deliberate.
        </p>
      )}
    </>
  )
}
