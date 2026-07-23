# CueBracket 0.9F.5 — Engine Stability Corrections

This patch fixes the final two engine issues identified during the audit.

## 1. Double-elimination late-entry concurrency

The old handler used tournament and bracket data from the React render that created the button. If another update had already been saved, a late entry could be applied to an older bracket snapshot.

The corrected handler now:

- reads the newest tournament from storage before making the change;
- uses the newest double-elimination bracket;
- trims and validates the player name;
- checks the selected BYE is still open;
- rejects stale or already-filled slots safely;
- saves the roster and bracket together in one update.

## 2. Shared race-to validation

These formats now enforce the configured race target:

- Round Robin
- Swiss
- Leaderboard
- Groups → Finals group matches
- Groups → Finals final-stage matches

For Race to 5:

Valid:
- 5–0
- 5–4
- 3–5

Rejected:
- 4–3
- 6–2
- 5–5
- negative, decimal or blank scores

Free For All heat scores are unchanged because they use score-cap/placement rules instead of head-to-head race results.

## Install

Extract this ZIP directly into:

`C:\project\cuebracket`

Then run:

```powershell
cd C:\project\cuebracket

node .\apply-0.9f5-engine-stability.mjs

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

npm run build
npm run dev
```

Expected message:

`CueBracket 0.9F.5 engine stability patch applied successfully.`

## Test Double Elimination

1. Create an 8-slot event with 7 players.
2. Generate the bracket.
3. Open the late-entry panel.
4. Add player 8 to the open BYE.
5. Wait, refresh, navigate away and return.
6. The added player must remain.
7. Trying to use the same BYE again must be blocked.

## Test shared race-to validation

Create a Race to 5 Round Robin or Swiss event.

- Enter `4–3`: it must be rejected.
- Enter `6–2`: it must be rejected.
- Enter `5–3`: it must save.

No SQL or npm package changes are required.
