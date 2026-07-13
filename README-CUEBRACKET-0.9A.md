# CueBracket 0.9A — Experience Polish

This patch upgrades the product experience without changing tournament data or Supabase tables.

## Included

- Premium responsive landing page with a live tournament preview
- New mobile navigation and active page states
- Redesigned organizer dashboard and quick actions
- Expanded organizer analytics
- Live match pulse and recent result activity feed
- Better tournament cards with completion progress
- Tournament search by event, venue or player
- Status counts, sorting and improved empty states
- Refreshed tournament, league, table and champions pages
- Improved Hall of Champions and fixed the `format` field reference
- Updated metadata, accessibility, focus states and reduced-motion support
- Double-elimination BYE fix included for safety

## Install

Extract the ZIP into the CueBracket project root and replace files when prompted.
No SQL is required for this patch.

Then run:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev -- --webpack
```

## Test

1. Open `/` on desktop and mobile width.
2. Open `/dashboard` and check quick actions, stats and recent tournaments.
3. Search and filter at `/tournaments`.
4. Open `/leagues`, `/tables` and `/hall-of-champions`.
5. Confirm sign in, account and sign out still work.
6. Run `npm run build` before pushing.

Suggested commit:

`CueBracket 0.9A - experience polish and dashboard upgrade`
