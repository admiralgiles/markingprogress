# Air Adventure Skill Stage 3: Aviation Wheel of Fortune

A single-file, offline Wheel of Fortune game for the 142nd Dublin (Esker) Scout Group. Three Patrols take turns answering Stage 3 questions over walkie-talkies. The Scouter marks answers and clicks letters, and the projector shows the board.

## What it needs

- Nothing to install. No internet, server or database.
- Chrome or Edge on Windows. Double-click `index.html`.
- Firefox is untested. Its file-window sync may not work (see Troubleshooting).

## Running it on the day

1. Double-click `index.html`. This opens the **Scouter control panel** on the laptop.
2. Plug in the projector, extend the display, and click **Open projector window**. Drag that window onto the projector and press **F** (or the Full screen button) to fill it.
3. If the projector window won't sync, use **Board view in this window** instead. The board fills the laptop screen, and **Esc** brings the controls back. Move the window to the projector screen with the laptop set to extend.

## Running a turn

1. **Start round N** (pick a phrase or leave it on Random).
2. **Choose question** (Random, or pick one from the list). Press **F2** or **Show question on projector** if the Patrol should see it.
3. The Patrol answers over the radio. Press **Correct** (Enter) or **Incorrect** (Delete).
4. If correct, the Patrol says a NATO word. Click that letter (or type the word into "Patrol says" and press Enter). Or press the letter key on your keyboard. Every occurrence scores 10 points. A miss scores 0.
5. Turns rotate Eagles, Falcons, Kestrels, then repeat, whatever the result. The turn passes after every answer.
6. A correct Patrol can also try the whole phrase: **Phrase right** (+50) or **Phrase wrong** (0, turn passes).
7. **Reveal answer** ends the round with no points. **Reset this round** takes back the points won this round.
8. **Finish game and show leaderboard** shows the winner on the projector.

Other controls: countdown timer, mute, Undo (Ctrl+Z), manual score adjustments, Show board or Blank screen, New game.

## Editing questions and phrases

- **Edit questions** and **Edit phrases** in the control panel add, change or delete items. Changes save in this browser.
- **Export bank** saves a JSON backup. **Import bank** loads one back. **Reset to built-in** goes back to the defaults.
- The defaults are the `BUILTIN_QUESTIONS` and `BUILTIN_PHRASES` arrays near the top of the script in `index.html`.
- Phrases are converted to capitals A to Z. Other characters become spaces. Maximum 60 characters.
- Each question has a learning area (1 to 10), a level (easy, medium, hard), the question, and an answer. The answer is shown only to the Scouter.

## How the two windows stay in sync

The Scouter window saves the game to the browser's local storage. The projector window reads it about four times a second. Both windows are the same file, so Chrome and Edge share the storage between them. The projector window sends a heartbeat, and the Scouter shows whether it is connected.

The projector only ever receives what it should show: the revealed letters, scores, the current question when shown, the timer and the events. The phrase and the answers are never sent to it.

## Troubleshooting

- **"Projector window: not connected"**: check the projector was opened from the Scouter window's button, not by dragging the file. Use Chrome or Edge. If it still fails, use **Board view in this window**.
- **Pop-up blocked**: allow pop-ups for the file in the browser's address bar, then press Open projector window again.
- **Sound**: the first click or key press unlocks sound. The Sound button mutes it.

## Rules as built

- Correct answer: that Patrol may call one letter or try the phrase.
- Each occurrence of a called letter: 10 points. Absent letter: 0.
- Phrase solved: 50 bonus points. Wrong attempt: 0, turn passes.
- If the last letter is revealed by calling letters, the round ends with no solve bonus. Change `doLetter()` if you want a bonus there.
- Turns rotate through the three Patrols in order. A correct answer does not keep the turn.
- Highest total after all rounds wins. Ties are shown as joint winners.
