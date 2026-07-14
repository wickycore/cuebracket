# CueBracket 0.9D — Final Engine Presentation Polish

This patch applies the final corrections found during the Round Robin, Swiss, Groups → Finals, and Double Elimination acceptance tests.

## Corrections included

### Swiss standings
- A BYE still awards the configured win points.
- A BYE no longer increases **P** (played matches) or **W** (on-table wins).
- The **BYE** column records automatic awards separately.
- The organizer and public-view explanations now describe the rule accurately.
- P and W headers include helpful descriptions when BYEs are present.

Example after one physical win, one physical loss, and one BYE:

- P: 2
- W: 1
- L: 1
- BYE: 1
- Points: two win awards

### Double elimination
- Tournament progress excludes automatic BYEs.
- A completed seven-player reset tournament now displays 13 of 13 played matches and 100%, rather than 13 of 15 and 87%.
- Automatic advances are displayed as dedicated **Automatic BYE** cards instead of `Player vs TBD`.
- Public spectator brackets use the same corrected BYE cards and progress calculation.
- User-facing match numbers begin at Match 1 rather than Match 0.
- `Reset bracket` is renamed to **Reset competition** to avoid confusion with the Grand Final bracket-reset rule.
- After the reset match is finished, the Grand Final description changes from active tense to a completed-state explanation.
- Completing the final automatically sets the tournament status to `completed`, making **Reopen tournament** available.

## Installation

1. Stop the development server.
2. Extract this ZIP directly into the CueBracket project root.
3. Replace the files in the destination.
4. Delete the `.next` cache and restart the project.

```powershell
cd C:\project\cuebracket
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev -- --webpack
```

No Supabase SQL or npm package changes are required.

## Quick verification

### Swiss
Create seven players and three rounds. A player with one win, one loss and one BYE should show:

```text
P 2 | W 1 | L 1 | BYE 1
```

The BYE points must still be included in total points.

### Double elimination
Create seven players with Grand Final reset enabled and complete a reset scenario. Confirm:

- Progress is 100%.
- Played-match total excludes BYEs.
- BYEs appear as Automatic BYE cards.
- Match numbering starts at 1.
- The completed reset message is shown.
- Reopen tournament is available.

Then run:

```powershell
npm run build
```
