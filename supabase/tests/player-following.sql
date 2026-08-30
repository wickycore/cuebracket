-- Run as postgres in a single request. All synthetic users and events roll back.
-- No real scores, memberships, subscribers or user preferences are touched.
begin;
do $$
#variable_conflict use_column
<<player_following>>
declare
  organizer uuid:=gen_random_uuid(); player_a uuid:=gen_random_uuid(); player_b uuid:=gen_random_uuid();
  follower uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); club uuid:=gen_random_uuid();
  event_id text:='follow-test-'||gen_random_uuid(); league_id text:='follow-league-'||gen_random_uuid();
  notification uuid; table_id bigint; blocked boolean;
begin
  insert into auth.users(id) values(organizer),(player_a),(player_b),(follower),(outsider);
  insert into public.profiles(id) values(organizer),(player_a),(player_b),(follower),(outsider) on conflict(id) do nothing;
  update public.profiles set username='test_'||left(replace(id::text,'-',''),18),is_public=true where id in (player_a,player_b);
  perform set_config('request.jwt.claim.sub',organizer::text,true);
  insert into public.clubs(id,owner_id,name,slug) values(club,organizer,'Isolated test club','test-'||left(replace(club::text,'-',''),20));
  insert into public.cloud_tournaments(id,owner_id,club_id,name,format,bracket_size,status,is_public)
    values(event_id,organizer,club,'Isolated test cup','single',2,'live',true);
  insert into public.event_registration_settings(tournament_id,owner_id,event_name,format,race_to,capacity,club_id)
    values(event_id,organizer,'Isolated test cup','single',5,2,club);
  insert into public.event_registrations(tournament_id,profile_id,display_name,status,source)
    values(event_id,player_a,'Player A','approved','organizer'),(event_id,player_b,'Player B','approved','organizer');

  perform set_config('request.jwt.claim.sub',follower::text,true);
  execute 'set local role authenticated';
  insert into public.player_followers(user_id,player_id) values(follower,player_a);
  assert (select not notify_live from public.player_followers where player_id=player_a), 'Alerts must default off';
  update public.player_followers set notify_live=true where player_id=player_a;
  insert into public.player_followers(user_id,player_id,notify_live) values(follower,player_b,true);
  blocked:=false;
  begin insert into public.player_followers(user_id,player_id) values(outsider,player_a); exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Cannot follow on behalf of another account';
  blocked:=false;
  begin update public.player_followers set user_id=outsider; exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Follower ownership is immutable';
  blocked:=false;
  begin insert into public.club_guides(club_id,rules) values(club,'Unauthorized'); exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Non-admin cannot edit club guide';
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',organizer::text,true);
  execute 'set local role authenticated';
  insert into public.club_guides(club_id,opening_hours,rules) values(club,'Monday 9–5','Test rules');
  update public.club_guides set rules='Updated rules' where club_id=club;
  assert (select rules='Updated rules' from public.club_guides where club_id=club),'Admin guide write works';
  execute 'reset role';

  update public.cloud_tournaments set bracket='{"rounds":[{"matches":[{"id":"m1","player1":"Player A","player2":"Player B","completed":false,"score1":1,"score2":0,"startedAt":"2026-08-30T10:00:00Z"}]}]}' where id=event_id;
  assert (select count(*)=2 from public.player_live_matches where event_id=player_following.event_id and ended_at is null),'Two linked participants on live watchboard';
  select id into notification from public.notifications where user_id=follower and type='followed_player_live';
  assert notification is not null,'Follower received automatic inbox alert';
  assert (select count(*)=1 from public.notifications where user_id=follower and type='followed_player_live'),'Following both opponents deduplicates alerts';
  assert public.can_deliver_player_notification(notification),'Current public opted-in match can dispatch';
  update public.cloud_tournaments set bracket=jsonb_set(bracket,'{rounds,0,matches,0,score1}','2') where id=event_id;
  assert (select count(*)=1 from public.notifications where user_id=follower and type='followed_player_live'),'Score updates never repeat alerts';

  execute 'set local role anon';
  assert (select count(*)=2 from public.player_live_matches where event_id=player_following.event_id),'Public live scores readable without login';
  blocked:=false;
  begin perform 1 from public.player_followers; exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Public users cannot read follower lists';
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  execute 'set local role authenticated';
  assert (select count(*)=0 from public.player_followers),'Other accounts cannot read following list';
  execute 'reset role';

  update public.player_followers set notify_live=false where user_id=follower;
  assert not public.can_deliver_player_notification(notification),'Muted alerts cannot dispatch';
  update public.player_followers set notify_live=true where user_id=follower;
  update public.profiles set is_public=false where id in (player_a,player_b);
  assert not public.can_deliver_player_notification(notification),'Private profiles stop queued delivery';
  execute 'set local role anon';
  assert (select count(*)=0 from public.player_live_matches where event_id=player_following.event_id),'Private player matches hidden';
  execute 'reset role';
  update public.profiles set is_public=true where id in (player_a,player_b);
  perform set_config('request.jwt.claim.sub',organizer::text,true);
  update public.cloud_tournaments set is_public=false where id=event_id;
  assert not public.can_deliver_player_notification(notification),'Private events stop queued delivery';
  update public.cloud_tournaments set is_public=true,bracket=jsonb_set(bracket,'{rounds,0,matches,0,completed}','true') where id=event_id;
  assert not public.can_deliver_player_notification(notification),'Finished match cannot dispatch';

  perform set_config('request.jwt.claim.sub',organizer::text,true);
  insert into public.cloud_leagues(id,owner_id,club_id,name,payload,is_public) values(league_id,organizer,club,'Isolated league',jsonb_build_object('status','live','players',jsonb_build_array(jsonb_build_object('id','a','name','Player A','profileId',player_a),jsonb_build_object('id','b','name','Player B','profileId',player_b)),'fixtures',jsonb_build_array(jsonb_build_object('id','fixture1','homePlayerId','a','awayPlayerId','b','completed',false))),true);
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  execute 'set local role authenticated';
  insert into public.venue_tables(name) values('Unrelated table') returning id into table_id;
  update public.venue_tables set status='playing',active_event_type='league',active_event_id=league_id,active_match_id='fixture1' where id=table_id;
  execute 'reset role';
  assert (select count(*)=0 from public.player_live_matches where event_id=league_id and ended_at is null),'Unrelated table owner cannot spoof a live match';
  perform set_config('request.jwt.claim.sub',organizer::text,true);
  insert into public.venue_tables(owner_id,club_id,name,status,active_event_type,active_event_id,active_match_id) values(organizer,club,'Test table','reserved','league',league_id,'fixture1') returning id into table_id;
  assert (select count(*)=0 from public.player_live_matches where event_id=league_id and ended_at is null),'Reserved table is not live';
  update public.venue_tables set status='playing' where id=table_id;
  assert (select count(*)=2 from public.player_live_matches where event_id=league_id and ended_at is null),'Linked league participants go live on playing table';
  update public.venue_tables set status='available',active_event_type=null,active_event_id=null,active_match_id=null where id=table_id;
  assert (select count(*)=0 from public.player_live_matches where event_id=league_id and ended_at is null),'Released league table leaves watchboard';
end;
$$;
rollback;
select 'PASS: following, privacy, deduplication, guide roles, tournament and league lifecycle; fixtures rolled back' as result;
