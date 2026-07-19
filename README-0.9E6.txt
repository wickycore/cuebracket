CueBracket 0.9E.6 — Public Single-Elimination Connector Fix

Replace:
  components/BracketConnections.tsx

Fixes:
- Public single-elimination brackets now infer connector links when older/current
  bracket records do not contain source1/source2 metadata.
- Existing tournaments work without regenerating their brackets.
- Explicit double-elimination source mappings remain preferred and unchanged.
- Connector measurements rerun after cloud hydration, realtime updates, font
  loading, resize and mobile orientation changes.
