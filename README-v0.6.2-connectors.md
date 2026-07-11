# CueBracket v0.6.2 — Bracket connector lines

This patch adds responsive SVG elbow connector lines between matches in:

- Winners bracket (cyan)
- Losers bracket (rose)
- Grand final / reset (violet)
- Public read-only bracket view

## Install

Copy these files into your project and replace matching files:

- `components/DoubleEliminationManager.tsx`
- `components/ReadOnlyBracket.tsx`
- `components/BracketConnections.tsx` (new)

Restart the development server:

```powershell
npm run dev -- --webpack
```

The connectors recalculate automatically when the bracket changes, the window is resized, or match cards change size.
