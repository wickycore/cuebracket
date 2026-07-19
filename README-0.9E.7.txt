CueBracket 0.9E.7 — Single-Elimination Stabilization

Replace these files in C:\project\cuebracket:
- lib\bracket\singleElimination.ts
- components\BracketManager.tsx
- components\LiveMatchCenter.tsx
- app\tournaments\[id]\page.tsx

Fixes:
- No premature champions.
- Unfinished feeder matches are never treated as BYEs.
- Race-to results are strictly validated.
- Undo clears every affected downstream result.
- Existing corrupted single-elimination brackets repair when opened.
- Tournament status follows the real final automatically.
- Elimination tournaments cannot be manually completed early.
- Organizer bracket uses the same connector system as public view.
- Fully empty branches display as inactive slots.
- New matches store explicit feeder-source metadata.
- Live Match Center uses the canonical single-elimination engine.
- Public-view button uses the Supabase cloud route.

After extracting, run:
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  npm run build
  npm run dev
