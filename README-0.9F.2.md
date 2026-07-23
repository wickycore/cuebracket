# CueBracket 0.9F.2 — Cloud Sharing Repair

Replaces:
- components/ShareTournament.tsx
- components/CloudSyncPanel.tsx

Fixes:
- Organizer copy link, social links, and QR code use /cloud/live/TOURNAMENT_ID.
- NEXT_PUBLIC_SITE_URL prevents localhost links in production.
- Cloud Center actively retries missing backups.
- Unsynced tournaments show Back up now / Retry backup.
- Exact errors are shown instead of staying on Preparing backup.
- Ownership conflicts can be resolved with Save as my cloud copy.
- Synced tournaments can be made public and opened from Cloud Center.

Required Vercel variable:
NEXT_PUBLIC_SITE_URL=https://cuebracket-doaa.vercel.app

No SQL or npm package changes are required.
