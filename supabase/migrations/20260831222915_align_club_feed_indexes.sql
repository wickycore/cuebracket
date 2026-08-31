-- Align feed indexes with the mixed active/cancelled rows shown by the club UI.
drop index if exists public.club_calendar_events_upcoming_idx;
create index club_calendar_events_feed_idx
  on public.club_calendar_events (club_id, starts_at);

drop index if exists public.club_challenges_open_idx;
create index club_challenges_feed_idx
  on public.club_challenges (club_id, status, expires_at, updated_at desc);
