# CueBracket Phase 4I — Club Activity & Community Planning

Phase 4I makes each club page feel active between tournament days while keeping the six-section navigation unchanged.

## Added

- A unified Home activity feed for announcements, tournaments, leagues, club calendar items and practice challenges.
- A club calendar inside Events for practices, meetings, socials and other organizer-created plans.
- Member RSVPs with Going/Maybe responses, live totals, optional capacity and organizer cancellation/restoration.
- A members-only Challenges & Practice Board inside Clubhouse.
- Challenge matching, reopening and closing with creator, participant and organizer controls.
- Participant names resolved from the existing club roster without duplicating identity data.

## Security and data integrity

- All three new tables use row-level security and narrow column grants.
- Public clubs expose public plans and aggregate RSVP counts; private clubs require membership.
- Only approved club members can RSVP or participate in practice challenges.
- Only club owners/admins can create or change calendar events.
- RSVP capacity checks lock the event row to prevent concurrent overbooking.
- Challenge acceptance locks each challenge and prevents accepting your own post.
- RSVP totals are trigger-maintained and cannot be supplied by browser clients.

## Database migrations

- `20260831221136_add_club_calendar_and_practice_board.sql`
- `20260831222421_allow_server_rsvp_count_updates.sql`
- `20260831222915_align_club_feed_indexes.sql`

## Verification

- Automated tests cover validation, activity ordering and migration security guarantees.
- A rolled-back remote database fixture verified calendar creation, member RSVP count projection, challenge creation and challenge acceptance.
- ESLint and the Next.js production build pass.
