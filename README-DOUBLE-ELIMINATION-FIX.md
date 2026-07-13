# CueBracket double-elimination BYE fix

This patch fixes the double-elimination bracket getting stuck on `TBD` when a
first-round bracket slot contains no players.

## What changed

- BYEs are spread across first-round matches instead of collecting into a
  `BYE vs BYE` match at the bottom of the bracket.
- Empty legacy matches are treated as resolved, allowing the real player in
  the connected match to advance automatically.
- Works with 4, 8, 16, 32, 64 and 128-player bracket sizes.

## Install

Extract this ZIP into the CueBracket project root and replace the destination
file when prompted.

Then run:

```powershell
cd C:\project\cuebracket
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev -- --webpack
```

## Existing tournament shown in the screenshot

The engine repair runs whenever a match is recalculated. After installing:

1. Open the tournament.
2. Click **Undo** on one completed match.
3. Enter the same score and click **Save**.

That single recalculation will resolve the old empty slot and advance Wicky (or
whichever player is waiting beside the empty lane). New brackets are generated
with balanced BYEs automatically.
