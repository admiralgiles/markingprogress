import { useState } from 'react'

import { buildTemplateCsv, parseTemplateCsv, summarise } from '../lib/template.js'
import { COMBINE_RULES, COMBINE_RULE_LABELS } from '../lib/scoring.js'
import { buildCompetition, saveCompetition } from '../store/competition.js'

const DEFAULT_CATEGORIES = 'Check In,Campcraft,Cooking and Eating,Logbook,Campfire'

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * One per line: "Name, Group, Marking Group".
 *
 * Group is what stops a judge marking their own team. Marking Group is only
 * needed where a sheet is split by colour between different judges.
 */
function parsePeople(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, group, stream] = line.split(',').map((s) => s.trim())
      const person = { name }
      if (group) person.group = group
      if (stream) person.stream = stream
      return person
    })
}

export default function Setup({ onSaved, onCancel }) {
  const [name, setName] = useState('County Shield 2026')
  const [code, setCode] = useState('ESKER26')
  const [startDate, setStartDate] = useState('2026-05-30')
  const [endDate, setEndDate] = useState('2026-06-01')
  const [categoriesText, setCategoriesText] = useState(DEFAULT_CATEGORIES)
  const [criteriaCsv, setCriteriaCsv] = useState('')
  const [teamsText, setTeamsText] = useState(
    'Kestrel, Group A\nFalcon, Group A\nOsprey, Group B\nMerlin, Group B\nHarrier, Group C\nKite, Group D',
  )
  const [judgesText, setJudgesText] = useState(
    'Judge One, Group A\nJudge Two, Group B\nJudge Three, Group C\nJudge Four, Group D',
  )
  const [conflictRule, setConflictRule] = useState(false)
  const [rules, setRules] = useState({})
  const [problems, setProblems] = useState([])
  const [summary, setSummary] = useState(null)
  const [exportError, setExportError] = useState(null)

  const categories = categoriesText
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)

  const uploadedCategories = summary?.categories.map((c) => c.name) ?? []

  const handleExport = () => {
    setExportError(null)
    try {
      const csv = buildTemplateCsv({
        competitionName: name,
        startDate,
        endDate,
        categories,
      })
      download(`${name.replace(/\W+/g, '-').toLowerCase()}-criteria.csv`, csv)
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

  const handleSave = async () => {
    const { competition, errors } = buildCompetition({
      name,
      code,
      criteriaCsv,
      teams: parsePeople(teamsText),
      judges: parsePeople(judgesText),
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
        <label>
          Categories, separated by commas
          <input
            value={categoriesText}
            onChange={(e) => setCategoriesText(e.target.value)}
          />
        </label>
      </section>

      <section className="card">
        <h3>2. The marking criteria</h3>
        <p className="hint">
          Download a file shaped to these dates and categories, fill in your
          criteria in Excel, then upload it back.
        </p>
        <div className="row">
          <button type="button" onClick={handleExport}>
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
        <h3>3. Teams and judges</h3>
        <p className="hint">
          One per line, as <code>Name, Group</code>. The Group is what stops a
          judge marking their own. For judges you can add a third part,{' '}
          <code>Name, Group, Yellow</code>, where a sheet is split by colour
          between different judges.
        </p>
        <div className="grid">
          <label>
            Teams
            <textarea
              rows={7}
              value={teamsText}
              onChange={(e) => setTeamsText(e.target.value)}
            />
          </label>
          <label>
            Judges
            <textarea
              rows={7}
              value={judgesText}
              onChange={(e) => setJudgesText(e.target.value)}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={conflictRule}
            onChange={(e) => setConflictRule(e.target.checked)}
          />
          A judge may not mark a team from their own Group
        </label>
      </section>

      {uploadedCategories.length > 0 && (
        <section className="card">
          <h3>4. How several judges' marks are combined</h3>
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
