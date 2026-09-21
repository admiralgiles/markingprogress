# The marking criteria CSV

Rather than handing out a fixed template, the app generates one shaped to the
event. The admin says when the competition runs and which categories are in
it, and gets back a CSV with the valid day and category combinations already
filled in. They add their criteria and upload it back.

```
Admin enters dates + categories
        |
        v
Download a CSV shaped to that event
        |
        v
Fill in the criteria in Excel
        |
        v
Upload it back
        |
        v
App checks it and reports any problems by row number
```

Try it now, before the admin screen exists:

```bash
npm run export-template -- \
  --start 2026-05-30 --end 2026-06-01 \
  --name "Liffey West County Shield" \
  --categories "Check In,Campcraft,Cooking and Eating,Logbook,Campfire,Programme" \
  --out criteria.csv
```

## Days

The competition start and finish dates drive everything. Days come out in the
order they happen, so a Saturday to Monday event reads Saturday, Sunday,
Monday.

Where day names have to be sorted without dates, the week runs **Thursday,
Friday, Saturday, Sunday, Monday, Tuesday, Wednesday**. Shield events run
Thursday to Saturday, Friday to Sunday, Saturday to Monday, or Thursday to
Sunday for Phoenix. Sorting a Saturday to Monday event by a normal
Monday-first week gives Monday, Saturday, Sunday, which is nonsense on a
marking sheet.

Events longer than 14 days are refused, on the grounds that it is a typo.

## Columns

| Column | Required | What it holds |
|---|---|---|
| `Category` | yes | Campcraft, Cooking and Eating, Logbook, Campfire, Check In, Programme |
| `Day` | no | Which day of the event, e.g. `Saturday` |
| `Date` | no | The actual date, `YYYY-MM-DD` |
| `Slot` | no | When in the day: `Morning`, `Afternoon`, `Evening`, `Final Inspection`. Blank for a category marked once only, like Logbook. |
| `Group` | no | The heading a criterion sits under, e.g. `Tentage`, `Food Storage` |
| `Criterion` | yes | The question the judge answers |
| `Max Marks` | yes | A whole number greater than zero |
| `Requires Reason` | no | `yes` where the judge must write why they gave the marks. Used for bonus points. Blank means no. |

One row per thing a judge marks. So a Campcraft Sunday Afternoon inspection
with 40 criteria is 40 rows.

Columns can be in any order, as long as the header names match.

The download is the heading row and the rows themselves, nothing else. An
earlier version put guidance at the top as `#` comment lines, which was a
mistake: in a spreadsheet the prose lines land in column A while the example
lines, which contain commas, spray across all nine columns, and the whole
sheet reads as a jumble. The guidance now sits on the setup screen beside the
download button, where it can be laid out properly.

Lines starting with `#` are still ignored on the way back in, so notes
somebody adds by hand do not break the upload.

## Example

```csv
Category,Day,Date,Slot,Group,Criterion,Max Marks,Requires Reason
Campcraft,Saturday,2026-05-30,Evening,Tentage,Is Personal Gear stored correctly inside the tent(s)?,10,no
Campcraft,Saturday,2026-05-30,Evening,Tentage,Are guy ropes correct? No tripping hazards?,10,no
Campcraft,Saturday,2026-05-30,Evening,General Site,Have segregated bins been provided?,10,no
Logbook,Sunday,2026-05-31,,,Overall presentation and completeness,600,no
Campcraft,Monday,2026-06-01,Final Inspection,Bonus Points,Bonus marks awarded,50,yes
```

### Bonus points

A bonus section with no set criteria is one criterion whose maximum is the
cap, with `Requires Reason` set to `yes`. The judge awards up to the cap and
has to say why. Awarding nothing needs no explanation.

Criteria are full of commas, apostrophes and quotes, so fields are quoted
properly on the way out and unquoted on the way back in. Excel's byte order
mark is stripped rather than being left stuck to the first column name.

## What is checked on upload

Rejected, with the row number, if:

- A required column is missing
- A row has no `Category` or no `Criterion`
- `Max Marks` is missing, zero, negative, or not a whole number
- `Requires Reason` is something other than yes or no
- The same `Criterion` appears twice in the same category, day, slot and group

Deliberately allowed:

- **The same wording in different groups.** `Is non-perishable food organised?`
  genuinely appears under both Food Storage and Hygiene on the real Cooking
  and Eating sheet.
- **Untouched rows from the export.** A row with a category and day but nothing
  else is one the admin did not use. Skipped quietly.
- **A file written before `Requires Reason` existed.** The column is optional,
  so an older file still imports and everything defaults to no.

After a successful upload the app shows totals per category and per slot, so
they can be checked against what they should be before anyone starts marking.

## Confirmed against the real event

The 2026 Shield marking sheets convert into this format cleanly: **252
criteria across 14 slots, no errors**, and every total reconciles.

| Category | Criteria | Total |
|---|---|---|
| Check In | 3 | 45 |
| Campfire | 7 | 500 |
| Logbook | 17 | 600 |
| Campcraft | 148 | 3455 |
| Cooking and Eating | 77 | 1200 |
| Programme | not yet supplied | 2700 |
| **Overall** | | **8500** |

## A note on real data

Do not commit a filled-in criteria file for a live competition, and never one
containing team names, judge names or Scouts' names. `.gitignore` blocks loose
CSV and spreadsheet files for that reason.
