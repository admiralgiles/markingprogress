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

## Signing in

A short code per competition, for example `ESKER26`.

1. Judge opens the link
2. Types the competition code
3. Picks their name from the list of judges for that competition
4. Starts marking

No passwords and no accounts. Volunteers forget passwords, and nobody wants
to be doing password resets on a wet Saturday morning.

The code also pulls down everything the judge needs before they walk off:
the marking sheet, the team list and their assigned sections. This has to
happen while they still have signal.

## The marking sheet comes from a spreadsheet

The admin uploads one spreadsheet that defines the whole competition. Four
tabs, described in full in [SPREADSHEET.md](SPREADSHEET.md).

| Tab | What it holds |
|---|---|
| `Marking Sheet` | Sections, items and marks available |
| `Sections` | How many judges per section, and how to combine them |
| `Teams` | Who is being judged |
| `Judges` | Who is marking, and which sections they cover |

A filled-in example lives at `sample-data/competition-template.xlsx`.

## Multiple judges on the same section

This varies between competitions, so it is set per section in the spreadsheet
rather than fixed in the app. The `Sections` tab says how many judges cover
each section and what to do when there is more than one:

| Combine | What happens |
|---|---|
| `Single` | One judge only. Their mark is the mark. |
| `Average` | All judges' marks are averaged automatically. |
| `Highest` | The highest mark counts. |
| `Lowest` | The lowest mark counts. |
| `Separate` | All marks shown side by side. A human decides the final score. |

So one competition can have knots judged by one person, camp craft averaged
across three, and an overall impression score shown separately for the
organiser to settle.

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

## Still to be decided

- Hosting for the app itself
- Whether the organiser wants a live leaderboard during the competition, or
  only final results afterwards
- What the results export looks like
