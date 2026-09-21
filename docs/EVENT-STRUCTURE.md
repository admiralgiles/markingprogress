# How a Shield event is actually scored

Taken from a real Shield marking sheet for 2026. Structure only. Judge names,
team names, Scout Group numbers and award winners are all left out
deliberately, because the real sheet contains children's and volunteers'
names and none of that belongs in a code repository.

The real sheet is kept outside this repo.

## Shape of the competition

Six sites. Each site has one team, identified by a Scout Group and a team
name. Two teams can come from the same Group, so the Group on its own is not
a unique identifier.

Marks are grouped into **sections**. Most sections are split into **time
slots** spread across the weekend. Every (section, time slot, team)
combination is marked independently by each judge assigned to that section.

## Sections that count towards the result

| Section | Max | Time slots | Marked by |
|---|---|---|---|
| Check In, Inspection | 45 | one | entered directly, not judged per judge |
| Logbook | 600 | one | 3 judges |
| Campfire | 500 | one | 3 judges |
| Campcraft | 3455 | six | 3 judges |
| Cooking and Eating | 1200 | five | 3 judges |
| Programme | 2700 | six bases | entered directly, not judged per judge |
| **Overall** | **8500** | | |

The maxima add up: 45 + 600 + 500 + 3455 + 1200 + 2700 = 8500.

### Campcraft time slots

| Slot | Max |
|---|---|
| Sat Afternoon | 150 |
| Sat Evening | 150 |
| Sun Morning | 1200 |
| Sun Afternoon | 1200 |
| Sun Evening | 300 |
| Mon Final Inspection | 455 |
| **Total** | **3455** |

### Cooking and Eating time slots

| Slot | Max |
|---|---|
| Sat Afternoon | 155 |
| Sat Evening | 340 |
| Sun Morning | 220 |
| Sun Evening | 340 |
| Monday Morning | 145 |
| **Total** | **1200** |

### Programme bases

Six bases at 450 each: Backwoods, Pioneering, First Aid, Orienteering,
Water, Fire. These arrive as one number per base per team rather than as
individual judges' marks.

## Judges

Three judges per section, and they are **different people for each section**.
In the 2026 event, the three Campcraft judges marked Campcraft and nothing
else. Cooking and Eating had three different judges again, and Logbook and
Campfire had another set each.

Each judge marks **every team** for their section, so a judge works their way
round all six sites rather than being given a subset of teams.

## How several judges' marks are combined

Every judge's mark for a (section, slot, team) goes in separately, and the
figure used is the **mean of the judges who actually marked it**.

This matters: judges routinely miss marks. In the 2026 sheet there are gaps
all over the Input tab, so some scores are the mean of three judges and
others the mean of two. The spreadsheet handles this because Excel's
`AVERAGE` skips blank cells.

## Awards that sit outside the total

Two scores are worked out from marks already counted elsewhere. They decide
awards and are deliberately **not** added to the overall 8500, so there is no
double counting.

| Award | Worked out from |
|---|---|
| Test Meal | Cooking and Eating: Sat Evening + Sun Evening |
| Environmental | Specific waste and bin items from both Cooking and Eating and Campcraft, summed per judge, then averaged |

Environmental is the more awkward of the two. It pulls named items out of two
different sections, each marked by that section's own judges, sums them per
judge, and then averages across judges.

## Other awards decided by hand

Best New Scout, Best Scout, Best Patrol Leader, Camp Chief Award. These are
judgement calls rather than calculations, so the app needs somewhere to
record a winner, not a formula.

## Results table

Teams ranked by overall total, showing the gap to the team above. In 2026 the
gaps were tight: 67.67 between second and third, and 51.67 between fourth and
fifth, out of 8500.

That tightness is the reason the marking has to be right. See
[SPREADSHEET-ISSUES.md](SPREADSHEET-ISSUES.md).
