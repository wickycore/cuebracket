-- Weekly club schedules such as league nights and regular practice sessions.
alter table public.club_calendar_events
  add column series_id uuid,
  add column recurrence text not null default 'none'
    check (recurrence in ('none', 'weekly'));

create index club_calendar_events_series_idx
  on public.club_calendar_events (series_id, starts_at)
  where series_id is not null;

grant insert (series_id, recurrence) on table public.club_calendar_events to authenticated;
grant update (series_id, recurrence) on table public.club_calendar_events to authenticated;
