-- Allow the privileged RSVP projection trigger to update count columns.
-- API roles still have no UPDATE grant on either count column.
create or replace function private.prepare_club_calendar_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.description := btrim(new.description);
  new.location := regexp_replace(btrim(new.location), '\s+', ' ', 'g');
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.creator_id := (select auth.uid());
    new.going_count := 0;
    new.maybe_count := 0;
  elsif new.club_id is distinct from old.club_id
    or new.creator_id is distinct from old.creator_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Calendar event ownership cannot be reassigned.';
  end if;

  return new;
end;
$$;
revoke all on function private.prepare_club_calendar_event()
  from public, anon, authenticated;
