-- Only authorized table owners may project another event onto the public watchboard.
create or replace function private.refresh_player_live_matches(kind text, target text) returns void language plpgsql security definer set search_path='' as $$
declare
  source jsonb; event_title text; club uuid; event_owner uuid; m jsonb; person uuid; p1 text; p2 text;
  linked1 jsonb; linked2 jsonb; table_label text; score_a text; score_b text;
begin
  -- A source event's writes serialize naturally; table assignments can arrive concurrently.
  perform pg_advisory_xact_lock(hashtextextended('player-live:'||kind||':'||target,0));
  update public.player_live_matches set ended_at=now(),updated_at=now() where event_type=kind and event_id=target and ended_at is null;
  if kind='tournament' then
    select jsonb_build_object('bracket',t.bracket,'competition',t.competition),t.name,t.club_id,t.owner_id
      into source,event_title,club,event_owner from public.cloud_tournaments t where t.id=target and t.is_public and t.status='live';
  else
    select l.payload,l.name,l.club_id,l.owner_id into source,event_title,club,event_owner from public.cloud_leagues l where l.id=target and l.is_public and l.payload->>'status'='live';
  end if;
  if source is null then return; end if;
  for m in select distinct on (value->>'id') value from jsonb_path_query(source,'strict $.** ? (exists (@.id) && @.completed == false)') value order by value->>'id'
  loop
    select v.name into table_label from public.venue_tables v
      where v.active_event_type=kind and v.active_event_id=target and v.active_match_id=m->>'id' and v.status='playing'
      and (
        v.owner_id=event_owner
        or (v.club_id=club and (
          exists(select 1 from public.clubs c where c.id=club and c.owner_id=v.owner_id)
          or exists(select 1 from public.club_members cm where cm.club_id=club and cm.user_id=v.owner_id and cm.role in ('owner','admin'))
        ))
        or (kind='tournament' and exists(select 1 from public.tournament_collaborators c where c.tournament_id=target and c.user_id=v.owner_id and c.status='accepted'))
      )
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
            and r.status in ('approved','checked_in') and lower(btrim(r.display_name)) in (lower(btrim(p1)),lower(btrim(p2)))
            and 1=(select count(*) from public.event_registrations other where other.tournament_id=target and lower(btrim(other.display_name))=lower(btrim(r.display_name)) and other.status in ('approved','checked_in'))
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
