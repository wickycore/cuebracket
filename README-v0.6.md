# CueBracket v0.6 — Double Elimination Patch

Copy the `components` and `lib` folders into the root of the current CueBracket project and allow Windows to merge/replace matching files.

Then run:

```powershell
npm run dev -- --webpack
```

Test with 4 players first, then 8 players.

## Included
- Winners bracket
- Losers bracket
- Grand final
- Optional grand-final reset
- Automatic BYEs
- Automatic winner/loser routing
- Two-loss elimination
- Editable scores
- Undo/reset match result
- Champion detection
- 4, 8, 16, 32, 64 and 128 slots
- Public read-only double bracket support
