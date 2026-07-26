# CueBracket 0.9F.6 — Tournament Navigation Stability Hotfix

The latest pushed repository still contained two older pieces of code:

1. `BracketConnections.tsx` still used a `MutationObserver` on the bracket while the component itself updated SVG children. That could create a repeated measure/render loop and block clicks on Dashboard, Cloud and other navigation.
2. `BracketManager.tsx` still contained the old single-elimination repair and late-entry handlers rather than the stale-safe 0.9F.4 versions.

## Fixes

- Removes the bracket MutationObserver entirely.
- Updates connector state only when size or paths actually change.
- Keeps the SVG fully `pointer-events: none`.
- Uses a unique SVG filter ID per bracket.
- Keeps connector lines working at all zoom levels.
- Prevents old bracket repairs from overwriting a newer late entry or score.
- Makes Single Elimination late entry use the newest saved tournament and bracket.
- Repairs the reported roster/bracket mismatch safely when no real match has been played.

## Install

Extract this ZIP directly into:

`C:\project\cuebracket`

Choose **Replace the files in the destination**.

Then run:

```powershell
cd C:\project\cuebracket

node .\apply-0.9f6-navigation-stability.mjs

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

npm run build
npm run dev
```

Expected message:

`CueBracket 0.9F.6 navigation stability hotfix applied.`

## Test

1. Open a Single or Double Elimination tournament.
2. Leave it open for 30 seconds.
3. Click Dashboard, Tournaments and Cloud.
4. Each link should react immediately.
5. Return to the tournament and confirm connector lines remain visible.
6. Add a late player to a Single Elimination BYE, navigate away and return.
7. The player must remain in the bracket.
