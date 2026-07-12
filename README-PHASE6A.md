# CueBracket Phase 6A — Cloud Foundation

This release adds the foundation for:

- Supabase Authentication
- User accounts and profiles
- Protected organizer dashboard
- Admin/owner database permissions using RLS
- Cloud tournament publishing
- Realtime public spectator pages
- Club-ready database tables
- Player statistics and ranking view

## 1. Install dependencies

After replacing the included files, run:

```powershell
npm install
```

Then start CueBracket:

```powershell
npm run dev -- --webpack
```

## 2. Run the database schema

Open Supabase:

`SQL Editor → New Query`

Open this patch file:

`supabase/phase6a_schema.sql`

Copy the entire SQL file into Supabase and click **Run**.

## 3. Check Vercel environment variables

Use your existing values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The code supports that existing anon key.

Newer Supabase projects can instead use:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never add the `service_role` key to the browser or Vercel public variables.

## 4. Configure Supabase Auth URLs

In Supabase:

`Authentication → URL Configuration`

Set Site URL to your Vercel website.

Add Redirect URLs:

- `http://localhost:3000/auth/callback`
- `https://YOUR-VERCEL-DOMAIN/auth/callback`

## 5. Test authentication

Open:

- `/auth/signup`
- Confirm the email if confirmation is enabled.
- `/auth/login`
- `/account`

The dashboard, account and cloud center now require login.

## 6. Test cloud and realtime

1. Create a local tournament normally.
2. Open `/cloud`.
3. Click **Publish to cloud**.
4. Open the generated cloud live link.
5. Update the local tournament.
6. Return to `/cloud` and click **Update cloud**.
7. The public cloud page updates instantly without refreshing.

This first cloud release uses an explicit **Update cloud** button so your current stable local tournament engine is not replaced. In Phase 6A.2, every score click will sync automatically.

## Important

The public realtime route is:

`/cloud/live/[tournamentId]`

Database RLS ensures spectators can only read public tournaments. Only the owner or a club admin can update cloud records.
