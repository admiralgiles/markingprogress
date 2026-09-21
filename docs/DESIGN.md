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

Set **per category**, because it varies between competitions and between
sections of the same competition.

| Rule | What happens |
|---|---|
| `Average` | Mean of the judges who actually marked it. What the current sheet does. |
| `Drop high and low` | Discard the highest and lowest, average the rest. Needs at least three judges. |
| `Sum` | All judges' marks added together. |
| `Single` | One judge only. Their mark is the mark. |
| `Separate` | All marks shown side by side. A person decides the final score. |

`Average` takes the mean of whoever submitted, not of a fixed three. Judges
routinely miss marks, and the current spreadsheet already behaves this way.

Where a judge has not marked a team at all, the app knows, and can say so
rather than quietly averaging two marks where three were expected.

## Awards worked out from marks already counted

Some awards are derived from criteria that are already inside another
category, and must **not** be added to the overall total again.

| Award | Built from |
|---|---|
| Test Meal | Cooking and Eating: Sat Evening + Sun Evening |
| Environmental | Named waste and bin criteria from both Cooking and Eating and Campcraft |

So a derived award is a named list of criteria plus a rule, and a flag saying
it does not count towards the overall score.

Best New Scout, Best Scout, Best Patrol Leader and the Camp Chief Award are
judgement calls, not calculations. They need a place to record a winner.

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
