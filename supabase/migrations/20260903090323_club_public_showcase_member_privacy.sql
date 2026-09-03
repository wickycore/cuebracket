-- Public club pages advertise events and achievements while approved members
-- receive the private roster, clubhouse and internal activity.

create or replace function private.shares_club_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.club_members as own_membership
      join public.club_members as target_membership
        on target_membership.club_id = own_membership.club_id
      where own_membership.user_id = (select auth.uid())
        and target_membership.user_id = target_user
    );
$$;
revoke all on function private.shares_club_with(uuid) from public;
grant execute on function private.shares_club_with(uuid) to anon, authenticated;

drop policy if exists "Public profiles readable" on public.profiles;
create policy "Public or shared club profiles readable"
  on public.profiles
  for select to anon, authenticated
  using (
    is_public
    or id = (select auth.uid())
    or private.shares_club_with(id)
  );

drop policy if exists "Public club rosters are readable" on public.club_members;
create policy "Approved members read their club roster"
  on public.club_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_club_member(club_id)
    or private.is_club_admin(club_id)
  );

drop policy if exists "Club follower counts are public" on public.club_followers;
create policy "Followers read own follow and organizers read followers"
  on public.club_followers
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_club_admin(club_id)
  );
revoke select on table public.club_followers from anon;

create table if not exists public.club_member_counts (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  member_count integer not null default 0 check (member_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.club_member_counts enable row level security;
drop policy if exists "Public club member totals are readable" on public.club_member_counts;
create policy "Public club member totals are readable"
  on public.club_member_counts
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.clubs as club
      where club.id = club_member_counts.club_id and club.is_public
    )
    or private.is_club_member(club_id)
    or private.is_club_admin(club_id)
  );
revoke all on table public.club_member_counts from public, anon, authenticated;
grant select on table public.club_member_counts to anon, authenticated;
grant all on table public.club_member_counts to service_role;

create or replace function private.refresh_club_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_club uuid;
begin
  target_club := case when tg_op = 'DELETE' then old.club_id else new.club_id end;
  if not exists (select 1 from public.clubs where id = target_club) then
    delete from public.club_member_counts where club_id = target_club;
  else
    insert into public.club_member_counts (club_id, member_count, updated_at)
    values (
      target_club,
      (select count(*)::integer from public.club_members where club_id = target_club),
      now()
    )
    on conflict (club_id) do update
      set member_count = excluded.member_count,
          updated_at = excluded.updated_at;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.refresh_club_member_count() from public, anon, authenticated;
drop trigger if exists refresh_club_member_count on public.club_members;
create trigger refresh_club_member_count
  after insert or delete on public.club_members
  for each row execute function private.refresh_club_member_count();

insert into public.club_member_counts (club_id, member_count, updated_at)
select club.id, count(member.user_id)::integer, now()
from public.clubs as club
left join public.club_members as member on member.club_id = club.id
group by club.id
on conflict (club_id) do update
  set member_count = excluded.member_count,
      updated_at = excluded.updated_at;

create table if not exists public.club_follower_counts (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  follower_count integer not null default 0 check (follower_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.club_follower_counts enable row level security;
drop policy if exists "Approved members read club follower totals" on public.club_follower_counts;
create policy "Approved members read club follower totals"
  on public.club_follower_counts
  for select to authenticated
  using (
    private.is_club_member(club_id)
    or private.is_club_admin(club_id)
  );
revoke all on table public.club_follower_counts from public, anon, authenticated;
grant select on table public.club_follower_counts to authenticated;
grant all on table public.club_follower_counts to service_role;

create or replace function private.refresh_club_follower_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_club uuid;
begin
  target_club := case when tg_op = 'DELETE' then old.club_id else new.club_id end;
  if not exists (select 1 from public.clubs where id = target_club) then
    delete from public.club_follower_counts where club_id = target_club;
  else
    insert into public.club_follower_counts (club_id, follower_count, updated_at)
    values (
      target_club,
      (select count(*)::integer from public.club_followers where club_id = target_club),
      now()
    )
    on conflict (club_id) do update
      set follower_count = excluded.follower_count,
          updated_at = excluded.updated_at;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.refresh_club_follower_count() from public, anon, authenticated;
drop trigger if exists refresh_club_follower_count on public.club_followers;
create trigger refresh_club_follower_count
  after insert or delete on public.club_followers
  for each row execute function private.refresh_club_follower_count();

insert into public.club_follower_counts (club_id, follower_count, updated_at)
select club.id, count(follower.user_id)::integer, now()
from public.clubs as club
left join public.club_followers as follower on follower.club_id = club.id
group by club.id
on conflict (club_id) do update
  set follower_count = excluded.follower_count,
      updated_at = excluded.updated_at;

-- A public-safe projection keeps published competitive rankings available
-- without exposing the private club_members table.
create table if not exists public.club_public_ranking_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (club_id, profile_id)
);
alter table public.club_public_ranking_members enable row level security;
drop policy if exists "Published club ranking players are readable" on public.club_public_ranking_members;
create policy "Published club ranking players are readable"
  on public.club_public_ranking_members
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.clubs as club
      where club.id = club_public_ranking_members.club_id and club.is_public
    )
    or private.is_club_member(club_id)
    or private.is_club_admin(club_id)
  );
revoke all on table public.club_public_ranking_members from public, anon, authenticated;
grant select on table public.club_public_ranking_members to anon, authenticated;
grant all on table public.club_public_ranking_members to service_role;

create or replace function private.refresh_club_public_ranking_membership(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.club_public_ranking_members where profile_id = target_profile;
  insert into public.club_public_ranking_members (club_id, profile_id)
  select member.club_id, member.user_id
  from public.club_members as member
  join public.profiles as profile on profile.id = member.user_id
  where member.user_id = target_profile
    and profile.is_public
    and profile.username is not null
  on conflict do nothing;
end;
$$;
revoke all on function private.refresh_club_public_ranking_membership(uuid) from public, anon, authenticated;

create or replace function private.refresh_club_public_ranking_from_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_club_public_ranking_membership(
    case when tg_op = 'DELETE' then old.user_id else new.user_id end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.refresh_club_public_ranking_from_member() from public, anon, authenticated;
drop trigger if exists refresh_club_public_ranking_from_member on public.club_members;
create trigger refresh_club_public_ranking_from_member
  after insert or delete on public.club_members
  for each row execute function private.refresh_club_public_ranking_from_member();

create or replace function private.refresh_club_public_ranking_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_club_public_ranking_membership(new.id);
  return new;
end;
$$;
revoke all on function private.refresh_club_public_ranking_from_profile() from public, anon, authenticated;
drop trigger if exists refresh_club_public_ranking_from_profile on public.profiles;
create trigger refresh_club_public_ranking_from_profile
  after insert or update of is_public, username on public.profiles
  for each row execute function private.refresh_club_public_ranking_from_profile();

insert into public.club_public_ranking_members (club_id, profile_id)
select member.club_id, member.user_id
from public.club_members as member
join public.profiles as profile on profile.id = member.user_id
where profile.is_public and profile.username is not null
on conflict do nothing;

create or replace view public.player_statistics
with (security_invoker = true)
as
with match_sides as (
  select result.tournament_id, result.player1_profile_id as profile_id,
    result.winner_profile_id = result.player1_profile_id as won,
    result.score1 as frames_for, result.score2 as frames_against, result.completed_at
  from public.tournament_match_results as result
  where result.player1_profile_id is not null
  union all
  select result.tournament_id, result.player2_profile_id,
    result.winner_profile_id = result.player2_profile_id,
    result.score2, result.score1, result.completed_at
  from public.tournament_match_results as result
  where result.player2_profile_id is not null
), match_totals as (
  select profile_id,
    count(*)::integer as matches_played,
    count(*) filter (where won)::integer as wins,
    count(*) filter (where not won)::integer as losses,
    sum(frames_for)::integer as frames_for,
    sum(frames_against)::integer as frames_against,
    count(distinct tournament_id)::integer as tournaments_played,
    max(completed_at) as last_played_at
  from match_sides group by profile_id
), placement_totals as (
  select profile_id,
    count(*) filter (where placement = 1)::integer as titles,
    count(*) filter (where placement <= 3)::integer as podiums,
    count(*) filter (where placement = 2)::integer as runner_up_finishes,
    count(*) filter (where placement = 3)::integer as third_place_finishes
  from public.tournament_placements group by profile_id
)
select profile.id as profile_id, profile.display_name, profile.username,
  profile.tournament_name, profile.avatar_url,
  coalesce(matches.matches_played, 0) as matches_played,
  coalesce(matches.wins, 0) as wins,
  coalesce(matches.losses, 0) as losses,
  coalesce(matches.frames_for, 0) as frames_for,
  coalesce(matches.frames_against, 0) as frames_against,
  coalesce(matches.frames_for, 0) - coalesce(matches.frames_against, 0) as frame_difference,
  case when coalesce(matches.matches_played, 0) = 0 then 0::numeric
    else round(matches.wins::numeric * 100 / matches.matches_played, 1) end as win_percentage,
  coalesce(placements.titles, 0) as titles,
  coalesce(placements.podiums, 0) as podiums,
  coalesce(matches.tournaments_played, 0) as tournaments_played,
  coalesce(matches.wins, 0) * 10
    + coalesce(placements.titles, 0) * 100
    + coalesce(placements.runner_up_finishes, 0) * 60
    + coalesce(placements.third_place_finishes, 0) * 40 as ranking_points,
  matches.last_played_at
from public.profiles as profile
left join match_totals as matches on matches.profile_id = profile.id
left join placement_totals as placements on placements.profile_id = profile.id
where profile.is_public
  or profile.id = (select auth.uid())
  or private.shares_club_with(profile.id);

create or replace view public.player_rankings
with (security_invoker = true)
as
select dense_rank() over (
    order by statistics.ranking_points desc, statistics.wins desc,
      statistics.frame_difference desc, statistics.display_name
  )::integer as global_rank,
  statistics.*
from public.player_statistics as statistics
join public.profiles as profile on profile.id = statistics.profile_id
where statistics.username is not null and profile.is_public
order by global_rank, statistics.display_name;

create or replace view public.club_player_rankings
with (security_invoker = true)
as
select ranking_member.club_id,
  dense_rank() over (
    partition by ranking_member.club_id
    order by statistics.ranking_points desc, statistics.wins desc,
      statistics.frame_difference desc, statistics.display_name
  )::integer as club_rank,
  statistics.*
from public.club_public_ranking_members as ranking_member
join public.player_statistics as statistics
  on statistics.profile_id = ranking_member.profile_id;

drop policy if exists "Public player follower counts are readable" on public.player_follower_counts;
create policy "Public self or shared club follower counts are readable"
  on public.player_follower_counts
  for select to anon, authenticated
  using (
    player_id = (select auth.uid())
    or private.shares_club_with(player_id)
    or exists (
      select 1 from public.profiles as profile
      where profile.id = player_follower_counts.player_id
        and profile.is_public
        and profile.username is not null
    )
  );

drop policy if exists "Public club announcements are readable" on public.club_announcements;
create policy "Approved members read club announcements"
  on public.club_announcements
  for select to authenticated
  using (private.is_club_member(club_id) or private.is_club_admin(club_id));
revoke select on table public.club_announcements from anon;

drop policy if exists "Readable club calendar events" on public.club_calendar_events;
create policy "Approved members read club calendar events"
  on public.club_calendar_events
  for select to authenticated
  using (private.is_club_member(club_id) or private.is_club_admin(club_id));
revoke select on table public.club_calendar_events from anon;

drop policy if exists "Readable club challenges" on public.club_challenges;
create policy "Approved members read club challenges"
  on public.club_challenges
  for select to authenticated
  using (private.is_club_member(club_id) or private.is_club_admin(club_id));
revoke select on table public.club_challenges from anon;
