# Phase 4H — Follow players and the live clubhouse

## Shipped

- Follow buttons on public player profiles and club member cards. Self-following is blocked. Following lists are private and survive device changes.
- Match alerts are a separate per-player opt-in, off by default. A separate Notifications preference can mute all followed-player alerts without affecting personal match/table notices.
- `/following` lists followed players, handles unavailable/private profiles, supports search/unfollow/muting, and shows current public matches.
- Clubs have a **Live now** watchboard and an admin-editable **Club guide** in Clubhouse: opening hours, house rules/visitor information and a Maps link from the existing club location. No rules or hours are invented.
- Club tab URLs preserve the selected section. Corrected the public announcement count and removed the inaccurate hard-coded invite hostname.

## Match and notification behavior

Tournament matches enter the watchboard after their cloud-synced match has `startedAt` (or an authorized table is playing it). Players must be linked through approved/checked-in registration records; ambiguous duplicate names are skipped. Case and surrounding whitespace are normalized for matching.

League fixtures and playoff matches enter when an authorized table is marked **playing**. Linked league players use `profileId`. Reserved tables are not live. A table owner must own the event, administer the matching club, or be an accepted tournament collaborator. Unrelated tables cannot impersonate another event.

Only public profiles with usernames and public live events are shown. Completion, table release for leagues, and event visibility changes refresh the projection. Profile privacy is checked by RLS on every read even before the next event update. Scores depend on organizer cloud sync. Watchboards refresh every 30 seconds while visible, deduplicate both opponents, and show up to 100 matches.

One inbox alert is created per follower/event/match; following both opponents and subsequent score updates do not duplicate it. Existing matches are backfilled before the fan-out trigger is installed. Following a player does not send historical match alerts.

Phone delivery uses the existing opt-in Web Push installation. Immediately before dispatch, the worker checks current follow/mute status, profile visibility, event visibility, match completion, the global preference, inbox read state, and expiry. Player names, opponents and event details remain off lock screens. Push acceptance cannot guarantee OS display or replace a closed-app test on the actual phone.

## Backend and checks

Applied migrations (canonical remote timestamps):

- `20260830233154_add_player_following_live_watchboards_and_club_guides.sql`
- `20260830233903_validate_live_watchboard_table_authority.sql`

`push-notifications` Edge Function v2 supports the new alert type. It retains user-token validation and Vault-backed dispatch authentication; no signing keys or service credentials are shipped to the browser.

- 90 Node regression tests; lint, TypeScript and a CI-environment production build. Deployed-browser checks cover club navigation, the public watchboard and club guide; sticky tabs stay below the main app header.
- `supabase/tests/player-following.sql` verifies real PostgreSQL RLS/grants, default opt-out, ownership, club-guide permissions, deduplication, privacy/muting/completion, tournament and league lifecycle, and unrelated-table spoof prevention. It creates isolated fixtures inside one transaction and rolls them back. No real club records are edited.
- One explicitly marked automatic delivery check was sent only to the verified opted-in account. Queue status was `sent` on attempt 1. No real match was started to test push.
- Security advisor: no new security warnings. Existing leaked-password-protection warning remains; enabling it is a separate auth configuration decision: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Useful next club additions

Consider a practice-partner board, upcoming-event RSVP/reminders, and a member achievement wall. Each needs its own moderation/privacy decisions; none is silently enabled in this release.
