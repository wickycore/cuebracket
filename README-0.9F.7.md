# CueBracket 0.9F.7 — Active Tournament Navigation

This is a stronger replacement for 0.9F.6.

## Why the buttons were still failing

The currently deployed repository still shows the older connector build (`0.9f4`), so the 0.9F.6 connector hotfix had not reached production.

The header also uses Next.js client-side `Link` navigation. When an active tournament page is busy processing bracket updates, that client-side route transition can fail to complete even though the browser shows the destination URL when you hover the button.

## What 0.9F.7 changes

1. Includes the 0.9F.6 connector and stale-bracket fixes.
2. Converts the organizer header links to native browser links.
3. Converts Account navigation to native browser links.
4. Converts tournament-page navigation such as Open public view to native browser links.

Native navigation unloads the tournament page directly, so Dashboard, Cloud, Tournaments, Leagues, Tables, Champions, Account and New Event will still open even while a tournament is active.

## Install

Extract this ZIP directly into:

`C:\project\cuebracket`

Choose **Replace the files in the destination**.

Run:

```powershell
cd C:\project\cuebracket

powershell -ExecutionPolicy Bypass -File .\apply-0.9f7-active-navigation.ps1

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

npm run build
npm run dev
```

Expected messages:

- `CueBracket 0.9F.6 navigation stability hotfix applied.`
- `CueBracket 0.9F.7 hard-navigation fallback applied.`
- `CueBracket 0.9F.7 applied successfully.`

## Test before pushing

Keep a tournament active and unfinished.

Click:

- Dashboard
- Tournaments
- Cloud
- Leagues
- Tables
- Champions
- New Event
- Account
- Open public view

Every link must leave the active tournament page immediately.

Then push and wait for the Vercel deployment to show Ready.
