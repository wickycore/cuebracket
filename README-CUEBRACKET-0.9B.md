# CueBracket 0.9B — Multi-Format Tournament Engine

This patch expands CueBracket from elimination-only tournaments into a complete multi-format competition platform.

## Formats included

### Single-stage

- **Single Elimination** — balanced BYEs, automatic progression, undo and champion detection.
- **Double Elimination** — winners bracket, losers bracket, Grand Final and optional bracket reset.
- **Round Robin** — one or two legs, automatic rounds, odd-player BYEs and live standings.
- **Swiss System** — points-based pairing, repeat-opponent avoidance where possible, rotating BYEs and Buchholz tiebreaking.
- **Free For All** — scored multi-player heats, configurable heat size, placement points and overall standings.
- **Leaderboard** — scheduled cycles, frame difference, bonus/penalty adjustments and live rankings.

### Two-stage

- Round-robin groups.
- Configurable group count and qualifiers per group.
- Automatic qualifier seeding.
- Single-elimination or double-elimination final stage.
- Optional bracket reset for double-elimination finals.

## Other upgrades

- A redesigned tournament creation page with format cards and format-specific rules.
- A shared competition control centre for results, standings, heats and qualification.
- Read-only public views for every format.
- Champion, progress, statistics, Hall of Champions and dashboard support for every engine.
- Supabase cloud serialization and realtime support for competition data.
- Backward-compatible normalization for existing single- and double-elimination tournaments.

## Installation

1. Stop the development server.
2. Extract this ZIP into `C:\project\cuebracket` and replace matching files.
3. In Supabase, open **SQL Editor**.
4. Open `supabase\phase09b_multi_format.sql`, paste its contents and run it once.
5. Clear the Next.js cache and restart:

```powershell
cd C:\project\cuebracket
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev -- --webpack
```

## Required acceptance tests

1. **Round Robin:** create 6 players, complete all matches and confirm standings/champion.
2. **Swiss:** create 7 players with 3 rounds; confirm one BYE per round and use “Generate next round”.
3. **Free For All:** create 8 players, heat size 4, save scores and confirm placement points.
4. **Leaderboard:** complete matches, then apply a bonus or penalty and confirm rankings update.
5. **Two-stage:** create 8 players, 2 groups and top 2 qualifiers; finish groups and generate finals.
6. **Cloud:** publish a new-format tournament and confirm the public page updates in realtime.
7. Run `npm run build` before committing.

## Notes

- Existing tournaments are preserved. Old records receive safe default options when loaded.
- Do not run the SQL migration before Phase 6A/6B database setup exists.
- Free For All is implemented as multi-player scored heats rather than simultaneous pool-table play.
- Swiss pairings avoid rematches where possible; in very small fields or many rounds, a repeat may eventually be unavoidable.

Suggested commit message:

```text
CueBracket 0.9B - multi-format tournament engine
```
