# CueBracket v0.6.1 — Double Bracket Layout Refresh

This patch keeps the existing double-elimination engine and changes the presentation only.

## Improvements
- Winners bracket, losers bracket and grand final are fully separated into individual panels.
- Winners bracket uses cyan accents.
- Losers bracket uses rose accents.
- Grand final uses violet accents.
- Round columns receive wider spacing and staggered vertical positioning.
- Match cards are more compact, reducing congestion.
- Horizontal flow guides are shown on large screens.
- Public read-only bracket uses the same cleaner layout.

## Install
Copy `components/DoubleEliminationManager.tsx` and `components/ReadOnlyBracket.tsx` into the matching `components` folder in your CueBracket project, replacing the current files.
