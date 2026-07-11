# CueBracket Pro — Phase 5: Live Tournament Center

This package builds directly on Phase 4.

## New features

### Live Match Center
- Professional two-player scoreboard
- Race-to scoring using the tournament's race setting (3, 5, 7, 9, 11, etc.)
- Break indicator
- Table assignment
- Running match timer
- Match notes
- Undo last score
- Manual winner confirmation / finish match
- Automatic winner advancement after finishing

### Live Tournament Dashboard
- Tournament progress bar
- Current round
- Active matches
- Completed matches
- Remaining matches
- Champion banner
- Average recorded match time

### Public Live View
- Route: `/live/[tournamentId]`
- Auto-refresh every two seconds
- Read-only bracket
- Current live scores
- Recently completed matches
- Tournament statistics

### Sharing
- Copy spectator link
- QR code
- WhatsApp
- Facebook
- X / Twitter

### Auto-save
Every match update is written immediately to browser local storage and restored after refresh.

## Important Phase 5 limitation

This phase still uses browser local storage. The spectator page works with the same saved browser data, but a different phone or computer cannot receive those scores yet. True cross-device public live viewing will be enabled in the Supabase cloud-sync phase.

## Installation

1. Stop the development server with `Ctrl + C`.
2. Copy the `app`, `components`, and `lib` folders into your CueBracket project root.
3. Merge folders and replace matching files.
4. Start the project:

```bash
npm run dev -- --webpack
```

5. Open a tournament, generate its bracket, then use the Live Match Center.
6. Test the spectator route using the **Open public view** button.
