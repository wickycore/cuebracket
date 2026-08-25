create table if not exists public.event_registration_settings (
  tournament_id text primary key references public.cloud_tournaments(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  venue text not null default '',
  format text not null,
  race_to integer not null check (race_to > 0),
  capacity integer not null check (capacity between 2 and 128),
  scheduled_at timestamptz,
  entry_fee text not null default '',
  notes text not null default '',
  registration_open boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registration_settings_name_length_check
    check (char_length(btrim(event_name)) between 2 and 100),
  constraint event_registration_settings_entry_fee_length_check
    check (char_length(entry_fee) <= 60),
  constraint event_registration_settings_notes_length_check
    check (char_length(notes) <= 500)
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.event_registration_settings(tournament_id) on delete cascade,
  profile_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'waitlisted', 'checked_in', 'withdrawn', 'rejected')),
  source text not null default 'self'
    check (source in ('self', 'organizer')),
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registrations_name_length_check
    check (char_length(btrim(display_name)) between 2 and 40)
);

create index if not exists event_registration_settings_owner_id_idx
  on public.event_registration_settings (owner_id);
create index if not exists event_registrations_tournament_id_idx
  on public.event_registrations (tournament_id, created_at);
create index if not exists event_registrations_profile_id_idx
  on public.event_registrations (profile_id)
  where profile_id is not null;
create unique index if not exists event_registrations_active_name_unique_idx
  on public.event_registrations (tournament_id, lower(display_name))
  where status not in ('withdrawn', 'rejected');
create unique index if not exists event_registrations_active_profile_unique_idx
  on public.event_registrations (tournament_id, profile_id)
  where profile_id is not null and status not in ('withdrawn', 'rejected');

create or replace function private.prepare_event_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  event_capacity integer;
  confirmed_count integer;
begin
  new.display_name := btrim(new.display_name);
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.tournament_id is distinct from old.tournament_id
      or new.profile_id is distinct from old.profile_id
      or new.source is distinct from old.source then
      raise exception 'Registration identity cannot be reassigned.';
    end if;
  end if;

  if new.status = 'checked_in' then
    new.checked_in_at := coalesce(new.checked_in_at, now());
  else
    new.checked_in_at := null;
  end if;

  if new.status in ('approved', 'checked_in') then
    select settings.capacity
      into event_capacity
      from public.event_registration_settings as settings
      where settings.tournament_id = new.tournament_id
      for update;

    select count(*)
      into confirmed_count
      from public.event_registrations as registration
      where registration.tournament_id = new.tournament_id
        and registration.id is distinct from new.id
        and registration.status in ('approved', 'checked_in');

    if confirmed_count >= event_capacity then
      new.status := 'waitlisted';
      new.checked_in_at := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_event_registration() from public, anon, authenticated;

drop trigger if exists prepare_event_registration on public.event_registrations;
create trigger prepare_event_registration
  before insert or update on public.event_registrations
  for each row execute procedure private.prepare_event_registration();

alter table public.event_registration_settings enable row level security;
alter table public.event_registrations enable row level security;

create policy "Registration details are public"
  on public.event_registration_settings
  for select to anon, authenticated
  using (true);

create policy "Tournament owners create registration settings"
  on public.event_registration_settings
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  );

create policy "Tournament owners update registration settings"
  on public.event_registration_settings
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  );

create policy "Tournament owners delete registration settings"
  on public.event_registration_settings
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Confirmed registrations are public"
  on public.event_registrations
  for select to anon, authenticated
  using (
    status in ('approved', 'waitlisted', 'checked_in')
    or profile_id = (select auth.uid())
    or exists (
      select 1
      from public.event_registration_settings as settings
      where settings.tournament_id = event_registrations.tournament_id
        and settings.owner_id = (select auth.uid())
    )
  );

create policy "Players submit pending registrations"
  on public.event_registrations
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and source = 'self'
    and (profile_id is null or profile_id = (select auth.uid()))
    and exists (
      select 1
      from public.event_registration_settings as settings
      where settings.tournament_id = event_registrations.tournament_id
        and settings.registration_open
    )
  );

create policy "Players withdraw their registrations"
  on public.event_registrations
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and status = 'withdrawn'
    and source = 'self'
  );

create policy "Tournament owners manage registrations"
  on public.event_registrations
  for update to authenticated
  using (
    exists (
      select 1
      from public.event_registration_settings as settings
      where settings.tournament_id = event_registrations.tournament_id
        and settings.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.event_registration_settings as settings
      where settings.tournament_id = event_registrations.tournament_id
        and settings.owner_id = (select auth.uid())
    )
  );

create policy "Tournament owners delete registrations"
  on public.event_registrations
  for delete to authenticated
  using (
    exists (
      select 1
      from public.event_registration_settings as settings
      where settings.tournament_id = event_registrations.tournament_id
        and settings.owner_id = (select auth.uid())
    )
  );

revoke all on table public.event_registration_settings from anon, authenticated;
revoke all on table public.event_registrations from anon, authenticated;

grant select on table public.event_registration_settings to anon;
grant select, insert, update, delete on table public.event_registration_settings to authenticated;
grant select (id, tournament_id, display_name, status, created_at)
  on table public.event_registrations to anon;
grant insert (tournament_id, profile_id, display_name, status, source)
  on table public.event_registrations to anon;
grant select, insert, update, delete on table public.event_registrations to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_registrations'
  ) then
    alter publication supabase_realtime add table public.event_registrations;
  end if;
end;
$$;
