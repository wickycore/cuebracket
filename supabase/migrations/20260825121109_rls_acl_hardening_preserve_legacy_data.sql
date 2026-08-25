
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_club_admin(target_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.club_members
        where club_id = target_club
          and user_id = (select auth.uid())
          and role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.clubs
        where id = target_club
          and owner_id = (select auth.uid())
      )
    );
$$;
revoke all on function private.is_club_admin(uuid) from public;
grant execute on function private.is_club_admin(uuid) to anon, authenticated;

drop policy if exists "Owners manage leagues" on public.cloud_leagues;
drop policy if exists "Public leagues readable" on public.cloud_leagues;
create policy "Public leagues readable" on public.cloud_leagues
  for select to anon, authenticated
  using (
    is_public
    or owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );
create policy "Owners create leagues" on public.cloud_leagues
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (club_id is null or private.is_club_admin(club_id))
  );
create policy "Owners update leagues" on public.cloud_leagues
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  )
  with check (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );
create policy "Owners delete leagues" on public.cloud_leagues
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );

drop policy if exists "Owners create tournaments" on public.cloud_tournaments;
drop policy if exists "Owners delete tournaments" on public.cloud_tournaments;
drop policy if exists "Owners update tournaments" on public.cloud_tournaments;
drop policy if exists "Public tournaments readable" on public.cloud_tournaments;
create policy "Public tournaments readable" on public.cloud_tournaments
  for select to anon, authenticated
  using (
    is_public
    or owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );
create policy "Owners create tournaments" on public.cloud_tournaments
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (club_id is null or private.is_club_admin(club_id))
  );
create policy "Owners update tournaments" on public.cloud_tournaments
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  )
  with check (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );
create policy "Owners delete tournaments" on public.cloud_tournaments
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );

drop policy if exists "Club admins manage members" on public.club_members;
drop policy if exists "Members view own club memberships" on public.club_members;
create policy "Members view own club memberships" on public.club_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_club_admin(club_id)
  );
create policy "Club admins add members" on public.club_members
  for insert to authenticated
  with check (private.is_club_admin(club_id));
create policy "Club admins update members" on public.club_members
  for update to authenticated
  using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id));
create policy "Club admins remove members" on public.club_members
  for delete to authenticated
  using (private.is_club_admin(club_id));

drop policy if exists "Authenticated users create clubs" on public.clubs;
drop policy if exists "Club admins update clubs" on public.clubs;
drop policy if exists "Club owners delete clubs" on public.clubs;
drop policy if exists "Public clubs readable" on public.clubs;
create policy "Public clubs readable" on public.clubs
  for select to anon, authenticated
  using (
    is_public
    or owner_id = (select auth.uid())
    or private.is_club_admin(id)
  );
create policy "Authenticated users create clubs" on public.clubs
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Club admins update clubs" on public.clubs
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or private.is_club_admin(id)
  )
  with check (
    owner_id = (select auth.uid())
    or private.is_club_admin(id)
  );
create policy "Club owners delete clubs" on public.clubs
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Owners manage players" on public.players;
drop policy if exists "Public players readable" on public.players;
create policy "Public players readable" on public.players
  for select to anon, authenticated
  using (true);
create policy "Owners create players" on public.players
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );
create policy "Owners update players" on public.players
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  )
  with check (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );
create policy "Owners delete players" on public.players
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );

drop policy if exists "Profiles readable" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Profiles readable" on public.profiles
  for select to anon, authenticated
  using (true);
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop function if exists public.is_club_admin(uuid);
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke all on table public.cloud_leagues from anon, authenticated;
revoke all on table public.cloud_tournaments from anon, authenticated;
revoke all on table public.clubs from anon, authenticated;
revoke all on table public.club_members from anon, authenticated;
revoke all on table public.players from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.player_rankings from anon, authenticated;
revoke all on table public.matches from anon, authenticated;
revoke all on table public.tournaments from anon, authenticated;

grant select on table public.cloud_leagues, public.cloud_tournaments, public.clubs, public.players, public.profiles, public.player_rankings to anon;
grant select, insert, update, delete on table public.cloud_leagues, public.cloud_tournaments, public.clubs, public.players to authenticated;
grant select, insert, update, delete on table public.club_members to authenticated;
grant select, update on table public.profiles to authenticated;
grant select on table public.player_rankings to authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

