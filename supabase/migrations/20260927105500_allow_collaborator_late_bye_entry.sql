-- Co-organizers can fill unlocked BYEs in the application. Their bracket
-- update appends the late entrant to players; the old trigger rejected it and
-- caused every subsequent queued score update to fail as well.
create or replace function private.protect_tournament_from_collaborator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_index integer;
begin
  if (select auth.uid()) is null
    or (select auth.uid()) = old.owner_id
    or (old.club_id is not null and private.is_club_admin(old.club_id)) then
    return new;
  end if;

  if not exists (
    select 1 from public.tournament_collaborators as collaborator
    where collaborator.tournament_id = old.id
      and collaborator.user_id = (select auth.uid())
      and collaborator.status = 'accepted'
  ) then
    raise exception 'You cannot manage this tournament.';
  end if;

  if new.owner_id is distinct from old.owner_id
    or new.club_id is distinct from old.club_id
    or new.name is distinct from old.name
    or new.venue is distinct from old.venue
    or new.stage_type is distinct from old.stage_type
    or new.format is distinct from old.format
    or new.race_to is distinct from old.race_to
    or new.bracket_size is distinct from old.bracket_size
    or new.options is distinct from old.options
    or new.is_public is distinct from old.is_public
    or new.created_at is distinct from old.created_at then
    raise exception 'Co-organizers can manage matches, scores and tables, but cannot change tournament ownership or setup.';
  end if;

  if new.players is distinct from old.players then
    if old.format not in ('single', 'double')
      or old.bracket is null
      or new.bracket is null
      or new.bracket is not distinct from old.bracket
      or jsonb_typeof(old.players) <> 'array'
      or jsonb_typeof(new.players) <> 'array'
      or jsonb_array_length(new.players) <= jsonb_array_length(old.players)
      or jsonb_array_length(new.players) > old.bracket_size then
      raise exception 'Co-organizers may add players only into available BYE slots.';
    end if;

    -- Keep every existing seed in order; only late entrants may be appended.
    for player_index in 0..jsonb_array_length(old.players) - 1 loop
      if new.players -> player_index is distinct from old.players -> player_index then
        raise exception 'Co-organizers cannot change existing players.';
      end if;
    end loop;
  end if;

  return new;
end;
$$;
