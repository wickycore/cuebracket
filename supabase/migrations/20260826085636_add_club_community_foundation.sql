alter table public.clubs
  drop constraint if exists clubs_name_length_check,
  add constraint clubs_name_length_check
    check (char_length(btrim(name)) between 2 and 80),
  drop constraint if exists clubs_slug_format_check,
  add constraint clubs_slug_format_check
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$'),
  drop constraint if exists clubs_description_length_check,
  add constraint clubs_description_length_check
    check (char_length(description) <= 500),
  drop constraint if exists clubs_location_length_check,
  add constraint clubs_location_length_check
    check (char_length(location) <= 100);

alter table public.event_registration_settings
  add column if not exists club_id uuid references public.clubs(id) on delete set null;

create index if not exists event_registration_settings_club_id_idx
  on public.event_registration_settings (club_id)
  where club_id is not null;

create table if not exists public.club_followers (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists club_followers_user_id_idx
  on public.club_followers (user_id);

create table if not exists public.club_membership_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_name text not null
    check (char_length(btrim(request_name)) between 2 and 50),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists club_membership_requests_pending_unique_idx
  on public.club_membership_requests (club_id, user_id)
  where status = 'pending';
create index if not exists club_membership_requests_club_status_idx
  on public.club_membership_requests (club_id, status, created_at);
create index if not exists club_membership_requests_user_id_idx
  on public.club_membership_requests (user_id, created_at desc);

create or replace function private.prepare_club_membership_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.request_name := btrim(new.request_name);
  new.updated_at := now();
  if tg_op = 'UPDATE' and (
    new.club_id is distinct from old.club_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Membership request identity cannot be reassigned.';
  end if;
  return new;
end;
$$;
revoke all on function private.prepare_club_membership_request() from public, anon, authenticated;

drop trigger if exists prepare_club_membership_request on public.club_membership_requests;
create trigger prepare_club_membership_request
  before insert or update on public.club_membership_requests
  for each row execute procedure private.prepare_club_membership_request();

create or replace function private.apply_approved_club_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and (
    tg_op = 'INSERT' or old.status is distinct from 'approved'
  ) then
    insert into public.club_members (club_id, user_id, role)
    values (new.club_id, new.user_id, 'member')
    on conflict (club_id, user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.apply_approved_club_membership() from public, anon, authenticated;

drop trigger if exists apply_approved_club_membership on public.club_membership_requests;
create trigger apply_approved_club_membership
  after insert or update on public.club_membership_requests
  for each row execute procedure private.apply_approved_club_membership();

create or replace function private.add_club_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.club_members (club_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (club_id, user_id) do update set role = 'owner';
  return new;
end;
$$;
revoke all on function private.add_club_owner_membership() from public, anon, authenticated;

drop trigger if exists add_club_owner_membership on public.clubs;
create trigger add_club_owner_membership
  after insert on public.clubs
  for each row execute procedure private.add_club_owner_membership();

create or replace function private.protect_club_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  club_owner uuid;
begin
  if tg_op = 'DELETE' then
    select owner_id into club_owner from public.clubs where id = old.club_id;
    if old.user_id = club_owner or old.role = 'owner' then
      raise exception 'The club owner membership cannot be removed.';
    end if;
    return old;
  end if;

  select owner_id into club_owner from public.clubs where id = new.club_id;

  if new.role = 'owner' and new.user_id is distinct from club_owner then
    raise exception 'Only the club owner can hold the owner role.';
  end if;

  if tg_op = 'UPDATE'
    and (old.user_id = club_owner or old.role = 'owner')
    and (new.user_id is distinct from old.user_id or new.role is distinct from 'owner') then
    raise exception 'Transfer club ownership before changing the owner membership.';
  end if;

  return new;
end;
$$;
revoke all on function private.protect_club_owner_membership() from public, anon, authenticated;

drop trigger if exists protect_club_owner_membership on public.club_members;
create trigger protect_club_owner_membership
  before insert or update or delete on public.club_members
  for each row execute procedure private.protect_club_owner_membership();

alter table public.club_followers enable row level security;
alter table public.club_membership_requests enable row level security;

drop policy if exists "Members view own club memberships" on public.club_members;
create policy "Public club rosters are readable" on public.club_members
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or private.is_club_admin(club_id)
    or exists (
      select 1 from public.clubs
      where clubs.id = club_members.club_id
        and clubs.is_public
    )
  );

create policy "Club follower counts are public" on public.club_followers
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.clubs
      where clubs.id = club_followers.club_id
        and clubs.is_public
    )
    or user_id = (select auth.uid())
    or private.is_club_admin(club_id)
  );
create policy "Players follow clubs" on public.club_followers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.clubs
      where clubs.id = club_followers.club_id
        and clubs.is_public
    )
  );
create policy "Players unfollow clubs" on public.club_followers
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Players and club admins read membership requests"
  on public.club_membership_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_club_admin(club_id)
  );
create policy "Players request club membership"
  on public.club_membership_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and not exists (
      select 1 from public.club_members
      where club_members.club_id = club_membership_requests.club_id
        and club_members.user_id = (select auth.uid())
    )
  );
create policy "Players and club admins update membership requests"
  on public.club_membership_requests
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_club_admin(club_id)
  )
  with check (
    (
      user_id = (select auth.uid())
      and status = 'withdrawn'
    )
    or (
      private.is_club_admin(club_id)
      and status in ('approved', 'rejected', 'withdrawn')
    )
  );
create policy "Club admins delete membership requests"
  on public.club_membership_requests
  for delete to authenticated
  using (private.is_club_admin(club_id));

drop policy if exists "Tournament owners create registration settings"
  on public.event_registration_settings;
drop policy if exists "Tournament owners update registration settings"
  on public.event_registration_settings;
create policy "Tournament owners create registration settings"
  on public.event_registration_settings
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (club_id is null or private.is_club_admin(club_id))
    and exists (
      select 1 from public.cloud_tournaments as tournament
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
      select 1 from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and (club_id is null or private.is_club_admin(club_id))
    and exists (
      select 1 from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  );

revoke all on table public.club_followers from anon, authenticated;
revoke all on table public.club_membership_requests from anon, authenticated;
grant select on table public.club_members, public.club_followers to anon;
grant select, insert, delete on table public.club_followers to authenticated;
grant select, insert, update, delete on table public.club_membership_requests to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_membership_requests'
  ) then
    alter publication supabase_realtime add table public.club_membership_requests;
  end if;
end;
$$;
