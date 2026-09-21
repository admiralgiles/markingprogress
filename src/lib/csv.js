/**
 * Minimal CSV reading and writing.
 *
 * Written by hand rather than pulled from a package because the marking
 * criteria are full of commas, apostrophes and question marks, and it is
 * worth being able to see exactly how they are quoted.
 */

/** Quote one field if it needs it. */
export function escapeField(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Build a CSV from an array of rows, each row an array of values. */
export function toCsv(rows) {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n')
}

/**
 * Parse CSV text into rows of strings.
 *
 * Handles quoted fields, doubled quotes inside them, and both line endings.
 * Lines whose first field starts with # are dropped, so the instruction
 * block at the top of an exported template does not come back as data.
 */
export function fromCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  // A byte order mark from Excel would otherwise land in the first header.
  if (text.charCodeAt(0) === 0xfeff) i = 1

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
    } else if (ch === ',') {
      endField()
      i++
    } else if (ch === '\r') {
      // Swallow CRLF as one line ending.
      endRow()
      i += text[i + 1] === '\n' ? 2 : 1
    } else if (ch === '\n') {
      endRow()
      i++
    } else {
      field += ch
      i++
    }
  }

  // Only keep a trailing partial row if it actually holds something.
  if (field !== '' || row.length > 0) endRow()

  return rows.filter(
    (r) =>
      !(r.length === 1 && r[0].trim() === '') &&
      !r[0].trimStart().startsWith('#'),
  )
}
