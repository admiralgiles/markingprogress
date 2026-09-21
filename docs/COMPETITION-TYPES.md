# Two competitions, two different ways of scoring

Taken from the 2026 County Shield (Scouts) and the 2026 Cub County Challenge.
Structure only. No judge names, team names, Group numbers or Cubs' names.

They differ enough that nothing about scoring can be hard-coded. This is the
list of what has to be a setup question.

## Side by side

| | County Shield | Cub County Challenge |
|---|---|---|
| Teams | 6 sites | 8 sites |
| Judges | 3 per section, named people, a different three per section | 4, one from each competing Group, all judging everything |
| Judges' marks combined by | **Average** | **Sum** |
| A judge marking their own Group | not applicable | **Not allowed** |
| Slots | parts of a day: Sat Afternoon, Sun Morning | clock times: Sat 10:30am, Sat 2:00pm to 4:30pm |
| Criteria | 252, all itemised | itemised, plus Bonus Points with no breakdown |
| Notes from judges | no column for it | a Notes column against every criterion |
| Max per team | 8500 | 1600 per judge, so 4800 across three |
| Awards from marks counted elsewhere | Test Meal, Environmental | Waste Management lifted out of Campcraft |
| Stations teams rotate around | no | yes, for Adventure Skills |

## The conflict of interest rule

The Cub Challenge is staffed by the competing Groups: one judge per Group,
each marking every team. A judge must not mark their own Group's team.

In the spreadsheet this is done by hand, with an `X` where that judge's mark
would have gone. Checked across all 8 sites and every scored section, it is
followed correctly every time, and the judge standing down is always the one
from the team's own Group. But it relies on whoever builds the sheet putting
the X in the right cell, eight times over, every year.

In the app this comes from the data: judges have a Group, teams have a Group,
and a judge is never offered a team from their own Group. A judge standing
down is not counted as a missing mark.

## Why summing changes everything about missing marks

This is the important one, and it is not obvious.

Under **average**, a judge who forgets to mark barely matters. The score is
the mean of whoever did mark, and the team is scored on the same scale as
everyone else.

Under **sum**, a judge who forgets to mark costs that team roughly a whole
judge's worth of marks, and nothing on screen says so.

Taking real 2026 Cub figures for one section, Campcraft Camp Site:

| | Marks | Section score |
|---|---|---|
| All three judges marked | 115, 115, 112 | 342 |
| One judge forgot | 115, 115 | 230 |

A 112 point difference. The gap between first and second place that year was
**49 points**, and between sixth and seventh it was **5**. One forgotten
section decides the competition, and the sheet would look perfectly normal.

So the app tracks how many judges have marked each team and refuses to treat
the totals as comparable when a summed competition has an uneven count. The
same missing mark is nearly harmless under one rule and decisive under the
other, which is exactly why it needs saying out loud.

## Three different judging arrangements

| Arrangement | Where | What it means |
|---|---|---|
| Several judges, marking separately | Shield, Cub main sections | Each judge submits their own marks and the app combines them |
| A judge standing down | Cub main sections | Eligible judges only, and standing down is not a gap |
| A pair of judges, one agreed score | Cub Adventure Skills | Two judges run a station together and submit a single mark |

The third is genuinely different: in the Cub tally, the Adventure Skills rows
hold one number per team with no per-judge columns at all, because the pair
running the station agree a score between them.

**Decided: a pair agrees one score and enters it once.** The pair is recorded
as the marker, not whichever of them held the iPad. Either member's Group
rules the pair out of marking a team, since the conflict is with the people
judging rather than with whoever types it in.

## Phoenix: one sheet, two sets of judges

Phoenix Campcraft is a fourth arrangement again, and the one that matters
most because it breaks an assumption the other two invite.

Every Campcraft sheet is divided by colour. `ODDS MARK YELLOW / EVENS MARK
GREEN` on the rota is not a presentation choice: **two judges mark the yellow
blocks, two different judges mark the green ones**, each judge marks
independently, the pair on each colour is averaged, and the two colour scores
**add up** to the sheet total.

Taking the real Saturday Afternoon sheet:

| Colour | Blocks | Marks |
|---|---|---|
| Yellow | Dining Shelter 140 + Safety, Hygiene & Theme 105 | 245 |
| Green | Table and Seating 140 + General Site 110 | 250 |
| | **Sheet total** | **495** |

So four judges per sheet, and the scoring is average **within** a colour and
sum **across** colours.

### Why this had to change the code

The Shield and the Cub Challenge both invite the assumption that a judge who
marked some criteria but not all has left a gap, and the app flags exactly
that, because on those competitions it means a team was quietly under-scored.

On Phoenix that assumption is wrong. A judge who marks only the yellow blocks
has finished. Flagged naively it would fire on every sheet, every slot, all
weekend, and the warning would be ignored within an hour.

So completeness is now counted **within a judge's own marking group**, never
across the whole sheet, and a judge is only offered their own group's
criteria. Set with the `Marking Group` column in the criteria file, and a
judge is given their group at setup. Leave both blank and nothing changes.

## Four judging arrangements, not three

| Arrangement | Where | How it scores |
|---|---|---|
| Several judges, same criteria | Shield | combined by the category's rule |
| A judge standing down | Cub Challenge | eligible judges only |
| A pair, one agreed score | Cub Adventure Skills | the pair is the marker |
| Two sets of judges, split sheet | Phoenix Campcraft | average within a colour, add across colours |

## Bonus Points

The Cub sheet has Bonus Points sections worth 50, 15 and 15 with no criteria
listed under them. The judge awards up to the cap using their judgement.

This is a group with one criterion whose maximum is the cap, flagged as
needing a reason.

**Decided: the judge must write why.** Marks with no set criteria are the
ones most likely to be queried afterwards, and a reason also gives the
patrol something useful back. Awarding nothing needs no explanation.

## Things the Cub spreadsheet gets wrong

- **The whole Max Points Available column for sites 5 to 8 points at the
  wrong rows.** All 17 references are shifted, and 14 show plainly wrong
  figures: Check-In and Test Meal read 0, Boundary reads 30 instead of 130,
  Backwoods reads 130 instead of 90. It is display only and feeds no total,
  so the results are still right, but anyone reading the sheet for those four
  sites is being shown nonsense.
- **Waste Management is handled correctly**, which is worth noting because it
  looks like a trap. Saturday's Waste Management sits inside the Campcraft
  block but is subtracted out of the Campcraft subtotal and shown on its own
  line with Sunday's, so it is not counted twice.
- One Group number is mistyped, so it will not match itself anywhere else.
  Exactly the class of error that goes away when Groups come from one list
  instead of being retyped per column.
