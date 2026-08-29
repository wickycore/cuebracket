-- Repair the Phase 3C tournament/collaborator RLS cycle.
--
-- The cloud_tournaments SELECT policy previously queried
-- tournament_collaborators while collaborator policies queried
-- cloud_tournaments. PostgreSQL correctly rejected both paths as infinite
-- policy recursion, which stopped cloud backup reads and writes.

create or replace function private.is_tournament_owner(
  target_tournament_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.cloud_tournaments as tournament
      where tournament.id = target_tournament_id
        and tournament.owner_id = (select auth.uid())
    );
$$;
revoke all on function private.is_tournament_owner(text)
  from public, anon, authenticated, service_role;
grant execute on function private.is_tournament_owner(text)
  to anon, authenticated;

create or replace function private.is_tournament_collaborator(
  target_tournament_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tournament_collaborators as collaborator
      where collaborator.tournament_id = target_tournament_id
        and collaborator.user_id = (select auth.uid())
        and collaborator.status = 'accepted'
    );
$$;
revoke all on function private.is_tournament_collaborator(text)
  from public, anon, authenticated, service_role;
grant execute on function private.is_tournament_collaborator(text)
  to anon, authenticated;

drop policy if exists "Public tournaments readable"
  on public.cloud_tournaments;
create policy "Public tournaments readable"
  on public.cloud_tournaments
  for select to anon, authenticated
  using (
    is_public
    or owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
    or (select private.is_tournament_collaborator(id))
  );

drop policy if exists "Owners and invitees read tournament collaborators"
  on public.tournament_collaborators;
create policy "Owners and invitees read tournament collaborators"
  on public.tournament_collaborators
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_tournament_owner(tournament_id))
  );

drop policy if exists "Tournament owners create collaborator invitations"
  on public.tournament_collaborators;
create policy "Tournament owners create collaborator invitations"
  on public.tournament_collaborators
  for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and (select private.is_tournament_owner(tournament_id))
  );

drop policy if exists "Tournament owners remove collaborators"
  on public.tournament_collaborators;
create policy "Tournament owners remove collaborators"
  on public.tournament_collaborators
  for delete to authenticated
  using ((select private.is_tournament_owner(tournament_id)));
