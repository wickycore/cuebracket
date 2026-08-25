-- CueBracket cloud hardening.
-- The current app uses cloud_tournaments/cloud_leagues. The original
-- tournaments/matches tables are legacy and must not accept browser writes.

alter view public.player_rankings set (security_invoker = true);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_club_admin(uuid) from public, anon;
grant execute on function public.is_club_admin(uuid) to authenticated;

drop policy if exists "public insert matches" on public.matches;
drop policy if exists "public read matches" on public.matches;
drop policy if exists "public update matches" on public.matches;
drop policy if exists "public write matches" on public.matches;
drop policy if exists "public create tournaments" on public.tournaments;
drop policy if exists "public insert tournaments" on public.tournaments;
drop policy if exists "public read tournaments" on public.tournaments;

revoke all on table public.matches from anon, authenticated;
revoke all on table public.tournaments from anon, authenticated;

create index if not exists cloud_leagues_club_id_idx
  on public.cloud_leagues (club_id);
create index if not exists cloud_leagues_owner_id_idx
  on public.cloud_leagues (owner_id);
create index if not exists cloud_tournaments_club_id_idx
  on public.cloud_tournaments (club_id);
create index if not exists clubs_owner_id_idx
  on public.clubs (owner_id);
create index if not exists matches_tournament_id_idx
  on public.matches (tournament_id);
create index if not exists players_club_id_idx
  on public.players (club_id);
create index if not exists players_owner_id_idx
  on public.players (owner_id);
