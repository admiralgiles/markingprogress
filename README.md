# MarkingProgress

Competition marking sheets and scoring: judges score competitors against
categories on a tablet or phone, an admin view collects the results.

Judges mark on a phone or tablet, often with no signal. Marks are held on the
device and sent to the database by themselves once a signal comes back.

## Status

Design agreed, not yet built. The toolchain (React + Vite) is set up and
builds, but `src/App.jsx` is still a placeholder.

- [docs/DESIGN.md](docs/DESIGN.md) covers how it works and why
- [docs/SPREADSHEET.md](docs/SPREADSHEET.md) defines the upload format
- [sample-data/competition-template.xlsx](sample-data/competition-template.xlsx)
  is a filled-in example to copy

## Running it

```bash
npm install
npm start          # dev server on http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Requires Node 20 or newer.

## Layout

```
index.html         Vite entry point
src/index.jsx      React root
src/App.jsx        Application (placeholder)
src/App.css        Styling
```

## Input it expects

One spreadsheet per competition, defining the marking sheet, the sections,
the teams and the judges. See [docs/SPREADSHEET.md](docs/SPREADSHEET.md) for
the format and `sample-data/competition-template.xlsx` for a working example.

Judges sign in with a short competition code, for example `ESKER26`, then pick
their name from a list. No accounts and no passwords.

Real competitor or member data must not be committed. `.gitignore` excludes
`data/`, `exports/` and loose spreadsheet files. The only tracked spreadsheet
is the template, which uses invented names.
