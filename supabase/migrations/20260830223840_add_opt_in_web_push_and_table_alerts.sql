-- Phase 4G: opt-in Web Push. Signing credentials stay in Vault, never in source.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.push_settings (
  id boolean primary key default true check (id),
  public_key text,
  private_key_id uuid,
  hook_token_id uuid not null
);
alter table public.push_settings enable row level security;
revoke all on public.push_settings from public, anon, authenticated;
grant select, update on public.push_settings to service_role;
insert into public.push_settings (hook_token_id)
values (vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'cuebracket_push_hook'));

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 10 and 2048),
  p256dh text not null check (length(p256dh)=87),
  auth text not null check (length(auth)=22),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_test_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create policy "Read own push devices" on public.push_subscriptions for select to authenticated using (user_id=(select auth.uid()));
create policy "Remove own push devices" on public.push_subscriptions for delete to authenticated using (user_id=(select auth.uid()));

create table public.push_delivery_jobs (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  notification_version timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','sent','skipped','failed')),
  attempts smallint not null default 0 check(attempts between 0 and 3),
  available_at timestamptz not null default now(),
  unique(notification_id,subscription_id,notification_version)
);
create index push_jobs_ready_idx on public.push_delivery_jobs(available_at) where status='pending' and attempts<3;
create index push_jobs_subscription_idx on public.push_delivery_jobs(subscription_id);
alter table public.push_delivery_jobs enable row level security;
revoke all on public.push_delivery_jobs from public, anon, authenticated;
grant all on public.push_delivery_jobs to service_role;
grant usage, select on sequence public.push_delivery_jobs_id_seq to service_role;

create function private.get_push_server_config() returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('public_key',s.public_key,'private_key',k.decrypted_secret,'hook_token',h.decrypted_secret)
  from public.push_settings s join vault.decrypted_secrets h on h.id=s.hook_token_id
  left join vault.decrypted_secrets k on k.id=s.private_key_id where s.id;
$$;
create function private.initialize_push_keys(public_key text,private_key text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.push_settings where id for update;
  if not exists(select 1 from public.push_settings s where s.public_key is not null) then
    if public_key !~ '^[A-Za-z0-9_-]{87}$' or private_key !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Invalid signing keys'; end if;
    update public.push_settings set public_key=initialize_push_keys.public_key,
      private_key_id=vault.create_secret(private_key,'cuebracket_push_vapid_private') where id;
  end if;
  return private.get_push_server_config();
end; $$;
revoke all on function private.get_push_server_config() from public,anon,authenticated;
revoke all on function private.initialize_push_keys(text,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.get_push_server_config(),private.initialize_push_keys(text,text) to service_role;
create function public.get_push_server_config() returns jsonb language sql security invoker set search_path='' as $$ select private.get_push_server_config(); $$;
create function public.initialize_push_keys(public_key text,private_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.initialize_push_keys(public_key,private_key); $$;
revoke all on function public.get_push_server_config(),public.initialize_push_keys(text,text) from public,anon,authenticated;
grant execute on function public.get_push_server_config(),public.initialize_push_keys(text,text) to service_role;

create function public.save_push_subscription(account_id uuid,push_endpoint text,public_key text,auth_key text) returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.push_subscriptions; result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));
  select * into existing from public.push_subscriptions where endpoint=push_endpoint for update;
  if found then
    if existing.user_id<>account_id then raise exception 'Subscription belongs to another account'; end if;
    update public.push_subscriptions set p256dh=public_key,auth=auth_key,updated_at=now() where id=existing.id;
    return existing.id;
  end if;
  if (select count(*) from public.push_subscriptions where user_id=account_id)>=5 then raise exception 'Limit of five push devices reached'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(account_id,push_endpoint,public_key,auth_key) returning id into result;
  return result;
end; $$;
create function public.claim_push_test(account_id uuid,push_endpoint text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.push_subscriptions;
begin
  update public.push_subscriptions set last_test_at=now() where user_id=account_id and endpoint=push_endpoint
    and (last_test_at is null or last_test_at<now()-interval '1 minute') returning * into result;
  if not found then return null; end if;
  return to_jsonb(result);
end; $$;
create function public.claim_push_jobs() returns setof public.push_delivery_jobs language sql security invoker set search_path='' as $$
  update public.push_delivery_jobs j set attempts=j.attempts+1,available_at=now()+interval '2 minutes'
  where j.id in (select id from public.push_delivery_jobs where status='pending' and attempts<3 and available_at<=now() order by available_at limit 10 for update skip locked)
  returning j.*;
$$;
revoke all on function public.save_push_subscription(uuid,text,text,text),public.claim_push_test(uuid,text),public.claim_push_jobs() from public,anon,authenticated;
grant execute on function public.save_push_subscription(uuid,text,text,text),public.claim_push_test(uuid,text),public.claim_push_jobs() to service_role;

create function private.wake_push_worker() returns void language plpgsql security definer set search_path='' as $$
declare hook_token text;
begin
  delete from public.push_delivery_jobs where expires_at<now()-interval '7 days';
  if not exists(select 1 from public.push_delivery_jobs where status='pending' and attempts<3 and available_at<=now()) then return; end if;
  select h.decrypted_secret into hook_token from public.push_settings s join vault.decrypted_secrets h on h.id=s.hook_token_id where s.id;
  perform net.http_post(url:='https://ctkgbzaypelqnkzhczpa.supabase.co/functions/v1/push-notifications',
    headers:=jsonb_build_object('Content-Type','application/json','x-cuebracket-push-token',hook_token),
    body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=1000);
end; $$;
revoke all on function private.wake_push_worker() from public,anon,authenticated;

create function private.queue_phone_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.read_at is not null then return new; end if;
  if tg_op='UPDATE' and new.created_at is not distinct from old.created_at then return new; end if;
  insert into public.push_delivery_jobs(notification_id,subscription_id,notification_version,expires_at)
  select new.id,s.id,new.created_at,new.created_at + case when new.type in ('match_live','table_assignment') then interval '10 minutes' else interval '24 hours' end
  from public.push_subscriptions s where s.user_id=new.user_id
  on conflict do nothing;
  -- Delivery failures never roll back scoring or registration updates.
  begin perform private.wake_push_worker(); exception when others then null; end;
  return new;
end; $$;
revoke all on function private.queue_phone_notification() from public,anon,authenticated;
create trigger queue_phone_notification after insert or update of created_at on public.notifications for each row execute function private.queue_phone_notification();
select cron.schedule('cuebracket-push-retries','* * * * *','select private.wake_push_worker()');

create function private.respect_notification_preferences() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.notification_preferences p where p.user_id=new.user_id and
    ((new.type='club_event' and not p.club_events) or
     (new.type in ('registration_status','membership_status') and not p.registration_updates) or
     (new.type in ('match_live','table_assignment') and not p.match_alerts))) then return null; end if;
  return new;
end; $$;
revoke all on function private.respect_notification_preferences() from public,anon,authenticated;
create trigger respect_notification_preferences before insert or update of created_at on public.notifications for each row execute function private.respect_notification_preferences();

-- Table notices use verified event participants, never the editable display label.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in ('club_event','registration_status','membership_status','match_live','table_assignment'));
create function private.notify_table_assignment() returns trigger language plpgsql security definer set search_path='' as $$
declare event_data jsonb; match_data jsonb; participant jsonb; recipient uuid; recipient_ids uuid[]:='{}'; event_owner uuid; event_club uuid;
begin
  if new.active_event_id is null or new.status not in ('reserved','playing') then return new; end if;
  if tg_op='UPDATE' and new.active_event_id is not distinct from old.active_event_id and new.active_match_id is not distinct from old.active_match_id and new.status is not distinct from old.status then return new; end if;
  if new.active_event_type='tournament' then
    select jsonb_build_object('bracket',t.bracket,'competition',t.competition),t.owner_id,t.club_id into event_data,event_owner,event_club from public.cloud_tournaments t where t.id=new.active_event_id;
    match_data:=jsonb_path_query_first(event_data,'$.** ? (@.id == $match)',jsonb_build_object('match',new.active_match_id));
    if match_data->>'player1' is null or match_data->>'player2' is null then return new; end if;
    select array_agg(distinct r.profile_id) into recipient_ids from public.event_registrations r
      where r.tournament_id=new.active_event_id and r.profile_id is not null and r.status in ('approved','checked_in')
      and lower(btrim(r.display_name)) in (lower(btrim(match_data->>'player1')),lower(btrim(match_data->>'player2')));
  elsif new.active_event_type='league' then
    select l.payload,l.owner_id,l.club_id into event_data,event_owner,event_club from public.cloud_leagues l where l.id=new.active_event_id;
    match_data:=jsonb_path_query_first(event_data,'$.** ? (@.id == $match)',jsonb_build_object('match',new.active_match_id));
    for participant in select value from jsonb_array_elements(coalesce(event_data->'players','[]'::jsonb)) loop
      if participant->>'id' in (coalesce(match_data->>'homePlayerId',match_data->>'player1Id'),coalesce(match_data->>'awayPlayerId',match_data->>'player2Id'))
        and participant->>'profileId' ~ '^[0-9a-fA-F-]{36}$' then recipient_ids:=array_append(recipient_ids,(participant->>'profileId')::uuid); end if;
    end loop;
  end if;
  -- Updating an unrelated table must not permit notifications for another organizer's event.
  if event_owner is null or not coalesce((auth.uid()=event_owner or (event_club is not null and private.is_club_admin(event_club)) or
    (new.active_event_type='tournament' and exists(select 1 from public.tournament_collaborators c where c.tournament_id=new.active_event_id and c.user_id=auth.uid() and c.status='accepted'))),false) then return new; end if;
  foreach recipient in array coalesce(recipient_ids,'{}') loop
    if exists(select 1 from public.notification_preferences where user_id=recipient and not match_alerts) then continue; end if;
    insert into public.notifications(user_id,type,title,message,href,metadata,dedupe_key)
      select recipient,'table_assignment','Your table is ready',left(new.name||case when new.status='reserved' then ' has been reserved for your match.' else ' is now playing your match.' end,500),'/notifications',
      jsonb_build_object('table_id',new.id,'event_type',new.active_event_type,'event_id',new.active_event_id,'match_id',new.active_match_id),
      'table:'||new.id||':'||new.active_event_id||':'||new.active_match_id||':'||new.status
      where exists(select 1 from auth.users where id=recipient)
      on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  end loop;
  return new;
end; $$;
revoke all on function private.notify_table_assignment() from public,anon,authenticated;
create trigger notify_table_assignment after insert or update of active_event_id,active_match_id,status on public.venue_tables for each row execute function private.notify_table_assignment();
