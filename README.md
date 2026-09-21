# MarkingProgress

Competition marking sheets and scoring: judges score competitors against
categories on a tablet or phone, an admin view collects the results.

## Status

Project shell only. The toolchain (React + Vite) is set up and builds, but
`src/App.jsx` is a placeholder rather than the real marking app. The
application code was written in a separate, temporary sandbox and was never
pushed here, so it needs to be dropped in or rebuilt.

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

Nothing yet. Once the marking app lands, scoring data is expected to live in
the browser (localStorage) so judges can keep working offline, with export
for the results.

Real competitor or member data must not be committed. `.gitignore` already
excludes `data/`, `exports/` and loose spreadsheet files. Use anonymised
fixtures in `sample-data/` if fixtures are needed.
