# CueBracket v0.6.3 — Premium Bracket Experience

## Replace / add these files

Copy the `components` folder into your CueBracket project and allow Windows to merge/replace matching files.

### Replaced
- `components/DoubleEliminationManager.tsx`
- `components/ReadOnlyBracket.tsx`
- `components/BracketConnections.tsx`

### New
- `components/BracketViewport.tsx`
- `components/ChampionCelebration.tsx`

## Features added
- Zoom in, zoom out, and reset zoom controls for every bracket section
- Mouse drag-to-pan for large brackets
- Mobile horizontal round snapping
- Live match pulse and status badges
- Completed-match winner highlighting
- Table number, race length, and match duration display
- Tournament progress bar
- Animated champion celebration and confetti
- Improved card hover and transition effects
- Same premium experience on the public read-only bracket

## Run

```powershell
npm run dev -- --webpack
```

Then open an existing double-elimination tournament and refresh the page.
