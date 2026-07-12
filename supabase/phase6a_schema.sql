-- CueBracket Phase 6A
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'CueBracket Organizer',
  avatar_url text,
  platform_role text not null default 'organizer'
    check (platform_role in ('organizer', 'platform_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text not null default '',
  logo_url text,
  location text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists public.cloud_tournaments (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  name text not null,
  venue text not null default '',
  format text not null check (format in ('single', 'double')),
  race_to integer not null default 5 check (race_to > 0),
  bracket_size integer not null check (bracket_size in (4, 8, 16, 32, 64, 128)),
  status text not null default 'draft'
    check (status in ('draft', 'live', 'completed')),
  players jsonb not null default '[]'::jsonb,
  bracket jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_leagues (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  name text not null,
  season text not null default 'Season 1',
  payload jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  display_name text not null,
  nickname text not null default '',
  wins integer not null default 0,
  losses integer not null default 0,
  frames_for integer not null default 0,
  frames_against integer not null default 0,
  rating integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_club_admin(target_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members
    where club_id = target_club
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.clubs
    where id = target_club
      and owner_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.cloud_tournaments enable row level security;
alter table public.cloud_leagues enable row level security;
alter table public.players enable row level security;

drop policy if exists "Profiles readable" on public.profiles;
create policy "Profiles readable"
on public.profiles for select
using (true);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Public clubs readable" on public.clubs;
create policy "Public clubs readable"
on public.clubs for select
using (is_public or owner_id = auth.uid() or public.is_club_admin(id));

drop policy if exists "Authenticated users create clubs" on public.clubs;
create policy "Authenticated users create clubs"
on public.clubs for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Club admins update clubs" on public.clubs;
create policy "Club admins update clubs"
on public.clubs for update
using (owner_id = auth.uid() or public.is_club_admin(id))
with check (owner_id = auth.uid() or public.is_club_admin(id));

drop policy if exists "Club owners delete clubs" on public.clubs;
create policy "Club owners delete clubs"
on public.clubs for delete
using (owner_id = auth.uid());

drop policy if exists "Members view own club memberships" on public.club_members;
create policy "Members view own club memberships"
on public.club_members for select
using (user_id = auth.uid() or public.is_club_admin(club_id));

drop policy if exists "Club admins manage members" on public.club_members;
create policy "Club admins manage members"
on public.club_members for all
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists "Public tournaments readable" on public.cloud_tournaments;
create policy "Public tournaments readable"
on public.cloud_tournaments for select
using (
  is_public
  or owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
);

drop policy if exists "Owners create tournaments" on public.cloud_tournaments;
create policy "Owners create tournaments"
on public.cloud_tournaments for insert
to authenticated
with check (
  owner_id = auth.uid()
  and (club_id is null or public.is_club_admin(club_id))
);

drop policy if exists "Owners update tournaments" on public.cloud_tournaments;
create policy "Owners update tournaments"
on public.cloud_tournaments for update
using (
  owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
)
with check (
  owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
);

drop policy if exists "Owners delete tournaments" on public.cloud_tournaments;
create policy "Owners delete tournaments"
on public.cloud_tournaments for delete
using (
  owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
);

drop policy if exists "Public leagues readable" on public.cloud_leagues;
create policy "Public leagues readable"
on public.cloud_leagues for select
using (
  is_public
  or owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
);

drop policy if exists "Owners manage leagues" on public.cloud_leagues;
create policy "Owners manage leagues"
on public.cloud_leagues for all
to authenticated
using (
  owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
)
with check (
  owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
);

drop policy if exists "Public players readable" on public.players;
create policy "Public players readable"
on public.players for select
using (true);

drop policy if exists "Owners manage players" on public.players;
create policy "Owners manage players"
on public.players for all
to authenticated
using (
  owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
)
with check (
  owner_id = auth.uid()
  or (club_id is not null and public.is_club_admin(club_id))
);

create or replace view public.player_rankings as
select
  id,
  club_id,
  display_name,
  nickname,
  wins,
  losses,
  frames_for,
  frames_against,
  frames_for - frames_against as frame_difference,
  rating,
  case
    when wins + losses = 0 then 0
    else round((wins::numeric / (wins + losses)::numeric) * 100, 1)
  end as win_percentage
from public.players
order by rating desc, wins desc, frame_difference desc;

grant select on public.player_rankings to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.cloud_tournaments;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.cloud_leagues;
exception
  when duplicate_object then null;
end $$;
