-- Phase 4H: private following lists, public live watchboards and club guides.
create table public.player_followers (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  notify_live boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(user_id, player_id),
  check(user_id <> player_id)
);
create index player_followers_player_idx on public.player_followers(player_id);
alter table public.player_followers enable row level security;
revoke all on public.player_followers from public, anon, authenticated;
grant select, delete on public.player_followers to authenticated;
grant insert(user_id, player_id, notify_live), update(notify_live) on public.player_followers to authenticated;
grant all on public.player_followers to service_role;
create policy "Own following list" on public.player_followers for select to authenticated using(user_id=(select auth.uid()));
create policy "Follow public players" on public.player_followers for insert to authenticated with check(
  user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=player_id and p.is_public and p.username is not null)
);
create policy "Change own player alerts" on public.player_followers for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Unfollow players" on public.player_followers for delete to authenticated using(user_id=(select auth.uid()));

alter table public.notification_preferences add column followed_player_alerts boolean not null default true;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in ('club_event','registration_status','membership_status','match_live','table_assignment','followed_player_live','delivery_test'));

create table public.club_guides (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  opening_hours text not null default '' check(length(opening_hours)<=500),
  rules text not null default '' check(length(rules)<=3000),
  updated_at timestamptz not null default now()
);
alter table public.club_guides enable row level security;
revoke all on public.club_guides from public, anon, authenticated;
grant select on public.club_guides to anon, authenticated;
grant insert(club_id,opening_hours,rules), update(opening_hours,rules) on public.club_guides to authenticated;
grant all on public.club_guides to service_role;
create policy "Read club guide" on public.club_guides for select to anon,authenticated using(
  exists(select 1 from public.clubs c where c.id=club_id and c.is_public) or (select private.is_club_admin(club_id))
);
create policy "Admins create guide" on public.club_guides for insert to authenticated with check((select private.is_club_admin(club_id)));
create policy "Admins edit guide" on public.club_guides for update to authenticated using((select private.is_club_admin(club_id))) with check((select private.is_club_admin(club_id)));
create function private.stamp_club_guide() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end; $$;
revoke all on function private.stamp_club_guide() from public,anon,authenticated;
create trigger stamp_club_guide before update on public.club_guides for each row execute function private.stamp_club_guide();

-- Server-maintained projection; names and profile links are never supplied by followers.
create table public.player_live_matches (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check(event_type in ('tournament','league')),
  event_id text not null,
  match_key text not null,
  club_id uuid references public.clubs(id) on delete set null,
  event_name text not null,
  player1 text not null,
  player2 text not null,
  score1 integer,
  score2 integer,
  table_name text,
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key(event_type,event_id,match_key,profile_id)
);
create index player_live_matches_profile_idx on public.player_live_matches(profile_id) where ended_at is null;
create index player_live_matches_club_idx on public.player_live_matches(club_id) where ended_at is null;
create index player_live_matches_profile_fk_idx on public.player_live_matches(profile_id);
alter table public.player_live_matches enable row level security;
revoke all on public.player_live_matches from public,anon,authenticated;
grant select on public.player_live_matches to anon,authenticated;
grant all on public.player_live_matches to service_role;
create policy "Only public ongoing matches" on public.player_live_matches for select to anon,authenticated using(
  ended_at is null
  and exists(select 1 from public.profiles p where p.id=profile_id and p.is_public and p.username is not null)
  and (
    (event_type='tournament' and exists(select 1 from public.cloud_tournaments t where t.id=event_id and t.is_public and t.status='live'))
    or (event_type='league' and exists(select 1 from public.cloud_leagues l where l.id=event_id and l.is_public and l.payload->>'status'='live'))
  )
);

create function private.refresh_player_live_matches(kind text, target text) returns void language plpgsql security definer set search_path='' as $$
declare
  source jsonb; event_title text; club uuid; m jsonb; person uuid; p1 text; p2 text;
  linked1 jsonb; linked2 jsonb; table_label text; score_a text; score_b text;
begin
  -- A source event's writes serialize naturally; table assignments can arrive concurrently.
  perform pg_advisory_xact_lock(hashtextextended('player-live:'||kind||':'||target,0));
  update public.player_live_matches set ended_at=now(),updated_at=now() where event_type=kind and event_id=target and ended_at is null;
  if kind='tournament' then
    select jsonb_build_object('bracket',t.bracket,'competition',t.competition),t.name,t.club_id
      into source,event_title,club from public.cloud_tournaments t where t.id=target and t.is_public and t.status='live';
  else
    select l.payload,l.name,l.club_id into source,event_title,club from public.cloud_leagues l where l.id=target and l.is_public and l.payload->>'status'='live';
  end if;
  if source is null then return; end if;
  for m in select distinct on (value->>'id') value from jsonb_path_query(source,'strict $.** ? (exists (@.id) && @.completed == false)') value order by value->>'id'
  loop
    select v.name into table_label from public.venue_tables v
      where v.active_event_type=kind and v.active_event_id=target and v.active_match_id=m->>'id' and v.status='playing'
      order by v.id limit 1;
    if kind='tournament' then
      if nullif(m->>'startedAt','') is null and table_label is null then continue; end if;
      p1:=m->>'player1'; p2:=m->>'player2'; score_a:=m->>'score1'; score_b:=m->>'score2';
    else
      if table_label is null then continue; end if;
      select value into linked1 from jsonb_array_elements(coalesce(source->'players','[]')) value where value->>'id'=coalesce(m->>'homePlayerId',m->>'player1Id') limit 1;
      select value into linked2 from jsonb_array_elements(coalesce(source->'players','[]')) value where value->>'id'=coalesce(m->>'awayPlayerId',m->>'player2Id') limit 1;
      p1:=linked1->>'name'; p2:=linked2->>'name';
      score_a:=coalesce(m->>'homeScore',m->>'score1'); score_b:=coalesce(m->>'awayScore',m->>'score2');
    end if;
    if nullif(p1,'') is null or nullif(p2,'') is null then continue; end if;
    for person in
      select p.id from public.profiles p where p.is_public and p.username is not null and (
        (kind='tournament' and exists(
          select 1 from public.event_registrations r where r.tournament_id=target and r.profile_id=p.id
            and r.status in ('approved','checked_in') and r.display_name in (p1,p2)
            and 1=(select count(*) from public.event_registrations other where other.tournament_id=target and other.display_name=r.display_name and other.status in ('approved','checked_in'))
        )) or (kind='league' and p.id::text in (linked1->>'profileId',linked2->>'profileId'))
      )
    loop
      insert into public.player_live_matches(profile_id,event_type,event_id,match_key,club_id,event_name,player1,player2,score1,score2,table_name)
      values(person,kind,target,m->>'id',club,event_title,p1,p2,
        case when score_a ~ '^[0-9]{1,6}$' then score_a::integer end,
        case when score_b ~ '^[0-9]{1,6}$' then score_b::integer end,table_label)
      on conflict(event_type,event_id,match_key,profile_id) do update set
        club_id=excluded.club_id,event_name=excluded.event_name,player1=excluded.player1,player2=excluded.player2,
        score1=excluded.score1,score2=excluded.score2,table_name=excluded.table_name,updated_at=now(),ended_at=null;
    end loop;
  end loop;
end; $$;
revoke all on function private.refresh_player_live_matches(text,text) from public,anon,authenticated;

create function private.refresh_player_live_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='venue_tables' then
    if tg_op<>'INSERT' and old.active_event_id is not null then perform private.refresh_player_live_matches(old.active_event_type,old.active_event_id); end if;
    if tg_op<>'DELETE' and new.active_event_id is not null then perform private.refresh_player_live_matches(new.active_event_type,new.active_event_id); end if;
  elsif tg_op='DELETE' then
    delete from public.player_live_matches where event_type=case when tg_table_name='cloud_tournaments' then 'tournament' else 'league' end and event_id=old.id;
  else
    perform private.refresh_player_live_matches(case when tg_table_name='cloud_tournaments' then 'tournament' else 'league' end,new.id);
  end if;
  return null;
end; $$;
revoke all on function private.refresh_player_live_source() from public,anon,authenticated;
create trigger refresh_player_live_tournament after insert or update or delete on public.cloud_tournaments for each row execute function private.refresh_player_live_source();
create trigger refresh_player_live_league after insert or update or delete on public.cloud_leagues for each row execute function private.refresh_player_live_source();
create trigger refresh_player_live_table after insert or update or delete on public.venue_tables for each row execute function private.refresh_player_live_source();

-- Backfill current public matches before installing the fan-out trigger: no historical alerts.
do $$ declare r record; begin
  for r in select id from public.cloud_tournaments where is_public and status='live' loop perform private.refresh_player_live_matches('tournament',r.id); end loop;
  for r in select id from public.cloud_leagues where is_public and payload->>'status'='live' loop perform private.refresh_player_live_matches('league',r.id); end loop;
end; $$;

create function private.notify_player_followers() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(user_id,type,title,message,href,metadata,dedupe_key)
  select f.user_id,'followed_player_live','A player you follow is live',
    'A followed player has started a public match. Open your watchboard for the current score.',
    '/following',jsonb_build_object('event_type',new.event_type,'event_id',new.event_id,'match_key',new.match_key),
    'followed-live:'||new.event_type||':'||new.event_id||':'||new.match_key
  from public.player_followers f left join public.notification_preferences prefs on prefs.user_id=f.user_id
  where f.player_id=new.profile_id and f.notify_live and coalesce(prefs.followed_player_alerts,true)
  on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  return null;
end; $$;
revoke all on function private.notify_player_followers() from public,anon,authenticated;
create trigger notify_player_followers after insert on public.player_live_matches for each row execute function private.notify_player_followers();

-- Recheck privacy, match state and opt-in immediately before dispatch, not just at enqueue.
create function public.can_deliver_player_notification(notification_id uuid) returns boolean language sql security invoker set search_path='' as $$
  select exists(
    select 1 from public.notifications n
    join public.player_live_matches live on live.event_type=n.metadata->>'event_type' and live.event_id=n.metadata->>'event_id' and live.match_key=n.metadata->>'match_key' and live.ended_at is null
    join public.player_followers f on f.user_id=n.user_id and f.player_id=live.profile_id and f.notify_live
    join public.profiles p on p.id=f.player_id and p.is_public and p.username is not null
    where n.id=notification_id and n.type='followed_player_live'
      and ((live.event_type='tournament' and exists(select 1 from public.cloud_tournaments t where t.id=live.event_id and t.is_public and t.status='live'))
        or (live.event_type='league' and exists(select 1 from public.cloud_leagues l where l.id=live.event_id and l.is_public and l.payload->>'status'='live')))
  );
$$;
revoke all on function public.can_deliver_player_notification(uuid) from public,anon,authenticated;
grant execute on function public.can_deliver_player_notification(uuid) to service_role;

-- Followed-player alerts expire promptly, like personal match alerts.
create or replace function private.queue_phone_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.read_at is not null then return new; end if;
  if tg_op='UPDATE' and new.created_at is not distinct from old.created_at then return new; end if;
  insert into public.push_delivery_jobs(notification_id,subscription_id,notification_version,expires_at)
  select new.id,s.id,new.created_at,new.created_at + case when new.type in ('match_live','table_assignment','followed_player_live','delivery_test') then interval '10 minutes' else interval '24 hours' end
  from public.push_subscriptions s where s.user_id=new.user_id
  on conflict(notification_id,subscription_id,notification_version) do nothing;
  begin perform private.wake_push_worker(); exception when others then null; end;
  return new;
end; $$;
