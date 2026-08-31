-- Phase 4I: club calendar RSVPs and a members-only practice board.

create or replace function private.is_club_member(target_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.club_members
      where club_id = target_club
        and user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_club_member(uuid) from public;
grant execute on function private.is_club_member(uuid) to anon, authenticated;

create or replace function private.can_read_club(target_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clubs
    where id = target_club
      and (
        is_public
        or owner_id = (select auth.uid())
        or exists (
          select 1
          from public.club_members
          where club_id = target_club
            and user_id = (select auth.uid())
        )
      )
  );
$$;
revoke all on function private.can_read_club(uuid) from public;
grant execute on function private.can_read_club(uuid) to anon, authenticated;

create table public.club_calendar_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  creator_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  kind text not null default 'practice'
    check (kind in ('tournament', 'practice', 'meeting', 'social', 'other')),
  description text not null default '' check (char_length(description) <= 1000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default '' check (char_length(location) <= 100),
  capacity smallint check (capacity between 2 and 500),
  is_cancelled boolean not null default false,
  going_count integer not null default 0 check (going_count >= 0),
  maybe_count integer not null default 0 check (maybe_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index club_calendar_events_upcoming_idx
  on public.club_calendar_events (club_id, starts_at)
  where not is_cancelled;
create index club_calendar_events_creator_idx
  on public.club_calendar_events (creator_id);

create or replace function private.prepare_club_calendar_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.description := btrim(new.description);
  new.location := regexp_replace(btrim(new.location), '\s+', ' ', 'g');
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.creator_id := (select auth.uid());
    new.going_count := 0;
    new.maybe_count := 0;
  elsif new.club_id is distinct from old.club_id
    or new.creator_id is distinct from old.creator_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Calendar event ownership cannot be reassigned.';
  end if;

  return new;
end;
$$;
revoke all on function private.prepare_club_calendar_event()
  from public, anon, authenticated;

create trigger prepare_club_calendar_event
  before insert or update on public.club_calendar_events
  for each row execute function private.prepare_club_calendar_event();

alter table public.club_calendar_events enable row level security;

create policy "Readable club calendar events"
  on public.club_calendar_events
  for select to anon, authenticated
  using ((select private.can_read_club(club_id)));

create policy "Club admins create calendar events"
  on public.club_calendar_events
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and (select private.is_club_admin(club_id))
  );

create policy "Club admins update calendar events"
  on public.club_calendar_events
  for update to authenticated
  using ((select private.is_club_admin(club_id)))
  with check ((select private.is_club_admin(club_id)));

create policy "Club admins remove calendar events"
  on public.club_calendar_events
  for delete to authenticated
  using ((select private.is_club_admin(club_id)));

revoke all on table public.club_calendar_events from anon, authenticated;
grant select on table public.club_calendar_events to anon, authenticated;
grant insert (club_id, title, kind, description, starts_at, ends_at, location, capacity)
  on table public.club_calendar_events to authenticated;
grant update (title, kind, description, starts_at, ends_at, location, capacity, is_cancelled)
  on table public.club_calendar_events to authenticated;
grant delete on table public.club_calendar_events to authenticated;
grant all on table public.club_calendar_events to service_role;

create table public.club_calendar_rsvps (
  event_id uuid not null references public.club_calendar_events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  response text not null check (response in ('going', 'maybe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index club_calendar_rsvps_user_idx
  on public.club_calendar_rsvps (user_id, updated_at desc);

create or replace function private.prepare_club_calendar_rsvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_club uuid;
  target_capacity smallint;
  target_cancelled boolean;
  target_starts_at timestamptz;
  current_going integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to RSVP.';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := (select auth.uid());
  elsif new.event_id is distinct from old.event_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'RSVP ownership cannot be reassigned.';
  end if;

  select club_id, capacity, is_cancelled, starts_at
    into target_club, target_capacity, target_cancelled, target_starts_at
  from public.club_calendar_events
  where id = new.event_id
  for update;

  if target_club is null then
    raise exception 'Calendar event not found.';
  end if;
  if not private.is_club_member(target_club) then
    raise exception 'Join this club before responding.';
  end if;
  if target_cancelled then
    raise exception 'This event has been cancelled.';
  end if;
  if target_starts_at <= now() then
    raise exception 'RSVPs close when the event starts.';
  end if;

  if new.response = 'going' and target_capacity is not null then
    select count(*)
      into current_going
    from public.club_calendar_rsvps
    where event_id = new.event_id
      and response = 'going'
      and user_id is distinct from new.user_id;
    if current_going >= target_capacity then
      raise exception 'This event is full. Choose Maybe or ask the organizer.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.prepare_club_calendar_rsvp()
  from public, anon, authenticated;

create trigger prepare_club_calendar_rsvp
  before insert or update on public.club_calendar_rsvps
  for each row execute function private.prepare_club_calendar_rsvp();

create or replace function private.refresh_club_calendar_rsvp_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event uuid := coalesce(new.event_id, old.event_id);
begin
  update public.club_calendar_events
  set going_count = (
        select count(*) from public.club_calendar_rsvps
        where event_id = target_event and response = 'going'
      ),
      maybe_count = (
        select count(*) from public.club_calendar_rsvps
        where event_id = target_event and response = 'maybe'
      )
  where id = target_event;
  return null;
end;
$$;
revoke all on function private.refresh_club_calendar_rsvp_counts()
  from public, anon, authenticated;

create trigger refresh_club_calendar_rsvp_counts
  after insert or update or delete on public.club_calendar_rsvps
  for each row execute function private.refresh_club_calendar_rsvp_counts();

alter table public.club_calendar_rsvps enable row level security;

create policy "Members read own calendar responses"
  on public.club_calendar_rsvps
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.club_calendar_events
      where id = club_calendar_rsvps.event_id
        and (select private.is_club_admin(club_id))
    )
  );

create policy "Members create calendar responses"
  on public.club_calendar_rsvps
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.club_calendar_events
      where id = club_calendar_rsvps.event_id
        and (select private.is_club_member(club_id))
    )
  );

create policy "Members change calendar responses"
  on public.club_calendar_rsvps
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Members remove calendar responses"
  on public.club_calendar_rsvps
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.club_calendar_rsvps from anon, authenticated;
grant select, delete on table public.club_calendar_rsvps to authenticated;
grant insert (event_id, user_id, response), update (response)
  on table public.club_calendar_rsvps to authenticated;
grant all on table public.club_calendar_rsvps to service_role;

create table public.club_challenges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  creator_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  message text not null default '' check (char_length(message) <= 500),
  game_type text not null default 'any'
    check (game_type in ('8-ball', '9-ball', '10-ball', 'snooker', 'blackball', 'any')),
  skill_level text not null default 'any'
    check (skill_level in ('beginner', 'intermediate', 'advanced', 'any')),
  race_to smallint check (race_to between 1 and 50),
  preferred_at timestamptz,
  venue text not null default '' check (char_length(venue) <= 100),
  expires_at timestamptz not null default (now() + interval '14 days'),
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accepted_by is null or accepted_by <> creator_id),
  check ((status = 'matched' and accepted_by is not null) or status <> 'matched')
);

create index club_challenges_open_idx
  on public.club_challenges (club_id, expires_at, created_at desc)
  where status = 'open';
create index club_challenges_creator_idx on public.club_challenges (creator_id);
create index club_challenges_accepted_by_idx
  on public.club_challenges (accepted_by)
  where accepted_by is not null;

create or replace function private.prepare_club_challenge()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.message := btrim(new.message);
  new.venue := regexp_replace(btrim(new.venue), '\s+', ' ', 'g');
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.creator_id := (select auth.uid());
    new.accepted_by := null;
    new.status := 'open';
    if new.expires_at <= now() or new.expires_at > now() + interval '30 days' then
      raise exception 'Challenge expiry must be within the next 30 days.';
    end if;
  elsif new.club_id is distinct from old.club_id
    or new.creator_id is distinct from old.creator_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Challenge ownership cannot be reassigned.';
  end if;

  return new;
end;
$$;
revoke all on function private.prepare_club_challenge()
  from public, anon, authenticated;

create trigger prepare_club_challenge
  before insert or update on public.club_challenges
  for each row execute function private.prepare_club_challenge();

alter table public.club_challenges enable row level security;

create policy "Readable club challenges"
  on public.club_challenges
  for select to anon, authenticated
  using ((select private.can_read_club(club_id)));

create policy "Members create club challenges"
  on public.club_challenges
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and (select private.is_club_member(club_id))
  );

create policy "Creators and admins remove club challenges"
  on public.club_challenges
  for delete to authenticated
  using (
    creator_id = (select auth.uid())
    or (select private.is_club_admin(club_id))
  );

revoke all on table public.club_challenges from anon, authenticated;
grant select on table public.club_challenges to anon, authenticated;
grant insert (club_id, title, message, game_type, skill_level, race_to, preferred_at, venue, expires_at)
  on table public.club_challenges to authenticated;
grant delete on table public.club_challenges to authenticated;
grant all on table public.club_challenges to service_role;

create or replace function private.respond_to_club_challenge(
  target_challenge uuid,
  requested_action text
)
returns public.club_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  challenge public.club_challenges%rowtype;
begin
  if actor is null then
    raise exception 'Sign in to respond to challenges.';
  end if;

  select * into challenge
  from public.club_challenges
  where id = target_challenge
  for update;

  if challenge.id is null then
    raise exception 'Challenge not found.';
  end if;
  if not private.is_club_member(challenge.club_id) then
    raise exception 'Join this club before responding.';
  end if;

  case requested_action
    when 'accept' then
      if challenge.status <> 'open' or challenge.expires_at <= now() then
        raise exception 'This challenge is no longer open.';
      end if;
      if challenge.creator_id = actor then
        raise exception 'You cannot accept your own challenge.';
      end if;
      update public.club_challenges
      set accepted_by = actor, status = 'matched'
      where id = target_challenge
      returning * into challenge;
    when 'reopen' then
      if challenge.status <> 'matched'
        or not (
          challenge.creator_id = actor
          or challenge.accepted_by = actor
          or private.is_club_admin(challenge.club_id)
        ) then
        raise exception 'Only the matched players or a club admin can reopen this challenge.';
      end if;
      update public.club_challenges
      set accepted_by = null, status = 'open'
      where id = target_challenge
      returning * into challenge;
    when 'close' then
      if challenge.creator_id <> actor and not private.is_club_admin(challenge.club_id) then
        raise exception 'Only the creator or a club admin can close this challenge.';
      end if;
      update public.club_challenges
      set status = 'closed'
      where id = target_challenge
      returning * into challenge;
    when 'open' then
      if challenge.status <> 'closed'
        or challenge.expires_at <= now()
        or (challenge.creator_id <> actor and not private.is_club_admin(challenge.club_id)) then
        raise exception 'This challenge cannot be reopened.';
      end if;
      update public.club_challenges
      set accepted_by = null, status = 'open'
      where id = target_challenge
      returning * into challenge;
    else
      raise exception 'Choose accept, reopen, close or open.';
  end case;

  return challenge;
end;
$$;
revoke all on function private.respond_to_club_challenge(uuid, text)
  from public, anon, authenticated;
grant execute on function private.respond_to_club_challenge(uuid, text)
  to authenticated;

create or replace function public.respond_to_club_challenge(
  target_challenge uuid,
  requested_action text
)
returns public.club_challenges
language sql
security invoker
set search_path = ''
as $$
  select private.respond_to_club_challenge(target_challenge, requested_action);
$$;
revoke all on function public.respond_to_club_challenge(uuid, text)
  from public, anon, authenticated;
grant execute on function public.respond_to_club_challenge(uuid, text)
  to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_calendar_events'
  ) then
    alter publication supabase_realtime add table public.club_calendar_events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_challenges'
  ) then
    alter publication supabase_realtime add table public.club_challenges;
  end if;
end;
$$;
