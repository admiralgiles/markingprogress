# What goes wrong in the current spreadsheet

Findings from the 2026 Shield marking sheet. Recorded because these are the
specific problems the app needs to remove, not as criticism of a sheet that
has clearly been doing a job for years.

None of these are wrong **today**. Every total in the 2026 sheet is correct.
They are traps that go off the next time someone fills in a cell that is
currently empty.

## 1. Fifteen cells will silently ignore a judge's marks

The worst of it, and the reason any of this matters.

Each score is meant to be the mean of the judges who marked it. Excel's
`AVERAGE` skips blank cells, so that works even when a judge misses one. But
the ranges have been edited by hand over time to work around blanks, and in
fifteen places a judge's column now sits **outside** the range being averaged.

Ten narrowed `AVERAGE` ranges:

| Section | Cell | Formula | Judge column left out |
|---|---|---|---|
| Cooking and Eating, Mon Morning | `I16` | `=AVERAGE(G16:H16)` | F |
| Campcraft environmental total | `I27` | `=AVERAGE(F27,G27)` | H |
| Logbook | `E31` | `=AVERAGE(C31:D31)` | B |
| Logbook | `I31` | `=AVERAGE(F31,H31)` | G |
| Logbook | `Q31` | `=AVERAGE(O31:P31)` | N |
| Logbook | `Y31` | `=AVERAGE(V31:W31)` | X |
| Campfire | `E35` | `=AVERAGE(B35,D35)` | C |
| Campfire | `M35` | `=AVERAGE(J35:K35)` | L |
| Campfire | `Q35` | `=AVERAGE(N35,P35)` | O |
| Campfire | `U35` | `=AVERAGE(S35:T35)` | R |

And five per-judge subtotals with no `SUM` formula at all, so the cell stays
blank and drops out of the average above it: `F22`, `K22`, `T22`, `H27`,
`K27`.

### Why this is not a small thing

Take `E31`, the Logbook score for Site 1. It reads `=AVERAGE(C31:D31)`, so
cell `B31` is excluded. It currently shows 435, the mean of 390 and 480.

If the third judge's mark were entered into `B31`:

| Third judge's mark | Correct average | Sheet still shows | Silent error |
|---|---|---|---|
| 300 | 390.00 | 435 | +45.00 |
| 100 | 323.33 | 435 | +111.67 |

Logbook feeds straight into the overall total. In 2026 the gaps between
places were:

| Places | Gap |
|---|---|
| 1st to 2nd | 407.33 |
| 2nd to 3rd | **67.67** |
| 3rd to 4th | 135.17 |
| 4th to 5th | **51.67** |
| 5th to 6th | 194.33 |

A 111 point error against a 51 point gap changes who wins. Nothing on screen
would look wrong.

## 2. The item detail never reaches the spreadsheet

The marking sheets hold **252 individual criteria**, 249 of them judged:

| Section | Criteria | Max |
|---|---|---|
| Campcraft | 148 | 3455 |
| Cooking and Eating | 77 | 1200 |
| Logbook | 17 | 600 |
| Campfire | 7 | 500 |
| Check In | 3 | 45 |

With three judges and six teams, that is roughly **4,500 individual marks per
competition**. The Input tab holds one number per judge per slot, so every
judge is adding up their own paper sheet by hand and typing a single total.

Forty items summing to 1200 on Campcraft Sunday Afternoon, added up in a
field, is a lot of mental arithmetic to trust. And once the total is typed,
the detail is gone: nobody can see afterwards where a team lost marks, which
is exactly what a patrol most wants to know.

## 3. The results table is typed by hand

The place, team and gap columns on the `Main` tab contain no formulas. Someone
has read the totals off and typed them in. The ranking and every gap in the
2026 sheet is arithmetically correct, but the ordinal suffixes give the game
away: `1nd`, `2rd`, `3th`.

Team names in that table also have a stray number stuck on the end, which
turns out to be the team's Check In score, so every entry reads like
`<team name> 42`. All six rows have it.

## 4. Smaller things

- `Campcraft ` on the `Input` tab has a trailing space, so it does not match
  `Campcraft` anywhere else.
- Six criteria across two Campcraft slots are marked with a `*`, and there is
  no legend anywhere in the file saying what it means.
- `Test Meal` and `Environmental` are worked out from marks already counted
  elsewhere and are correctly kept out of the 8500 total. Worth writing down,
  because it would be an easy thing to break by adding them in.

## 5. The Environmental award: settled

Environmental currently draws on four groups of criteria:

| Section | Slot | Criteria | Max |
|---|---|---|---|
| Campcraft | Sat Evening | segregated bins provided, bins used correctly | 20 |
| Campcraft | Sun Afternoon | waste segregation, bins used, waste water system fit for purpose, waste water in use, sustainable initiative | 150 |
| Cooking and Eating | Sat Evening | rubbish and food waste disposed of correctly | 15 |
| Cooking and Eating | Sun Evening | rubbish and food waste disposed of correctly | 15 |
| | | **Total** | **200** |

Two other criteria looked environmental but were not included:

- Campcraft, Sun Afternoon: `Is the site free from litter?` (15)
- Campcraft, Mon Final Inspection: `Is the site clean & free of rubbish and scorching?` (20)

**Decided: both are now counted**, taking the award from 200 to 235.

## What the app changes

| Problem | How it goes away |
|---|---|
| Narrowed average ranges | There are no ranges. The mean is taken over the judges who actually submitted a mark. |
| Hand arithmetic on paper | Judges mark each criterion and the totals add themselves up. |
| Lost item detail | Every mark is kept, so a patrol can be shown where the marks went. |
| Hand-typed results table | Ranking, gaps and ordinals are calculated. |
| Trailing spaces and name mismatches | Sections come from one list rather than being retyped per tab. |
| Missing marks going unnoticed | The app can show which judge has not marked which team yet. |
