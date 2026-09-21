# The competition spreadsheet

One spreadsheet defines a whole competition. The admin uploads it and the app
builds the marking sheets from it.

A filled-in example is at
[`sample-data/competition-template.xlsx`](../sample-data/competition-template.xlsx).
The example names and groups in it are invented.

## Rules that apply to every tab

- Tab names must be exactly as below. Do not rename them.
- The header row must stay as it is. The importer looks for those column names.
- Section names must be spelled identically wherever they appear. `First Aid`
  on one tab and `First aid` on another will not match up.
- Grey columns are calculated by the spreadsheet itself. The importer ignores
  them, so they are there to help the person filling it in, not the app.
- Blank rows are skipped. Trailing empty rows are fine.
- `.xlsx` and `.csv` are both accepted. A CSV can only carry one tab, so a
  full competition needs the `.xlsx`.

## Tab: `Marking Sheet`

Every item being marked.

| Column | Required | What it holds |
|---|---|---|
| `Section` | yes | The station or category, for example `First Aid` |
| `Item` | yes | The specific thing being marked |
| `Max Marks` | yes | A whole number greater than zero |
| `Notes` | no | Guidance shown to the judge on screen |

A `Total marks available` row at the bottom is optional and ignored on import.

## Tab: `Sections`

How each section is judged. One row per section.

| Column | Required | What it holds |
|---|---|---|
| `Section` | yes | Must match a section on `Marking Sheet` |
| `Judges` | yes | How many judges cover this section |
| `Combine` | yes | One of the five values below |
| `Max Marks` | calculated | Total marks for the section |
| `Judges listed` | calculated | How many judges are actually named on `Judges` |
| `Notes` | no | For your own reference |

### `Combine` values

| Value | What happens |
|---|---|
| `Single` | One judge only. Their mark is the mark. |
| `Average` | Every judge's mark is averaged. |
| `Highest` | The highest mark counts. |
| `Lowest` | The lowest mark counts. |
| `Separate` | All marks shown side by side. A person decides the final score. |

These are set per section, so one competition can mix them freely.

`Judges listed` exists to catch setup mistakes. If it does not match `Judges`,
someone is missing from the `Judges` tab or their section is misspelled. The
importer rejects the file when they disagree, rather than discovering it
halfway through a competition.

## Tab: `Teams`

Who is being judged.

| Column | Required | What it holds |
|---|---|---|
| `Team` | yes | Patrol or team name. Must be unique. |
| `Group` | yes | Which Scout Group or unit they are from |
| `Category` | no | Lets you rank groups separately, e.g. `Scouts`, `Ventures` |
| `Notes` | no | For your own reference |

## Tab: `Judges`

Who is marking what. One row per judge per section, so a judge covering two
sections gets two rows.

| Column | Required | What it holds |
|---|---|---|
| `Judge Name` | yes | As it should appear in the sign-in list |
| `Section` | yes | Must match a section on `Sections` |
| `Notes` | no | For your own reference |

Judge names are shown in a list at sign-in, so they need to be recognisable
to the judge picking their own name off a phone screen.

## What the importer checks before accepting a file

The file is rejected with a plain-language message if:

- A tab or a required column is missing
- A section on `Marking Sheet` has no row on `Sections`, or the reverse
- A section on `Judges` does not exist on `Sections`
- `Judges` and `Judges listed` disagree for any section
- `Combine` is not one of the five accepted values
- `Combine` is `Single` but more than one judge is assigned
- `Max Marks` is missing, zero, negative or not a number
- Two teams share a name

Better to fail on the laptop the night before than halfway through a wet
Saturday.

## A note on real data

Do not commit a filled-in competition file containing real member or
competitor names to this repository. `.gitignore` blocks loose spreadsheets
for that reason. The only spreadsheet tracked here is the template, with
invented names.
