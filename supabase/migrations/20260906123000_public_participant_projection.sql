-- Replace the intentionally public SECURITY DEFINER lookup with an RLS-protected
-- projection. The projection contains only fields that already belong to a
-- public profile and is maintained by private, non-callable trigger functions.

drop function if exists public.get_public_tournament_participants(text);

create table if not exists public.public_tournament_participants (
  tournament_id text not null references public.cloud_tournaments(id) on delete cascade,
  display_name text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  username text,
  avatar_url text,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);

create index if not exists public_tournament_participants_profile_idx
  on public.public_tournament_participants (profile_id, tournament_id);

alter table public.public_tournament_participants enable row level security;

create policy "Public tournament participant profiles are readable"
  on public.public_tournament_participants
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.cloud_tournaments as tournament
      where tournament.id = public_tournament_participants.tournament_id
        and tournament.is_public
    )
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = public_tournament_participants.profile_id
        and profile.is_public
    )
  );

revoke all on table public.public_tournament_participants
  from public, anon, authenticated;
grant select on table public.public_tournament_participants
  to anon, authenticated;
grant all on table public.public_tournament_participants
  to service_role;

create or replace function private.refresh_public_tournament_participants(
  target_tournament_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.public_tournament_participants
  where tournament_id = target_tournament_id;

  insert into public.public_tournament_participants (
    tournament_id,
    display_name,
    profile_id,
    username,
    avatar_url,
    updated_at
  )
  select
    registration.tournament_id,
    registration.display_name,
    profile.id,
    profile.username,
    profile.avatar_url,
    now()
  from public.event_registrations as registration
  join public.profiles as profile
    on profile.id = registration.profile_id
  where registration.tournament_id = target_tournament_id
    and registration.status in ('approved', 'checked_in')
    and profile.is_public
  on conflict (tournament_id, profile_id) do update
    set display_name = excluded.display_name,
        username = excluded.username,
        avatar_url = excluded.avatar_url,
        updated_at = excluded.updated_at;
end;
$$;
revoke all on function private.refresh_public_tournament_participants(text)
  from public, anon, authenticated;

create or replace function private.sync_public_tournament_participants_from_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_public_tournament_participants(
    case when tg_op = 'DELETE' then old.tournament_id else new.tournament_id end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.sync_public_tournament_participants_from_registration()
  from public, anon, authenticated;

drop trigger if exists sync_public_tournament_participants_from_registration
  on public.event_registrations;
create trigger sync_public_tournament_participants_from_registration
  after insert or update or delete on public.event_registrations
  for each row execute function private.sync_public_tournament_participants_from_registration();

create or replace function private.sync_public_tournament_participants_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tournament_id text;
begin
  for target_tournament_id in
    select distinct registration.tournament_id
    from public.event_registrations as registration
    where registration.profile_id = new.id
    union
    select distinct participant.tournament_id
    from public.public_tournament_participants as participant
    where participant.profile_id = new.id
  loop
    perform private.refresh_public_tournament_participants(target_tournament_id);
  end loop;
  return new;
end;
$$;
revoke all on function private.sync_public_tournament_participants_from_profile()
  from public, anon, authenticated;

drop trigger if exists sync_public_tournament_participants_from_profile
  on public.profiles;
create trigger sync_public_tournament_participants_from_profile
  after update of display_name, tournament_name, username, avatar_url, is_public
  on public.profiles
  for each row execute function private.sync_public_tournament_participants_from_profile();

insert into public.public_tournament_participants (
  tournament_id,
  display_name,
  profile_id,
  username,
  avatar_url,
  updated_at
)
select
  registration.tournament_id,
  registration.display_name,
  profile.id,
  profile.username,
  profile.avatar_url,
  now()
from public.event_registrations as registration
join public.profiles as profile
  on profile.id = registration.profile_id
where registration.status in ('approved', 'checked_in')
  and profile.is_public
on conflict (tournament_id, profile_id) do update
  set display_name = excluded.display_name,
      username = excluded.username,
      avatar_url = excluded.avatar_url,
      updated_at = excluded.updated_at;
