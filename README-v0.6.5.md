# CueBracket v0.6.5 — Live Match Center fix

This patch fixes the runtime error:

`Cannot read properties of undefined (reading 'flatMap')`

## What changed

- Live Match Center now supports both single and double-elimination brackets.
- Double-elimination updates use the existing `updateDoubleMatch` engine.
- Matches automatically finish and advance at the race target.
- Undo reopens an auto-finished match and recalculates downstream routing.
- Tournament status automatically becomes completed when a champion is crowned.

## Install

Replace:

`components/LiveMatchCenter.tsx`

Then restart:

`npm run dev -- --webpack`

Test one single-elimination and one double-elimination tournament.
