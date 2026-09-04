-- Automatic, idempotent club attendance milestones and monthly MVP honours.

alter table public.club_achievements
  add column source text not null default 'manual'
    check (source in ('manual', 'system')),
  add column source_key text;

alter table public.club_achievements
  add constraint club_achievements_source_key_check check (
    (source = 'manual' and source_key is null)
    or (source = 'system' and char_length(source_key) between 3 and 100)
  );

create unique index club_achievements_system_key_idx
  on public.club_achievements (club_id, source_key)
  where source = 'system';

create or replace function private.prepare_club_achievement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.description := btrim(new.description);
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.source = 'system' then
      new.awarded_by := null;
    else
      new.source := 'manual';
      new.source_key := null;
      new.awarded_by := (select auth.uid());
    end if;
  elsif new.club_id is distinct from old.club_id
    or new.recipient_id is distinct from old.recipient_id
    or new.awarded_by is distinct from old.awarded_by
    or new.source is distinct from old.source
    or new.source_key is distinct from old.source_key
    or new.created_at is distinct from old.created_at then
    raise exception 'Achievement ownership cannot be reassigned.';
  end if;

  if not exists (
    select 1 from public.club_members as member
    where member.club_id = new.club_id and member.user_id = new.recipient_id
  ) then
    raise exception 'Achievements can only be awarded to current club members.';
  end if;

  return new;
end;
$$;
revoke all on function private.prepare_club_achievement()
  from public, anon, authenticated;

create or replace function private.refresh_automatic_club_recognition(
  evaluation_time timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_row record;
  milestone integer;
  attendance_total integer;
  target_month_start timestamptz;
  target_month_end timestamptz;
  club_row record;
  mvp_row record;
begin
  -- A calendar tournament may mirror a CueBracket tournament, so calendar
  -- attendance excludes that kind and completed checked-in tournaments are
  -- counted from registrations instead.
  for member_row in
    select member.club_id, member.user_id
    from public.club_members as member
  loop
    select count(*)::integer into attendance_total
    from (
      select 'calendar:' || event.id::text as attendance_key
      from public.club_calendar_rsvps as rsvp
      join public.club_calendar_events as event on event.id = rsvp.event_id
      where event.club_id = member_row.club_id
        and rsvp.user_id = member_row.user_id
        and rsvp.response = 'going'
        and event.kind <> 'tournament'
        and not event.is_cancelled
        and coalesce(event.ends_at, event.starts_at) < evaluation_time
      union all
      select 'tournament:' || tournament.id::text
      from public.event_registrations as registration
      join public.cloud_tournaments as tournament on tournament.id = registration.tournament_id
      where tournament.club_id = member_row.club_id
        and registration.profile_id = member_row.user_id
        and registration.status = 'checked_in'
        and tournament.status = 'completed'
        and tournament.updated_at <= evaluation_time
    ) as attended;

    foreach milestone in array array[5, 10, 25, 50, 100]
    loop
      if attendance_total >= milestone then
        insert into public.club_achievements (
          club_id, recipient_id, awarded_by, kind, title, description,
          awarded_on, is_featured, source, source_key
        ) values (
          member_row.club_id,
          member_row.user_id,
          null,
          'milestone',
          milestone || ' Events Attended',
          format('Automatically awarded after %s confirmed club event attendances.', milestone),
          (evaluation_time at time zone 'Africa/Nairobi')::date,
          milestone >= 25,
          'system',
          'attendance:' || member_row.user_id::text || ':' || milestone
        ) on conflict (club_id, source_key) where source = 'system' do nothing;
      end if;
    end loop;
  end loop;

  -- At each run, evaluate the most recently completed Nairobi calendar month.
  target_month_end := date_trunc('month', evaluation_time at time zone 'Africa/Nairobi')
    at time zone 'Africa/Nairobi';
  target_month_start := target_month_end - interval '1 month';

  for club_row in select id from public.clubs
  loop
    select scored.* into mvp_row
    from (
      with match_sides as (
        select result.player1_profile_id as profile_id,
          (result.winner_profile_id = result.player1_profile_id)::integer as win,
          result.score1 - result.score2 as frame_difference
        from public.tournament_match_results as result
        where result.club_id = club_row.id
          and result.player1_profile_id is not null
          and result.completed_at >= target_month_start
          and result.completed_at < target_month_end
        union all
        select result.player2_profile_id,
          (result.winner_profile_id = result.player2_profile_id)::integer,
          result.score2 - result.score1
        from public.tournament_match_results as result
        where result.club_id = club_row.id
          and result.player2_profile_id is not null
          and result.completed_at >= target_month_start
          and result.completed_at < target_month_end
      ), placement_bonus as (
        select placement.profile_id,
          sum(case placement.placement when 1 then 10 when 2 then 6 when 3 then 3 else 0 end)::integer as bonus
        from public.tournament_placements as placement
        where placement.club_id = club_row.id
          and placement.recorded_at >= target_month_start
          and placement.recorded_at < target_month_end
          and placement.profile_id is not null
        group by placement.profile_id
      )
      select side.profile_id,
        count(*)::integer as matches_played,
        sum(side.win)::integer as wins,
        sum(side.frame_difference)::integer as frame_difference,
        (sum(side.win) * 3
          + greatest(sum(side.frame_difference), 0)
          + coalesce(max(placement_bonus.bonus), 0))::integer as mvp_score
      from match_sides as side
      join public.club_members as member
        on member.club_id = club_row.id and member.user_id = side.profile_id
      left join placement_bonus on placement_bonus.profile_id = side.profile_id
      group by side.profile_id
      having count(*) >= 3
    ) as scored
    order by scored.mvp_score desc, scored.wins desc,
      scored.frame_difference desc, scored.matches_played desc, scored.profile_id
    limit 1;

    if mvp_row.profile_id is not null then
      insert into public.club_achievements (
        club_id, recipient_id, awarded_by, kind, title, description,
        awarded_on, is_featured, source, source_key
      ) values (
        club_row.id,
        mvp_row.profile_id,
        null,
        'contribution',
        'Club MVP — ' || to_char(target_month_start at time zone 'Africa/Nairobi', 'FMMonth YYYY'),
        format(
          'Automatically selected from verified results: %s wins in %s matches, frame difference %s and an MVP score of %s.',
          mvp_row.wins, mvp_row.matches_played, mvp_row.frame_difference, mvp_row.mvp_score
        ),
        ((target_month_end at time zone 'Africa/Nairobi')::date - 1),
        true,
        'system',
        'mvp:' || to_char(target_month_start at time zone 'Africa/Nairobi', 'YYYY-MM')
      ) on conflict (club_id, source_key) where source = 'system' do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function private.refresh_automatic_club_recognition(timestamptz)
  from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'cuebracket-club-recognition-daily',
  '15 0 * * *',
  'select private.refresh_automatic_club_recognition();'
);

-- Backfill any milestones and the last completed monthly MVP immediately.
select private.refresh_automatic_club_recognition();
