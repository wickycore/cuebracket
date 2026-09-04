-- Allow the protected owner membership to be removed only as part of deleting
-- its parent club. Direct owner membership deletion remains blocked.
create or replace function private.protect_club_owner_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  club_owner uuid;
begin
  if tg_op = 'DELETE' then
    select owner_id into club_owner
    from public.clubs
    where id = old.club_id;

    -- During an ON DELETE CASCADE the parent club no longer exists. This is
    -- the only case where its protected owner membership may disappear.
    if club_owner is null then
      return old;
    end if;

    if old.user_id = club_owner or old.role = 'owner' then
      raise exception 'The club owner membership cannot be removed.';
    end if;
    return old;
  end if;

  select owner_id into club_owner
  from public.clubs
  where id = new.club_id;

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

revoke all on function private.protect_club_owner_membership()
  from public, anon, authenticated;
