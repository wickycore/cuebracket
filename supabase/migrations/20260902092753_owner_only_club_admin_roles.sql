create or replace function private.is_club_owner(target_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.clubs
      where id = target_club
        and owner_id = (select auth.uid())
    );
$$;
revoke all on function private.is_club_owner(uuid) from public;
grant execute on function private.is_club_owner(uuid) to authenticated;

drop policy if exists "Club admins add members" on public.club_members;
create policy "Owners and admins add permitted members" on public.club_members
  for insert to authenticated
  with check (
    private.is_club_owner(club_id)
    or (private.is_club_admin(club_id) and role = 'member')
  );

drop policy if exists "Club admins update members" on public.club_members;
create policy "Club owners assign member roles" on public.club_members
  for update to authenticated
  using (private.is_club_owner(club_id))
  with check (private.is_club_owner(club_id));

drop policy if exists "Club admins remove members" on public.club_members;
create policy "Owners and admins remove permitted members" on public.club_members
  for delete to authenticated
  using (
    private.is_club_owner(club_id)
    or (private.is_club_admin(club_id) and role = 'member')
  );
