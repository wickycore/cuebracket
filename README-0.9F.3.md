# CueBracket 0.9F.3 — Fast Realtime Sync

This patch fixes the delay between the organizer page and the public spectator page.

## What it changes

1. Restores `CloudAutoSyncProvider` in `app/layout.tsx`.
2. Changes the organizer cloud-upload debounce from 650ms to 120ms.
3. Keeps the existing Supabase realtime subscription on the public page.

## Install

Extract this ZIP directly into:

`C:\project\cuebracket`

Choose **Replace the file in the destination**.

Then open PowerShell in the project folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-fast-live-sync.ps1
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

After the build passes, commit and push.

## Expected result

Most score/result changes should appear publicly in roughly under 1–2 seconds on a normal connection. A small network delay is still normal because the update must travel:

Organizer browser → Supabase database → Supabase Realtime → spectator browser.
