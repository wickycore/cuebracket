# CueBracket Pro — Phase 4

This phase adds the first stable bracket engine.

## Included

- Single-elimination brackets for 4, 8, 16, 32, 64 and 128 slots
- BYEs for empty slots
- Automatic BYE advancement
- Horizontal flow-chart bracket view
- Editable scores
- Automatic winner advancement
- Undo/edit completed results
- Automatic champion display
- Bracket reset
- Bracket persistence in browser local storage
- Player list locked after bracket generation to prevent broken draws

## Scope note

Proper double elimination needs a separate winners/losers routing engine. This phase intentionally keeps double-life tournaments ungenerated rather than supplying unreliable logic.

## Install

Copy these folders into the project root and merge/replace when prompted:

- `app`
- `components`
- `lib`

Then restart development:

```bash
npm run dev -- --webpack
```
