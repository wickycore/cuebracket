# CueBracket Phase 6B — Automatic Cloud Synchronization

This patch removes the manual **Update cloud** workflow and turns Supabase into an automatic, realtime backup for tournaments.

## What changes

- Every tournament, player, bracket and score change is queued automatically.
- Rapid score clicks are debounced so Supabase is not spammed.
- Offline and failed changes retry automatically.
- The pending queue survives a browser restart, including queued deletions.
- Cloud tournaments are restored when the organizer signs in on another device.
- Owner cloud lists no longer include unrelated public tournaments.
- Public spectator pages receive realtime insert, update and delete events.
- Existing public tournaments stay public.
- New automatic backups start **private**; use **Make public** once when spectators should see the live link.
- Public/private visibility does not affect the automatic backup.

## Install

1. Stop the development server.
2. Extract this ZIP directly into the CueBracket project root:

   `C:\project\cuebracket`

3. Allow Windows to replace the existing files.
4. In Supabase, open **SQL Editor**, paste the contents of:

   `supabase/phase6b_auto_sync.sql`

   Then click **Run** once.
5. Clear the Next.js cache and restart:

```powershell
cd C:\project\cuebracket
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev -- --webpack
```

No new npm package is required. The patch does not contain `.env.local` or any Supabase key.

## Test

1. Sign in and open `/cloud`.
2. Create or open a tournament.
3. Change a score without clicking any cloud-update button.
4. Confirm the row in Supabase `cloud_tournaments` updates automatically.
5. For a new tournament, click **Make public** once.
6. Keep `/cloud/live/TOURNAMENT_ID` open in Incognito and change a score; it should update without refresh.
7. Disconnect the internet, change a score, reconnect, and confirm the queued change syncs.
8. While offline, delete a test tournament, close/reopen the browser, reconnect, and confirm the cloud deletion completes.
9. Sign in on another browser/device and confirm owned cloud tournaments restore locally.

## Commit message

`Phase 6B - automatic cloud synchronization`
