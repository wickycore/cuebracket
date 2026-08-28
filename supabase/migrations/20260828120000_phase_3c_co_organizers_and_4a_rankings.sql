-- Phase 3C: trusted tournament co-organizers.
-- Phase 4A: verified player results, profile statistics and rankings.

create table public.tournament_collaborators (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.cloud_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role text not null default 'co_organizer'
    check (role = 'co_organizer'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (tournament_id, user_id)
);

create index tournament_collaborators_user_status_idx
  on public.tournament_collaborators (user_id, status, created_at desc);
create index tournament_collaborators_tournament_status_idx
  on public.tournament_collaborators (tournament_id, status, created_at);
create index tournament_collaborators_invited_by_idx
  on public.tournament_collaborators (invited_by);

create or replace function private.can_manage_tournament(target_tournament_id text)
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
        and (
          tournament.owner_id = (select auth.uid())
          or (
            tournament.club_id is not null
            and private.is_club_admin(tournament.club_id)
          )
          or exists (
            select 1
            from public.tournament_collaborators as collaborator
            where collaborator.tournament_id = tournament.id
              and collaborator.user_id = (select auth.uid())
              and collaborator.status = 'accepted'
          )
        )
    );
$$;
revoke all on function private.can_manage_tournament(text) from public, anon, authenticated;
grant execute on function private.can_manage_tournament(text) to anon, authenticated;

create or replace function private.prepare_tournament_collaborator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tournament_owner uuid;
begin
  select owner_id into tournament_owner
  from public.cloud_tournaments
  where id = new.tournament_id;

  if tournament_owner is null then
    raise exception 'Tournament not found.';
  end if;

  if new.user_id = tournament_owner then
    raise exception 'The tournament owner is already an organizer.';
  end if;

  if tg_op = 'INSERT' then
    if (select auth.uid()) is distinct from tournament_owner then
      raise exception 'Only the tournament owner can invite co-organizers.';
    end if;
    new.invited_by := tournament_owner;
    new.status := 'pending';
    new.accepted_at := null;
  else
    if new.tournament_id is distinct from old.tournament_id
      or new.user_id is distinct from old.user_id
      or new.invited_by is distinct from old.invited_by
      or new.role is distinct from old.role then
      raise exception 'A collaborator invitation cannot be reassigned.';
    end if;

    if (select auth.uid()) = old.user_id then
      if old.status <> 'pending' or new.status not in ('accepted', 'declined') then
        raise exception 'This invitation can no longer be changed.';
      end if;
    elsif (select auth.uid()) = tournament_owner then
      raise exception 'Remove this invitation and send a new one instead.';
    else
      raise exception 'You cannot update this invitation.';
    end if;

    new.accepted_at := case when new.status = 'accepted' then now() else null end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.prepare_tournament_collaborator() from public, anon, authenticated;

create trigger prepare_tournament_collaborator
  before insert or update on public.tournament_collaborators
  for each row execute procedure private.prepare_tournament_collaborator();

create or replace function private.protect_tournament_from_collaborator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or (select auth.uid()) = old.owner_id
    or (old.club_id is not null and private.is_club_admin(old.club_id)) then
    return new;
  end if;

  if not exists (
    select 1
    from public.tournament_collaborators as collaborator
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
    or new.players is distinct from old.players
    or new.options is distinct from old.options
    or new.is_public is distinct from old.is_public
    or new.created_at is distinct from old.created_at then
    raise exception 'Co-organizers can manage matches, scores and tables, but cannot change tournament ownership or setup.';
  end if;

  return new;
end;
$$;
revoke all on function private.protect_tournament_from_collaborator() from public, anon, authenticated;

create trigger protect_tournament_from_collaborator
  before update on public.cloud_tournaments
  for each row execute procedure private.protect_tournament_from_collaborator();

alter table public.tournament_collaborators enable row level security;

create policy "Owners and invitees read tournament collaborators"
  on public.tournament_collaborators
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  );
create policy "Tournament owners create collaborator invitations"
  on public.tournament_collaborators
  for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and exists (
      select 1 from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  );
create policy "Invitees answer collaborator invitations"
  on public.tournament_collaborators
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status in ('accepted', 'declined'));
create policy "Tournament owners remove collaborators"
  on public.tournament_collaborators
  for delete to authenticated
  using (
    exists (
      select 1 from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and tournament.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Public tournaments readable" on public.cloud_tournaments;
create policy "Public tournaments readable" on public.cloud_tournaments
  for select to anon, authenticated
  using (
    is_public
    or owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
    or exists (
      select 1 from public.tournament_collaborators as collaborator
      where collaborator.tournament_id = cloud_tournaments.id
        and collaborator.user_id = (select auth.uid())
        and collaborator.status = 'accepted'
    )
  );

drop policy if exists "Owners update tournaments" on public.cloud_tournaments;
create policy "Organizers update tournaments" on public.cloud_tournaments
  for update to authenticated
  using (private.can_manage_tournament(id))
  with check (private.can_manage_tournament(id));

create or replace function public.invite_tournament_co_organizer(
  target_tournament_id text,
  target_username text
)
returns public.tournament_collaborators
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_user_id uuid;
  invitation public.tournament_collaborators;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to invite a co-organizer.';
  end if;

  if not exists (
    select 1 from public.cloud_tournaments
    where id = target_tournament_id
      and owner_id = (select auth.uid())
  ) then
    raise exception 'Only the tournament owner can invite co-organizers.';
  end if;

  select id into target_user_id
  from public.profiles
  where lower(username) = lower(btrim(target_username))
    and username is not null
  limit 1;

  if target_user_id is null then
    raise exception 'No CueBracket player uses that username.';
  end if;

  insert into public.tournament_collaborators (
    tournament_id, user_id, invited_by
  ) values (
    target_tournament_id, target_user_id, (select auth.uid())
  )
  returning * into invitation;

  return invitation;
end;
$$;
revoke all on function public.invite_tournament_co_organizer(text, text) from public, anon;
grant execute on function public.invite_tournament_co_organizer(text, text) to authenticated;

-- Verified match and podium ledgers. Application roles can read these rows but
-- only database triggers can write them.
create table public.tournament_match_results (
  tournament_id text not null references public.cloud_tournaments(id) on delete cascade,
  match_key text not null,
  club_id uuid references public.clubs(id) on delete set null,
  player1_profile_id uuid references auth.users(id) on delete set null,
  player2_profile_id uuid references auth.users(id) on delete set null,
  player1_name text not null,
  player2_name text not null,
  winner_profile_id uuid references auth.users(id) on delete set null,
  winner_name text not null,
  score1 integer not null check (score1 >= 0),
  score2 integer not null check (score2 >= 0),
  completed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, match_key),
  constraint tournament_match_results_registered_player_check
    check (player1_profile_id is not null or player2_profile_id is not null),
  constraint tournament_match_results_distinct_players_check
    check (player1_profile_id is null or player2_profile_id is null or player1_profile_id <> player2_profile_id)
);

create table public.tournament_placements (
  tournament_id text not null references public.cloud_tournaments(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  placement smallint not null check (placement between 1 and 3),
  player_name text not null,
  recorded_at timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);

create index tournament_match_results_player1_idx
  on public.tournament_match_results (player1_profile_id, completed_at desc)
  where player1_profile_id is not null;
create index tournament_match_results_player2_idx
  on public.tournament_match_results (player2_profile_id, completed_at desc)
  where player2_profile_id is not null;
create index tournament_match_results_winner_idx
  on public.tournament_match_results (winner_profile_id, completed_at desc)
  where winner_profile_id is not null;
create index tournament_match_results_club_idx
  on public.tournament_match_results (club_id, completed_at desc)
  where club_id is not null;
create index tournament_placements_profile_idx
  on public.tournament_placements (profile_id, placement, recorded_at desc);
create index tournament_placements_club_idx
  on public.tournament_placements (club_id, placement, recorded_at desc)
  where club_id is not null;

create or replace function private.jsonb_array_or_empty(value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end;
$$;
revoke all on function private.jsonb_array_or_empty(jsonb) from public, anon, authenticated;

create or replace function private.tournament_match_nodes(
  bracket_payload jsonb,
  competition_payload jsonb
)
returns table (match_key text, match_payload jsonb)
language sql
immutable
set search_path = ''
as $$
  select 'bracket:rounds:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(bracket_payload -> 'rounds')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'bracket:winners:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(bracket_payload -> 'winners')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'bracket:losers:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(bracket_payload -> 'losers')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'bracket:grand-final:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(bracket_payload -> 'grandFinal')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'competition:rounds:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload -> 'rounds')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'competition:playoff:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload -> 'playoffRounds')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'competition:group:' || coalesce(group_payload ->> 'id', group_ordinal::text) || ':' || coalesce(match ->> 'id', match_ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload -> 'groups')) with ordinality as groups(group_payload, group_ordinal)
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(group_payload -> 'rounds')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, match_ordinal)
  union all
  select 'competition:group-playoff:' || coalesce(group_payload ->> 'id', group_ordinal::text) || ':' || coalesce(match ->> 'id', match_ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload -> 'groups')) with ordinality as groups(group_payload, group_ordinal)
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(group_payload -> 'qualificationPlayoffRounds')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, match_ordinal)
  union all
  select 'competition:final:rounds:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload #> '{finalBracket,rounds}')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'competition:final:winners:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload #> '{finalBracket,winners}')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'competition:final:losers:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload #> '{finalBracket,losers}')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal)
  union all
  select 'competition:final:grand-final:' || coalesce(match ->> 'id', ordinal::text), match
  from jsonb_array_elements(private.jsonb_array_or_empty(competition_payload #> '{finalBracket,grandFinal}')) as round
  cross join lateral jsonb_array_elements(private.jsonb_array_or_empty(round -> 'matches')) with ordinality as item(match, ordinal);
$$;
revoke all on function private.tournament_match_nodes(jsonb, jsonb) from public, anon, authenticated;

create or replace function private.refresh_tournament_player_results(target_tournament_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tournament_row public.cloud_tournaments;
  placement_bracket jsonb;
  final_match jsonb;
  semi_round jsonb;
  losers_final jsonb;
  champion_name text;
  runner_up_name text;
  third_names text[] := array[]::text[];
begin
  select * into tournament_row
  from public.cloud_tournaments
  where id = target_tournament_id;

  if tournament_row.id is null then
    return;
  end if;

  delete from public.tournament_match_results where tournament_id = target_tournament_id;
  delete from public.tournament_placements where tournament_id = target_tournament_id;

  insert into public.tournament_match_results (
    tournament_id, match_key, club_id,
    player1_profile_id, player2_profile_id,
    player1_name, player2_name,
    winner_profile_id, winner_name,
    score1, score2, completed_at, updated_at
  )
  select
    tournament_row.id,
    node.match_key,
    tournament_row.club_id,
    registration1.profile_id,
    registration2.profile_id,
    btrim(node.match_payload ->> 'player1'),
    btrim(node.match_payload ->> 'player2'),
    case
      when lower(btrim(node.match_payload ->> 'winner')) = lower(btrim(node.match_payload ->> 'player1')) then registration1.profile_id
      when lower(btrim(node.match_payload ->> 'winner')) = lower(btrim(node.match_payload ->> 'player2')) then registration2.profile_id
      else null
    end,
    btrim(node.match_payload ->> 'winner'),
    (node.match_payload ->> 'score1')::integer,
    (node.match_payload ->> 'score2')::integer,
    coalesce(
      nullif(node.match_payload ->> 'endedAt', '')::timestamptz,
      tournament_row.updated_at
    ),
    now()
  from private.tournament_match_nodes(tournament_row.bracket, tournament_row.competition) as node
  left join public.event_registrations as registration1
    on registration1.tournament_id = tournament_row.id
    and registration1.status in ('approved', 'checked_in')
    and lower(btrim(registration1.display_name)) = lower(btrim(node.match_payload ->> 'player1'))
  left join public.event_registrations as registration2
    on registration2.tournament_id = tournament_row.id
    and registration2.status in ('approved', 'checked_in')
    and lower(btrim(registration2.display_name)) = lower(btrim(node.match_payload ->> 'player2'))
  where node.match_payload ->> 'completed' = 'true'
    and nullif(btrim(node.match_payload ->> 'player1'), '') is not null
    and nullif(btrim(node.match_payload ->> 'player2'), '') is not null
    and nullif(btrim(node.match_payload ->> 'winner'), '') is not null
    and (node.match_payload ->> 'score1') ~ '^[0-9]+$'
    and (node.match_payload ->> 'score2') ~ '^[0-9]+$'
    and (registration1.profile_id is not null or registration2.profile_id is not null)
  on conflict (tournament_id, match_key) do update set
    club_id = excluded.club_id,
    player1_profile_id = excluded.player1_profile_id,
    player2_profile_id = excluded.player2_profile_id,
    player1_name = excluded.player1_name,
    player2_name = excluded.player2_name,
    winner_profile_id = excluded.winner_profile_id,
    winner_name = excluded.winner_name,
    score1 = excluded.score1,
    score2 = excluded.score2,
    completed_at = excluded.completed_at,
    updated_at = now();

  if tournament_row.status <> 'completed' then
    return;
  end if;

  champion_name := nullif(btrim(coalesce(
    tournament_row.bracket ->> 'champion',
    tournament_row.competition ->> 'champion'
  )), '');
  if champion_name is null then
    return;
  end if;

  placement_bracket := coalesce(
    tournament_row.bracket,
    tournament_row.competition -> 'finalBracket'
  );

  if placement_bracket is not null and placement_bracket ->> 'type' = 'single' then
    final_match := placement_bracket #> array[
      'rounds',
      (jsonb_array_length(placement_bracket -> 'rounds') - 1)::text,
      'matches', '0'
    ];
    runner_up_name := case
      when final_match ->> 'winner' = final_match ->> 'player1' then final_match ->> 'player2'
      else final_match ->> 'player1'
    end;
    if jsonb_array_length(placement_bracket -> 'rounds') >= 2 then
      semi_round := placement_bracket #> array[
        'rounds',
        (jsonb_array_length(placement_bracket -> 'rounds') - 2)::text,
        'matches'
      ];
      select coalesce(array_agg(
        case when match ->> 'winner' = match ->> 'player1' then match ->> 'player2' else match ->> 'player1' end
      ) filter (where match ->> 'completed' = 'true'), array[]::text[])
      into third_names
      from jsonb_array_elements(coalesce(semi_round, '[]'::jsonb)) as match;
    end if;
  elsif placement_bracket is not null and placement_bracket ->> 'type' = 'double' then
    final_match := case
      when coalesce((placement_bracket ->> 'resetRequired')::boolean, false)
        then placement_bracket #> '{grandFinal,1,matches,0}'
      else placement_bracket #> '{grandFinal,0,matches,0}'
    end;
    runner_up_name := case
      when final_match ->> 'winner' = final_match ->> 'player1' then final_match ->> 'player2'
      else final_match ->> 'player1'
    end;
    losers_final := placement_bracket #> array[
      'losers',
      (jsonb_array_length(placement_bracket -> 'losers') - 1)::text,
      'matches', '0'
    ];
    third_names := array[case
      when losers_final ->> 'winner' = losers_final ->> 'player1' then losers_final ->> 'player2'
      else losers_final ->> 'player1'
    end];
  elsif tournament_row.competition ? 'standings' then
    select standing ->> 'player' into runner_up_name
    from jsonb_array_elements(tournament_row.competition -> 'standings') with ordinality as rows(standing, ordinal)
    where standing ->> 'player' <> champion_name
    order by ordinal
    limit 1;

    select coalesce(array_agg(standing ->> 'player' order by ordinal), array[]::text[])
    into third_names
    from jsonb_array_elements(tournament_row.competition -> 'standings') with ordinality as rows(standing, ordinal)
    where standing ->> 'player' not in (champion_name, coalesce(runner_up_name, ''))
      and ordinal <= 3;
  end if;

  with placement_names(placement, player_name) as (
    select 1::smallint, champion_name
    union all select 2::smallint, nullif(btrim(runner_up_name), '')
    union all select 3::smallint, nullif(btrim(player_name), '') from unnest(third_names) as player_name
  )
  insert into public.tournament_placements (
    tournament_id, profile_id, club_id, placement, player_name, recorded_at
  )
  select
    tournament_row.id,
    registration.profile_id,
    tournament_row.club_id,
    placement_names.placement,
    placement_names.player_name,
    tournament_row.updated_at
  from placement_names
  join public.event_registrations as registration
    on registration.tournament_id = tournament_row.id
    and registration.status in ('approved', 'checked_in')
    and registration.profile_id is not null
    and lower(btrim(registration.display_name)) = lower(btrim(placement_names.player_name))
  where placement_names.player_name is not null
  on conflict (tournament_id, profile_id) do update set
    club_id = excluded.club_id,
    placement = least(public.tournament_placements.placement, excluded.placement),
    player_name = excluded.player_name,
    recorded_at = excluded.recorded_at;
end;
$$;
revoke all on function private.refresh_tournament_player_results(text) from public, anon, authenticated;

create or replace function private.refresh_results_after_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_tournament_player_results(new.id);
  return new;
end;
$$;
revoke all on function private.refresh_results_after_tournament_change() from public, anon, authenticated;

create or replace function private.refresh_results_after_registration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_tournament_player_results(old.tournament_id);
    return old;
  end if;

  perform private.refresh_tournament_player_results(new.tournament_id);
  return new;
end;
$$;
revoke all on function private.refresh_results_after_registration_change() from public, anon, authenticated;

create trigger refresh_results_after_tournament_change
  after insert or update of bracket, competition, status, club_id
  on public.cloud_tournaments
  for each row execute procedure private.refresh_results_after_tournament_change();

create trigger refresh_results_after_registration_change
  after insert or update or delete on public.event_registrations
  for each row execute procedure private.refresh_results_after_registration_change();

alter table public.tournament_match_results enable row level security;
alter table public.tournament_placements enable row level security;

create policy "Public or managed tournament results are readable"
  on public.tournament_match_results
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and (tournament.is_public or private.can_manage_tournament(tournament.id))
    )
  );
create policy "Public or managed tournament placements are readable"
  on public.tournament_placements
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.cloud_tournaments as tournament
      where tournament.id = tournament_id
        and (tournament.is_public or private.can_manage_tournament(tournament.id))
    )
  );

drop view if exists public.player_rankings;
create view public.player_statistics
with (security_invoker = true)
as
with match_sides as (
  select
    result.tournament_id,
    result.player1_profile_id as profile_id,
    result.winner_profile_id = result.player1_profile_id as won,
    result.score1 as frames_for,
    result.score2 as frames_against,
    result.completed_at
  from public.tournament_match_results as result
  where result.player1_profile_id is not null
  union all
  select
    result.tournament_id,
    result.player2_profile_id,
    result.winner_profile_id = result.player2_profile_id,
    result.score2,
    result.score1,
    result.completed_at
  from public.tournament_match_results as result
  where result.player2_profile_id is not null
), match_totals as (
  select
    profile_id,
    count(*)::integer as matches_played,
    count(*) filter (where won)::integer as wins,
    count(*) filter (where not won)::integer as losses,
    sum(frames_for)::integer as frames_for,
    sum(frames_against)::integer as frames_against,
    count(distinct tournament_id)::integer as tournaments_played,
    max(completed_at) as last_played_at
  from match_sides
  group by profile_id
), placement_totals as (
  select
    profile_id,
    count(*) filter (where placement = 1)::integer as titles,
    count(*) filter (where placement <= 3)::integer as podiums,
    count(*) filter (where placement = 2)::integer as runner_up_finishes,
    count(*) filter (where placement = 3)::integer as third_place_finishes
  from public.tournament_placements
  group by profile_id
)
select
  profile.id as profile_id,
  profile.display_name,
  profile.username,
  profile.tournament_name,
  profile.avatar_url,
  coalesce(matches.matches_played, 0) as matches_played,
  coalesce(matches.wins, 0) as wins,
  coalesce(matches.losses, 0) as losses,
  coalesce(matches.frames_for, 0) as frames_for,
  coalesce(matches.frames_against, 0) as frames_against,
  coalesce(matches.frames_for, 0) - coalesce(matches.frames_against, 0) as frame_difference,
  case
    when coalesce(matches.matches_played, 0) = 0 then 0::numeric
    else round(matches.wins::numeric * 100 / matches.matches_played, 1)
  end as win_percentage,
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
where profile.is_public;

create view public.player_rankings
with (security_invoker = true)
as
select
  dense_rank() over (
    order by statistics.ranking_points desc,
      statistics.wins desc,
      statistics.frame_difference desc,
      statistics.display_name
  )::integer as global_rank,
  statistics.*
from public.player_statistics as statistics
where statistics.username is not null
order by global_rank, statistics.display_name;

create view public.club_player_rankings
with (security_invoker = true)
as
select
  member.club_id,
  dense_rank() over (
    partition by member.club_id
    order by statistics.ranking_points desc,
      statistics.wins desc,
      statistics.frame_difference desc,
      statistics.display_name
  )::integer as club_rank,
  statistics.*
from public.club_members as member
join public.player_statistics as statistics on statistics.profile_id = member.user_id;

create view public.player_tournament_history
with (security_invoker = true)
as
with match_sides as (
  select tournament_id, player1_profile_id as profile_id,
    (winner_profile_id = player1_profile_id)::integer as win,
    score1 as frames_for, score2 as frames_against,
    completed_at
  from public.tournament_match_results where player1_profile_id is not null
  union all
  select tournament_id, player2_profile_id,
    (winner_profile_id = player2_profile_id)::integer,
    score2, score1, completed_at
  from public.tournament_match_results where player2_profile_id is not null
), participants as (
  select tournament_id, profile_id from match_sides
  union
  select tournament_id, profile_id from public.tournament_placements
), totals as (
  select tournament_id, profile_id,
    count(*)::integer as matches_played,
    sum(win)::integer as wins,
    (count(*) - sum(win))::integer as losses,
    sum(frames_for)::integer as frames_for,
    sum(frames_against)::integer as frames_against,
    max(completed_at) as last_match_at
  from match_sides
  group by tournament_id, profile_id
)
select
  participant.profile_id,
  tournament.id as tournament_id,
  tournament.name as tournament_name,
  tournament.venue,
  tournament.format,
  tournament.club_id,
  club.name as club_name,
  tournament.status,
  placement.placement,
  coalesce(totals.matches_played, 0) as matches_played,
  coalesce(totals.wins, 0) as wins,
  coalesce(totals.losses, 0) as losses,
  coalesce(totals.frames_for, 0) as frames_for,
  coalesce(totals.frames_against, 0) as frames_against,
  coalesce(totals.last_match_at, placement.recorded_at, tournament.updated_at) as played_at
from participants as participant
join public.cloud_tournaments as tournament on tournament.id = participant.tournament_id
left join public.clubs as club on club.id = tournament.club_id
left join public.tournament_placements as placement
  on placement.tournament_id = participant.tournament_id
  and placement.profile_id = participant.profile_id
left join totals
  on totals.tournament_id = participant.tournament_id
  and totals.profile_id = participant.profile_id;

revoke all on table public.tournament_collaborators from anon, authenticated;
grant select, delete on table public.tournament_collaborators to authenticated;
grant insert (tournament_id, user_id, invited_by) on table public.tournament_collaborators to authenticated;
grant update (status) on table public.tournament_collaborators to authenticated;

revoke all on table public.tournament_match_results from anon, authenticated;
revoke all on table public.tournament_placements from anon, authenticated;
grant select on table public.tournament_match_results, public.tournament_placements to anon, authenticated;

revoke all on table public.player_statistics, public.player_rankings,
  public.club_player_rankings, public.player_tournament_history from anon, authenticated;
grant select on table public.player_statistics, public.player_rankings,
  public.club_player_rankings, public.player_tournament_history to anon, authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'club_event', 'registration_status', 'membership_status', 'match_live', 'collaboration'
  ));

create or replace function private.notify_tournament_collaboration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tournament_name text;
  collaborator_name text;
begin
  select name into tournament_name
  from public.cloud_tournaments where id = new.tournament_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (
      user_id, type, title, message, href, metadata, dedupe_key
    ) values (
      new.user_id,
      'collaboration',
      'Co-organizer invitation',
      'You were invited to help run ' || tournament_name || '.',
      '/cloud',
      jsonb_build_object('tournament_id', new.tournament_id, 'invitation_id', new.id),
      'collaboration-invite:' || new.id
    ) on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  elsif old.status = 'pending' and new.status in ('accepted', 'declined') then
    select coalesce(profile.tournament_name, profile.display_name) into collaborator_name
    from public.profiles as profile where profile.id = new.user_id;

    insert into public.notifications (
      user_id, type, title, message, href, metadata, dedupe_key
    ) values (
      new.invited_by,
      'collaboration',
      case when new.status = 'accepted' then 'Co-organizer joined' else 'Invitation declined' end,
      collaborator_name || case when new.status = 'accepted' then ' accepted the invitation to help run ' else ' declined the invitation for ' end || tournament_name || '.',
      '/tournaments/' || new.tournament_id,
      jsonb_build_object('tournament_id', new.tournament_id, 'invitation_id', new.id, 'status', new.status),
      'collaboration-response:' || new.id || ':' || new.status
    ) on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return new;
end;
$$;
revoke all on function private.notify_tournament_collaboration() from public, anon, authenticated;

create trigger notify_tournament_collaboration
  after insert or update of status on public.tournament_collaborators
  for each row execute procedure private.notify_tournament_collaboration();

do $$
declare
  tournament_id text;
begin
  for tournament_id in select id from public.cloud_tournaments loop
    perform private.refresh_tournament_player_results(tournament_id);
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournament_collaborators'
  ) then
    alter publication supabase_realtime add table public.tournament_collaborators;
  end if;
end;
$$;
