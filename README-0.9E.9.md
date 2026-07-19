# CueBracket 0.9E.9 — Late Entry & BYE Replacement

This patch adds safe late registration to Single Elimination and Double Elimination tournaments.

## What it does

- Detects genuine first-round automatic BYEs.
- Lets the organizer choose which BYE a late player will replace.
- Adds the late player to the tournament participant list.
- Cancels the automatic advance and turns that BYE into a normal playable match.
- Clears only untouched downstream placeholders and recalculates both brackets.
- Keeps every unrelated completed match unchanged.
- Locks the BYE once an affected next match has started or has a saved score.
- Syncs through the existing `updateTournament` and cloud auto-sync flow.
- Prevents duplicate names and exceeding tournament capacity.

## Installation

Extract this ZIP directly into:

`C:\project\cuebracket`

Choose **Replace the files in the destination**.

Then run:

```powershell
cd C:\project\cuebracket
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
```

No Supabase SQL changes and no `npm install` are required.

## Single-elimination test

1. Create an 8-player bracket with only 7 players.
2. Generate the bracket.
3. The **Late entry** panel should display one open BYE.
4. Enter the eighth player's name and choose the BYE.
5. The previous BYE card becomes a normal first-round match.
6. The old automatic advancement disappears until the replacement match is completed.
7. Open the cloud public page and confirm the new player appears.

## Lock test

1. Create another 7-of-8 bracket.
2. Complete the other first-round match feeding into the BYE recipient's next match.
3. Start that next match or save its score.
4. The BYE must now appear as locked and cannot be replaced.

## Double-elimination test

Repeat the same test using Double Elimination. The winner must continue through the winners bracket and the loser must enter the correct losers-bracket path.

Suggested commit:

`CueBracket 0.9E.9 - late entry and BYE replacement`
