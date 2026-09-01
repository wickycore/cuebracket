# CueBracket Phase 4J — Club Honours

Phase 4J gives every club an organised achievement wall without adding another top-level club tab.

## Added

- A **Club Honours** wall at the top of Rankings for competitive and community recognition.
- Fixed categories for champions, podiums, milestones, sportsmanship, contribution and custom honours.
- Organizer controls to award a current member, add context and a date, feature the recognition on Home, unfeature it or remove it.
- Filters for all, featured, competition and community honours.
- A Home member spotlight sourced from featured or recent recognition.
- Achievement counts on member cards and honours in the unified club activity feed.
- Realtime refresh when another organizer changes the wall.

## Privacy and moderation

- Only club owners and admins can create, change or remove recognition.
- The database verifies the recipient is a current club member when recognition is created or edited.
- Public-club honours follow the existing public roster model. Private-club honours require current membership.
- Recognition stores the member account ID instead of duplicating profile names; profile privacy still controls which identity details can be shown.
- Club and recipient identity cannot be reassigned after creation.

## Database migration

- `20260901083517_add_club_achievement_wall.sql`
- `20260901083916_align_club_achievement_account_deletion.sql`

The table has RLS, explicit narrow grants, feed and recipient indexes, and Realtime publication membership.
