# MarkingProgress: how it works

Plain-language design notes. Decisions recorded here so they are not lost
between sessions.

## The problem

Judges score teams at a competition. They are often standing in a field with
no phone signal. Marks must not be lost, and must reach a central database
once the judge gets back to Wi-Fi or a 4G/5G signal, which might be an hour
or two later.

## The shape of it

An installable web app (a PWA). Judges open a link, add it to their home
screen, and it behaves like an app. No App Store, no Play Store, no install
fees, works on whatever phone or tablet a volunteer turns up with.

## How marks travel

```
Judge taps a mark
      |
      v
Saved on the judge's own device, immediately
      |
      v
Sits there safely, however long it takes. No signal needed.
      |
      v
Signal or Wi-Fi returns. The app notices by itself.
      |
      v
Marks are sent to the database in the background
      |
      v
Database confirms receipt
      |
      v
Only then are they cleared from the "waiting to send" queue
```

Rules this follows:

- The device is the first home for a mark, not a cache of the server.
- Nothing is removed from the device until the database confirms it arrived.
- Sending is automatic. A judge never has to remember to press "sync".
- If sending half-fails, the marks are still on the device and it retries.
- Every mark carries the time it was entered, so late arrivals are still
  recorded in the right order.

### Sync status is visible

Every screen shows where the judge stands:

- `All marks sent` when the queue is empty
- `4 marks waiting to send` when offline or mid-send
- `Sending...` while it is working

This matters operationally. At the end of the day someone can check whether
any judge still has unsent marks and go and find them.

### The risk that cannot be designed away

If a judge's device is lost, wiped or dies before it reaches a signal, those
marks are gone. No app can prevent that. The status badge is the mitigation:
it makes unsent marks visible so they can be chased before everyone goes home.

## Signing in, and picking up an iPad

A short code per competition, for example `ESKER26`. Judges share a pool of
iPads rather than each having their own device, so the app has to ask who is
holding it.

1. Judge opens the link and types the competition code
2. Picks what they are marking, e.g. Cooking and Eating
3. Picks their own name
4. Picks the slot, e.g. Sunday Evening
5. Works through the teams

No passwords and no accounts. Volunteers forget passwords, and nobody wants
to be doing password resets on a wet Saturday morning.

Entering the code also pulls down everything needed before the judge walks
off: the criteria, the team list and the slots. That has to happen while
there is still a signal.

Because an iPad gets handed on, the name and slot are asked every time rather
than remembered. Marks already taken stay queued on that device no matter who
picks it up next.

## The criteria come from a CSV the app generates

The admin gives the start date, the finish date and the categories, and
downloads a CSV shaped to that event. They fill in their criteria and upload
it back. Full format in [SPREADSHEET.md](SPREADSHEET.md).

This replaces a fixed template, because events vary: Thursday to Saturday,
Friday to Sunday, Saturday to Monday, or Thursday to Sunday for Phoenix.

## Marking is per criterion, not per slot

This is the main difference from the spreadsheet. A judge marks each
criterion and the app adds them up. Campcraft Sunday Afternoon is 40
criteria totalling 1200, and at the moment a judge adds those up by hand on
paper and types one number.

Keeping the individual marks means totals are never wrong, and a patrol can
afterwards be shown exactly where their marks went.

## Combining several judges' marks

**Asked at competition setup, per category.** All five rules are supported,
because it varies between competitions and between categories of the same
competition. Nothing is hard-coded.

| Rule | What happens |
|---|---|
| `average` | Mean of the judges who actually marked it. What the current sheet does. |
| `dropHighLow` | Discard the highest and lowest, average the rest. |
| `sum` | All judges' marks added together. |
| `single` | One judge only. |
| `separate` | All marks shown side by side. A person decides. |

Decisions built into these:

- **`average` uses whoever submitted**, not a fixed three. Judges routinely
  miss marks and the spreadsheet already behaves this way.
- **`dropHighLow` needs three marks.** With two, dropping a high and a low
  leaves nothing, so it falls back to a plain average and flags that it did.
  With exactly three it keeps the middle mark.
- **`single` refuses to guess.** If two judges have both marked something set
  up for one judge, no score is produced. Averaging would invent a number
  nobody gave. Both marks are kept for the organiser to settle.
- **`separate` produces no automatic score** and hands every mark back.
- **A mark of zero is a real mark.** Only an absent mark counts as missing.

### Combined at judge-total level

Each judge's marks for a slot are added up first, then the judges' totals are
combined. Not the other way round.

This matters for `dropHighLow`. Dropping the high and low *per criterion*
would drop a different judge on every line, which is not what "drop the
harshest judge" means. It also matches the existing spreadsheet.

### A judge may not mark their own Group

Where the judging is staffed by the competing Groups, one judge per Group,
a judge is never offered a team from their own Group, and standing down is
not counted as a missing mark.

Set up by giving judges and teams a Group. If neither has one, the rule does
not apply and nothing changes.

### Missing and partial marks

Two different problems, both surfaced rather than hidden:

- **A judge marked nothing for a team.** The score still counts, using the
  judges who did mark, and the admin screen names who is missing so they can
  be chased before results are announced.
- **A judge marked some criteria but not all.** Their slot total is not
  comparable with a judge who marked everything, so averaging the two without
  saying so quietly under-scores that team. Flagged separately.

### Summed marks have to be comparable

Under `average`, a judge who forgets to mark barely matters. Under `sum` it
costs that team roughly a whole judge's worth of marks, and nothing on screen
would say so. In the 2026 Cub Challenge one forgotten section was worth 112
points against a 49 point gap for first place.

So when a competition sums, the app counts how many judges have marked each
team and refuses to treat the totals as comparable when that count varies.
See [COMPETITION-TYPES.md](COMPETITION-TYPES.md).

Full precision is kept throughout and rounding happens only on screen.
Rounding each slot before adding them shifts the total, and with 51 marks
between fourth and fifth place out of 8500 that is not worth introducing.

## Awards worked out from marks already counted

Some awards are derived from criteria that are already inside another
category, and must **not** be added to the overall total again.

| Award | Built from | Max |
|---|---|---|
| Test Meal | Cooking and Eating: Sat Evening + Sun Evening | 680 |
| Environmental | Named waste and bin criteria from Cooking and Eating and Campcraft | 235 |

So a derived award is a named list of criteria plus a rule, and a flag saying
it does not count towards the overall score. An award pointing at a criterion
that does not exist is refused rather than quietly scoring low.

The Environmental award now includes the two litter criteria that the
spreadsheet left out, taking it from 200 to 235. See
[EVENT-STRUCTURE.md](EVENT-STRUCTURE.md).

Best New Scout, Best Scout, Best Patrol Leader and the Camp Chief Award are
judgement calls, not calculations. They need a place to record a winner.

## Programme bases

The six bases carry 2700 marks, about a third of the competition. Base staff
mark on the app like any other judge, with simpler criteria than a full site
inspection.

No special handling is needed: a base is a category with its own criteria in
the upload, so `Category` is `Programme` and `Slot` is the base name. The
criteria themselves still have to be supplied.

## Results

Places, gaps and ordinals are calculated. In the existing spreadsheet that
table is typed by hand, which is how it ended up reading `1nd`, `2rd` and
`3th`.

Teams on the same total share a place and the next place skips, so two teams
first means the next is third. A team with nothing marked yet is listed as
not scored rather than ranked on zero.

## Where the data lives

Two places, deliberately:

- **On each judge's device.** IndexedDB, not localStorage. localStorage is
  small, and it blocks the screen while it writes. IndexedDB handles a full
  competition comfortably and survives the app being closed.
- **In a hosted database.** Postgres via Supabase. Free tier covers a
  volunteer-scale competition easily, it speaks proper SQL for working out
  results, and the data stays exportable rather than locked in.

This is a standalone system. It has nothing to do with ScoutProgress and
shares no data or logins with it.

## Where this came from

[EVENT-STRUCTURE.md](EVENT-STRUCTURE.md) sets out how a real Shield is
scored, taken from the 2026 marking sheets.
[SPREADSHEET-ISSUES.md](SPREADSHEET-ISSUES.md) lists the specific problems in
the current spreadsheet that this is meant to remove.

## Still to be decided

- Hosting for the app itself
- Whether the organiser wants a live leaderboard during the competition, or
  only final results afterwards
- What the results export looks like
- How the six Programme bases are marked. They arrive on the `Main` tab as
  one number per base per team, and no marking sheets have been supplied for
  them.
- What the `*` against six Campcraft criteria means. There is no legend in
  the file.
