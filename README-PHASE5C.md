# CueBracket Phase 5C — League System

## Added
- Create League button on dashboard
- League list and search
- Single round-robin and home-and-away schedules
- Add/import/remove players
- Automatic fixture generation
- Score entry and result reset
- Automatic standings:
  - Played
  - Won
  - Lost
  - Frames for
  - Frames against
  - Difference
  - Points
- Public read-only league link
- Browser auto-save

## Routes
- `/leagues`
- `/leagues/new`
- `/leagues/[id]` — organizer management
- `/league/[id]` — public read-only page

## Install
Copy `app`, `components`, and `lib` into your current CueBracket project and replace matching files.

Run:
`npm run dev -- --webpack`

## Test
1. Create a league.
2. Add 4 players.
3. Generate fixtures.
4. Enter two results.
5. Confirm standings update.
6. Open the public view and confirm there are no edit controls.
