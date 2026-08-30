# Phase 4G — Installable app and opt-in phone alerts

## Player experience

- The dashboard and notification inbox show installation controls. Supported browsers offer an install prompt; iPhone/iPad users receive Safari → Share → Add to Home Screen instructions.
- Open **Notifications → Enable phone alerts** in the installed app (iOS/iPadOS 16.4+) or a supported desktop/Android browser. No notification permission is requested automatically.
- **Send test alert** checks delivery through the actual push provider, with a one-minute cooldown. A successful send means the provider accepted it; the device still controls presentation.
- Club-event registration openings, registration/membership decisions, live tournament matches and table assignments use existing account preferences. League table alerts require linked player profile IDs; tournament alerts require approved/checked-in registered players.
- Each browser installation opts in separately (maximum five devices per account). Turning off phone alerts leaves the inbox intact. Signing out revokes that browser's subscription. Expired endpoints are removed automatically.
- Lock-screen notifications are intentionally generic. Details are shown only in the authenticated inbox.

## Offline limits

The service worker stores only `/offline.html`. It never caches authenticated HTML, API responses or live scores. This is an installable online app with a safe offline fallback, not a fully offline tournament editor. Existing device-local tournament storage is unchanged.

## Backend

The additive migration `20260830223840_add_opt_in_web_push_and_table_alerts.sql` creates device subscriptions, a durable delivery queue, table notifications and a minute-based retry job. The retry job makes no network request when there are no due jobs. Delivery is attempted at most three times; match/table jobs expire after ten minutes. Provider delivery is best effort and a duplicate retry may replace a notification with the same tag.

`supabase/functions/push-notifications` is the dispatcher and device-management endpoint. Its pinned Deno dependencies are independent of the Next.js package tree. Deploy with its `deno.json` import map.

The Edge Function has gateway JWT verification disabled because it serves both webhook and user routes. **Do not remove its custom authorization:** device actions validate the bearer token through `auth.getUser`; dispatch requires the Vault-backed webhook secret and constant-time comparison. SQL RPCs for key access, subscription writes and queue claiming are executable only by `service_role`. Device endpoints are restricted to known HTTPS browser push providers to prevent SSRF.

VAPID private keys and the dispatcher secret are generated for this installation and stored in Supabase Vault. Only service-only RPCs may access them. Never commit keys or move them into `NEXT_PUBLIC_` environment variables. No additional Vercel environment variables are required. Initial key creation is serialized and does not rotate existing keys.

## Verification and operations

Run the existing test suite, TypeScript and lint checks. `tests/push.test.ts` covers endpoint restrictions, preference filtering, install metadata, offline behavior, generic previews and secret-access boundaries.

For a physical-device test: install the app, sign in, enable alerts, send a test, close the app and create a real opted-in event/match update. Check disable, account-switch and sign-out behavior too. Do not enroll real users or send unsolicited test messages from backend tooling.

Backend-only tables intentionally have RLS with no client policies. Supabase may list them as informational notices; they are server-only, not publicly exposed. An existing unrelated project warning about leaked-password protection should be reviewed separately: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
