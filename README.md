# MarkingProgress

Competition marking sheets and scoring: judges score competitors against
categories on a tablet or phone, an admin view collects the results.

Judges mark on a phone or tablet, often with no signal. Marks are held on the
device and sent to the database by themselves once a signal comes back.

## Status

Design agreed, not yet built. The toolchain (React + Vite) is set up and
builds, but `src/App.jsx` is still a placeholder.

Working, with 114 tests: setup, judge marking, results, and the scoring
underneath. Checked against the real 2026 sheets for three different
competitions, reproducing their category totals and results tables.

Runs locally. Not hosted anywhere yet, and the database is still a stand-in,
so marks live on the device only.

- [docs/DESIGN.md](docs/DESIGN.md) covers how it works and why
- [docs/SPREADSHEET.md](docs/SPREADSHEET.md) defines the criteria CSV
- [docs/EVENT-STRUCTURE.md](docs/EVENT-STRUCTURE.md) how a real Shield is scored
- [docs/COMPETITION-TYPES.md](docs/COMPETITION-TYPES.md) how the Shield and the
  Cub Challenge differ, and what that forces to be configurable
- [docs/SPREADSHEET-ISSUES.md](docs/SPREADSHEET-ISSUES.md) what the current
  spreadsheet gets wrong, and why the app removes it
- [sample-data/example-criteria.csv](sample-data/example-criteria.csv) a
  filled-in example using invented criteria
- [sample-data/example-split-criteria.csv](sample-data/example-split-criteria.csv)
  a sheet split by colour between two sets of judges, Phoenix style

## Running it

```bash
npm install
npm start          # dev server on http://localhost:3000
```

Other scripts:

```bash
npm test           # run the test suite
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Requires Node 20 or newer.

Generate a blank criteria file for a competition:

```bash
npm run export-template -- \
  --start 2026-05-30 --end 2026-06-01 \
  --name "Liffey West County Shield" \
  --categories "Check In,Campcraft,Cooking and Eating,Logbook,Campfire" \
  --out criteria.csv
```

## Layout

```
index.html              Vite entry point
src/index.jsx           React root
src/App.jsx             Application shell
src/App.css             Styling
src/screens/            Setup, judge marking, results
src/store/              Device storage and the outbox
src/transport.js        Sending marks (stand-in until a database exists)
src/lib/days.js         Competition days, Thursday-first week
src/lib/csv.js          CSV reading and writing
src/lib/template.js     Criteria template export and import
src/lib/scoring.js      Combining judges' marks, marking groups, completeness
src/lib/tally.js        Scoring a whole competition, who is outstanding
src/lib/judges.js       Who may mark whom, score comparability
src/lib/rotation.js     Teams rotating around activity stations
src/lib/results.js      Ranking, gaps, derived awards
scripts/                Command line tools
```

## Input it expects

One criteria CSV per competition. The admin gives the dates and the
categories, downloads a file shaped to that event, fills in the criteria and
uploads it back. See [docs/SPREADSHEET.md](docs/SPREADSHEET.md).

Judges sign in with a short competition code, for example `ESKER26`, then pick
what they are marking, their name, and the slot. No accounts and no passwords.

Real competitor or member data must not be committed. `.gitignore` excludes
`data/`, `exports/` and loose spreadsheet files. The only tracked spreadsheet
is the template, which uses invented names.
