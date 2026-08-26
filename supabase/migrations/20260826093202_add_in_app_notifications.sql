create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null
    check (type in ('club_event', 'registration_status', 'membership_status', 'match_live')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  message text not null default '' check (char_length(message) <= 500),
  href text not null default '/notifications'
    check (char_length(href) between 1 and 300 and href like '/%'),
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create unique index if not exists notifications_user_dedupe_unique_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  club_events boolean not null default true,
  registration_updates boolean not null default true,
  match_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.match_activity (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.cloud_tournaments(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  match_key text not null check (char_length(btrim(match_key)) between 1 and 200),
  player1 text not null check (char_length(btrim(player1)) between 1 and 100),
  player2 text not null check (char_length(btrim(player2)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (tournament_id, match_key)
);

create index if not exists match_activity_owner_id_idx
  on public.match_activity (owner_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.match_activity enable row level security;

create policy "Users read their notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users mark their notifications" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete their notifications" on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Users read notification preferences" on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users create notification preferences" on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users update notification preferences" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Organizers record match starts" on public.match_activity
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and (
          tournament.owner_id = (select auth.uid())
          or (tournament.club_id is not null and private.is_club_admin(tournament.club_id))
        )
    )
  );
create policy "Organizers read recorded match starts" on public.match_activity
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1
      from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.club_id is not null
        and private.is_club_admin(tournament.club_id)
    )
  );

create or replace function private.prepare_notification_preference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Notification preferences cannot be reassigned.';
  end if;
  return new;
end;
$$;
revoke all on function private.prepare_notification_preference() from public, anon, authenticated;

create trigger prepare_notification_preference
  before insert or update on public.notification_preferences
  for each row execute procedure private.prepare_notification_preference();

create or replace function private.notify_club_event_opened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.club_id is null or not new.registration_open then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.registration_open then
    return new;
  end if;

  insert into public.notifications (
    user_id, type, title, message, href, metadata, dedupe_key
  )
  select
    audience.user_id,
    'club_event',
    'Registration open: ' || new.event_name,
    'A club you follow has opened tournament registration. Tap to view the details and reserve a place.',
    '/register/' || new.tournament_id,
    jsonb_build_object('club_id', new.club_id, 'tournament_id', new.tournament_id),
    'club-event-open:' || new.tournament_id
  from (
    select follower.user_id
    from public.club_followers as follower
    where follower.club_id = new.club_id
    union
    select member.user_id
    from public.club_members as member
    where member.club_id = new.club_id
  ) as audience
  left join public.notification_preferences as preference
    on preference.user_id = audience.user_id
  where coalesce(preference.club_events, true)
  on conflict (user_id, dedupe_key) where dedupe_key is not null
  do update set
    title = excluded.title,
    message = excluded.message,
    href = excluded.href,
    metadata = excluded.metadata,
    read_at = null,
    created_at = now();

  return new;
end;
$$;
revoke all on function private.notify_club_event_opened() from public, anon, authenticated;

create trigger notify_club_event_opened
  after insert or update of registration_open on public.event_registration_settings
  for each row execute procedure private.notify_club_event_opened();

create or replace function private.notify_registration_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_title text;
  notification_message text;
begin
  if new.profile_id is null or new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('approved', 'waitlisted', 'checked_in', 'rejected') then
    return new;
  end if;
  if exists (
    select 1 from public.notification_preferences
    where user_id = new.profile_id and not registration_updates
  ) then
    return new;
  end if;

  notification_title := case new.status
    when 'approved' then 'Your tournament place is confirmed'
    when 'waitlisted' then 'You are on the tournament waitlist'
    when 'checked_in' then 'You are checked in and ready'
    else 'Tournament registration update'
  end;
  notification_message := case new.status
    when 'approved' then new.display_name || ', the organizer approved your tournament registration.'
    when 'waitlisted' then new.display_name || ', your entry is on the waitlist. You will be updated if a place opens.'
    when 'checked_in' then new.display_name || ', you are checked in and ready for the draw.'
    else new.display_name || ', the organizer could not accept this registration.'
  end;

  insert into public.notifications (
    user_id, type, title, message, href, metadata, dedupe_key
  ) values (
    new.profile_id,
    'registration_status',
    notification_title,
    notification_message,
    '/register/' || new.tournament_id,
    jsonb_build_object('tournament_id', new.tournament_id, 'registration_id', new.id, 'status', new.status),
    'registration-status:' || new.id || ':' || new.status
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;
revoke all on function private.notify_registration_status() from public, anon, authenticated;

create trigger notify_registration_status
  after update of status on public.event_registrations
  for each row execute procedure private.notify_registration_status();

create or replace function private.notify_membership_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_name text;
  club_slug text;
begin
  if new.status is not distinct from old.status or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  select name, slug into club_name, club_slug
  from public.clubs where id = new.club_id;

  insert into public.notifications (
    user_id, type, title, message, href, metadata, dedupe_key
  ) values (
    new.user_id,
    'membership_status',
    case new.status when 'approved' then 'Welcome to ' || club_name else club_name || ' membership update' end,
    case new.status when 'approved' then 'Your club membership request was approved.' else 'The club organizer could not approve your membership request.' end,
    '/clubs/' || club_slug,
    jsonb_build_object('club_id', new.club_id, 'request_id', new.id, 'status', new.status),
    'membership-status:' || new.id || ':' || new.status
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;
revoke all on function private.notify_membership_status() from public, anon, authenticated;

create trigger notify_membership_status
  after update of status on public.club_membership_requests
  for each row execute procedure private.notify_membership_status();

create or replace function private.notify_match_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  public_match boolean;
begin
  select is_public into public_match
  from public.cloud_tournaments where id = new.tournament_id;

  insert into public.notifications (
    user_id, type, title, message, href, metadata, dedupe_key
  )
  select distinct
    registration.profile_id,
    'match_live',
    'Your match is live',
    new.player1 || ' vs ' || new.player2 || ' has started.',
    case when public_match then '/cloud/live/' || new.tournament_id else '/register/' || new.tournament_id end,
    jsonb_build_object('tournament_id', new.tournament_id, 'match_key', new.match_key),
    'match-live:' || new.tournament_id || ':' || new.match_key
  from public.event_registrations as registration
  left join public.notification_preferences as preference
    on preference.user_id = registration.profile_id
  where registration.tournament_id = new.tournament_id
    and registration.profile_id is not null
    and registration.status in ('approved', 'checked_in')
    and lower(btrim(registration.display_name)) in (lower(btrim(new.player1)), lower(btrim(new.player2)))
    and coalesce(preference.match_alerts, true)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;
revoke all on function private.notify_match_participants() from public, anon, authenticated;

create trigger notify_match_participants
  after insert on public.match_activity
  for each row execute procedure private.notify_match_participants();

revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.match_activity from anon, authenticated;

grant select, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
grant select, insert on table public.match_activity to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
