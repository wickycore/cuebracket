CueBracket 0.9E.8 — Single-Elimination Core

REPLACES
- lib/bracket/singleElimination.ts
- components/BracketConnections.tsx

FIXES
- Prevents premature champions.
- Waits for both feeder matches before treating an empty side as a BYE.
- Clears invalid downstream results after Undo or changed winners.
- Repairs legacy source metadata and bracket round metadata.
- Strict race-to result helper remains available.
- Adds explicit winner-source metadata to every later-round match.
- Restores public and organizer connector lines for old and new brackets.
- Re-measures connectors after hydration, font loading, resizing and rotation.
- Keeps lines readable at 25%–200% zoom.

INSTALL
Extract directly into C:\project\cuebracket and replace destination files.

VERIFY
Select-String -Path .\lib\bracket\singleElimination.ts -Pattern "0.9E.8"
Select-String -Path .\components\BracketConnections.tsx -Pattern "0.9e8"

Then run:
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
