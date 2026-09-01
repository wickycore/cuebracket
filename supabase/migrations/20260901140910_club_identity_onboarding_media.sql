-- Phase 4M: club identity, guide-gated membership, public follower counts and media uploads.

alter table public.club_guides
  add column if not exists revision integer not null default 1
    check (revision > 0);

alter table public.club_membership_requests
  add column if not exists accepted_guide_revision integer,
  add column if not exists guide_accepted_at timestamptz;

alter table public.cloud_tournaments
  add column if not exists poster_url text,
  drop constraint if exists cloud_tournaments_poster_url_length_check,
  add constraint cloud_tournaments_poster_url_length_check
    check (poster_url is null or char_length(poster_url) <= 2048);

alter table public.club_achievements
  add column if not exists image_url text,
  drop constraint if exists club_achievements_image_url_length_check,
  add constraint club_achievements_image_url_length_check
    check (image_url is null or char_length(image_url) <= 2048);

alter table public.clubs
  drop constraint if exists clubs_logo_url_length_check,
  add constraint clubs_logo_url_length_check
    check (logo_url is null or char_length(logo_url) <= 2048);

alter table public.profiles
  drop constraint if exists profiles_avatar_url_length_check,
  add constraint profiles_avatar_url_length_check
    check (avatar_url is null or char_length(avatar_url) <= 2048);

create or replace function private.stamp_club_guide()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function private.stamp_club_guide() from public, anon, authenticated;

create or replace function private.prepare_club_membership_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_guide_revision integer;
  club_location text;
  guide_rules text;
begin
  new.request_name := btrim(new.request_name);
  new.updated_at := now();

  if tg_op = 'UPDATE' and (
    new.club_id is distinct from old.club_id
    or new.user_id is distinct from old.user_id
    or new.accepted_guide_revision is distinct from old.accepted_guide_revision
    or new.guide_accepted_at is distinct from old.guide_accepted_at
  ) then
    raise exception 'Membership request identity and guide acceptance cannot be reassigned.';
  end if;

  if tg_op = 'INSERT' or (
    tg_op = 'UPDATE'
    and new.status = 'approved'
    and old.status is distinct from 'approved'
  ) then
    select guide.revision, guide.rules, club.location
      into current_guide_revision, guide_rules, club_location
    from public.clubs as club
    left join public.club_guides as guide on guide.club_id = club.id
    where club.id = new.club_id;

    if current_guide_revision is null
      or nullif(btrim(coalesce(guide_rules, '')), '') is null
      or nullif(btrim(coalesce(club_location, '')), '') is null then
      raise exception 'This club must publish its location and membership guide before accepting members.';
    end if;

    if new.accepted_guide_revision is distinct from current_guide_revision then
      raise exception 'Read and accept the latest club guide before requesting membership.';
    end if;

    if tg_op = 'INSERT' then
      new.guide_accepted_at := now();
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.prepare_club_membership_request() from public, anon, authenticated;

create table if not exists public.player_follower_counts (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  follower_count integer not null default 0 check (follower_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.player_follower_counts enable row level security;

drop policy if exists "Public player follower counts are readable" on public.player_follower_counts;
create policy "Public player follower counts are readable"
  on public.player_follower_counts
  for select to anon, authenticated
  using (
    player_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles as profile
      where profile.id = player_follower_counts.player_id
        and profile.is_public
        and profile.username is not null
    )
  );

revoke all on table public.player_follower_counts from public, anon, authenticated;
grant select on table public.player_follower_counts to anon, authenticated;
grant all on table public.player_follower_counts to service_role;

create or replace function private.refresh_player_follower_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_player uuid;
begin
  target_player := case when tg_op = 'DELETE' then old.player_id else new.player_id end;

  -- Profile deletion cascades through player_followers. Avoid recreating a
  -- projection row for a profile that is disappearing in the same statement.
  if not exists (select 1 from public.profiles where id = target_player) then
    delete from public.player_follower_counts where player_id = target_player;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  insert into public.player_follower_counts (player_id, follower_count, updated_at)
  values (
    target_player,
    (select count(*)::integer from public.player_followers where player_id = target_player),
    now()
  )
  on conflict (player_id) do update
    set follower_count = excluded.follower_count,
        updated_at = excluded.updated_at;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.refresh_player_follower_count() from public, anon, authenticated;

drop trigger if exists refresh_player_follower_count on public.player_followers;
create trigger refresh_player_follower_count
  after insert or delete on public.player_followers
  for each row execute function private.refresh_player_follower_count();

insert into public.player_follower_counts (player_id, follower_count, updated_at)
select profile.id, count(follower.user_id)::integer, now()
from public.profiles as profile
left join public.player_followers as follower on follower.player_id = profile.id
group by profile.id
on conflict (player_id) do update
  set follower_count = excluded.follower_count,
      updated_at = excluded.updated_at;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cuebracket-media',
  'cuebracket-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_manage_cuebracket_media(object_name text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  folders text[];
begin
  folders := storage.foldername(object_name);

  if (select auth.uid()) is null then
    return false;
  end if;

  if folders[1] = 'profiles' then
    return folders[2] = (select auth.uid())::text;
  end if;

  if folders[1] = 'tournaments' then
    return folders[2] = (select auth.uid())::text;
  end if;

  if folders[1] = 'clubs'
    and folders[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return private.is_club_admin(folders[2]::uuid);
  end if;

  return false;
end;
$$;
revoke all on function private.can_manage_cuebracket_media(text) from public, anon;
grant execute on function private.can_manage_cuebracket_media(text) to authenticated;

drop policy if exists "CueBracket media owners can inspect files" on storage.objects;
create policy "CueBracket media owners can inspect files"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cuebracket-media'
    and private.can_manage_cuebracket_media(name)
  );

drop policy if exists "CueBracket media owners can upload files" on storage.objects;
create policy "CueBracket media owners can upload files"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cuebracket-media'
    and private.can_manage_cuebracket_media(name)
  );

drop policy if exists "CueBracket media owners can replace files" on storage.objects;
create policy "CueBracket media owners can replace files"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cuebracket-media'
    and private.can_manage_cuebracket_media(name)
  )
  with check (
    bucket_id = 'cuebracket-media'
    and private.can_manage_cuebracket_media(name)
  );

drop policy if exists "CueBracket media owners can remove files" on storage.objects;
create policy "CueBracket media owners can remove files"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cuebracket-media'
    and private.can_manage_cuebracket_media(name)
  );

grant insert (image_url), update (image_url)
  on table public.club_achievements to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_follower_counts'
  ) then
    alter publication supabase_realtime add table public.player_follower_counts;
  end if;
end;
$$;
