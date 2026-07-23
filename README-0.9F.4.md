# CueBracket 0.9F.4 — Tournament Page Stability

This patch addresses both problems reported on the new organizer profile:

1. A late player was added to the roster, then disappeared from the bracket while the automatic BYE returned.
2. Tournament pages became very slow and navigation links appeared unresponsive.

## Root causes fixed

- The old single-elimination repair effect could finish after a newer late-entry action and overwrite the new bracket with stale data.
- Bracket connector measurement watched its own SVG DOM mutations. Updating connector paths could trigger another measurement repeatedly, causing a render/layout loop and severe page lag.
- The late-entry handler used render-time tournament data instead of the newest saved tournament state.

## Files

- Replaces `components/BracketConnections.tsx`
- Safely patches `components/BracketManager.tsx` using the included Node script.

## Install

Extract the ZIP directly into:

`C:\project\cuebracket`

Choose **Replace the file in the destination**.

Then run:

```powershell
cd C:\project\cuebracket
node .\apply-tournament-stability-fix.mjs
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
```

## Existing corrupted test tournament

Open the existing four-player tournament again. If the roster contains four players while the bracket still shows a BYE, the patch will automatically restore the one missing player when:

- no real match has been completed,
- exactly one roster player is missing from the bracket, and
- exactly one BYE slot is open.

For any older tournament that does not meet those safe conditions, use Reset competition and regenerate it.

## Test

1. Create a four-slot Single Elimination tournament with three players.
2. Generate the bracket.
3. Add a fourth late player to the BYE.
4. Wait ten seconds, navigate to Dashboard, then return.
5. The player must remain in the selected first-round slot.
6. Dashboard, Tournaments and Cloud navigation should react immediately.
7. Connector lines must remain visible.
