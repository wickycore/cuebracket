CueBracket 0.9E.5 — Premature Single-Elimination Champion Fix

Replaces:
  lib/bracket/singleElimination.ts

Fix:
  A winner may advance through a genuine BYE only after both feeder matches
  for that later-round match have been resolved. An unfinished feeder is no
  longer mistaken for a BYE, so a first-round winner cannot become champion
  before the semifinal and final are actually played.

Existing affected tournament:
  After installing, Undo the first GM result and save the correct result again.
  That recalculates the stored bracket and removes the false champion.
