-- Phase 4L: targeted club communication, RSVP reminders and aggregate delivery tracking.
alter table public.notification_preferences
  add column club_messages boolean not null default true;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'club_event', 'registration_status', 'membership_status', 'match_live',
    'table_assignment', 'followed_player_live', 'delivery_test',
    'club_message', 'club_reminder'
  ));

create table public.club_broadcasts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  audience text not null check (audience in ('everyone', 'members', 'followers')),
  template text not null default 'general'
    check (template in ('general', 'tournament', 'meeting', 'venue', 'registration')),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  message text not null check (char_length(btrim(message)) between 3 and 500),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  opened_count integer not null default 0 check (opened_count between 0 and recipient_count),
  phone_sent_count integer not null default 0 check (phone_sent_count >= 0),
  phone_failed_count integer not null default 0 check (phone_failed_count >= 0),
  created_at timestamptz not null default now()
);

create index club_broadcasts_club_created_idx
  on public.club_broadcasts (club_id, created_at desc);
create index club_broadcasts_author_rate_idx
  on public.club_broadcasts (author_id, created_at desc);

alter table public.club_broadcasts enable row level security;
create policy "Club admins read broadcast delivery"
  on public.club_broadcasts for select to authenticated
  using (private.is_club_admin(club_id));

revoke all on table public.club_broadcasts from anon, authenticated;
grant select on table public.club_broadcasts to authenticated;
grant all on table public.club_broadcasts to service_role;

create table private.club_broadcast_receipts (
  broadcast_id uuid not null references public.club_broadcasts(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  opened_at timestamptz,
  primary key (broadcast_id, recipient_id),
  unique (notification_id)
);

create index club_broadcast_receipts_notification_idx
  on private.club_broadcast_receipts (notification_id);
alter table private.club_broadcast_receipts enable row level security;
revoke all on table private.club_broadcast_receipts from public, anon, authenticated;
grant all on table private.club_broadcast_receipts to service_role;

create or replace function private.respect_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.notification_preferences as preference
    where preference.user_id = new.user_id
      and (
        (new.type = 'club_event' and not preference.club_events)
        or (new.type in ('registration_status', 'membership_status') and not preference.registration_updates)
        or (new.type in ('match_live', 'table_assignment') and not preference.match_alerts)
        or (new.type = 'followed_player_live' and not preference.followed_player_alerts)
        or (new.type in ('club_message', 'club_reminder') and not preference.club_messages)
      )
  ) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function private.respect_notification_preferences()
  from public, anon, authenticated;

create or replace function public.send_club_broadcast(
  target_club uuid,
  target_audience text,
  message_template text,
  message_title text,
  message_body text
)
returns public.club_broadcasts
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := auth.uid();
  clean_title text := regexp_replace(btrim(message_title), '\s+', ' ', 'g');
  clean_body text := btrim(message_body);
  club_slug text;
  result public.club_broadcasts;
  delivered integer := 0;
begin
  if sender is null then
    raise exception 'Sign in to send a club update.';
  end if;
  if not private.is_club_admin(target_club) then
    raise exception 'Only club owners and admins can send club updates.';
  end if;
  if target_audience not in ('everyone', 'members', 'followers') then
    raise exception 'Choose a valid audience.';
  end if;
  if message_template not in ('general', 'tournament', 'meeting', 'venue', 'registration') then
    raise exception 'Choose a valid message template.';
  end if;
  if char_length(clean_title) not between 3 and 100
     or char_length(clean_body) not between 3 and 500 then
    raise exception 'Use a 3–100 character title and a 3–500 character message.';
  end if;
  if (
    select count(*)
    from public.club_broadcasts
    where club_id = target_club
      and author_id = sender
      and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Please wait before sending more club updates.';
  end if;

  select slug into club_slug from public.clubs where id = target_club;
  if club_slug is null then raise exception 'Club not found.'; end if;

  insert into public.club_broadcasts (
    club_id, author_id, audience, template, title, message
  ) values (
    target_club, sender, target_audience, message_template, clean_title, clean_body
  ) returning * into result;

  with audience as (
    select member.user_id
    from public.club_members as member
    where member.club_id = target_club
      and target_audience in ('everyone', 'members')
    union
    select follower.user_id
    from public.club_followers as follower
    where follower.club_id = target_club
      and target_audience in ('everyone', 'followers')
  ), inserted as (
    insert into public.notifications (
      user_id, type, title, message, href, metadata, dedupe_key
    )
    select
      audience.user_id,
      'club_message',
      clean_title,
      clean_body,
      '/clubs/' || club_slug || '?tab=clubhouse',
      jsonb_build_object(
        'club_id', target_club,
        'broadcast_id', result.id,
        'audience', target_audience,
        'template', message_template
      ),
      'club-message:' || result.id
    from audience
    where exists (select 1 from auth.users where id = audience.user_id)
      and not exists (
        select 1 from public.notification_preferences as preference
        where preference.user_id = audience.user_id and not preference.club_messages
      )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning id, user_id
  )
  insert into private.club_broadcast_receipts (
    broadcast_id, notification_id, recipient_id
  )
  select result.id, inserted.id, inserted.user_id from inserted;

  get diagnostics delivered = row_count;
  update public.club_broadcasts
    set recipient_count = delivered
    where id = result.id
    returning * into result;
  return result;
end;
$$;
revoke all on function public.send_club_broadcast(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.send_club_broadcast(uuid, text, text, text, text)
  to authenticated;

create or replace function private.refresh_club_broadcast_open_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_broadcast uuid;
begin
  if new.read_at is null or old.read_at is not null then return new; end if;
  update private.club_broadcast_receipts
    set opened_at = new.read_at
    where notification_id = new.id
    returning broadcast_id into target_broadcast;
  if target_broadcast is not null then
    update public.club_broadcasts
      set opened_count = (
        select count(*) from private.club_broadcast_receipts
        where broadcast_id = target_broadcast and opened_at is not null
      )
      where id = target_broadcast;
  end if;
  return new;
end;
$$;
revoke all on function private.refresh_club_broadcast_open_count()
  from public, anon, authenticated;
create trigger refresh_club_broadcast_open_count
  after update of read_at on public.notifications
  for each row execute function private.refresh_club_broadcast_open_count();

create or replace function private.refresh_club_broadcast_phone_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_broadcast uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select receipt.broadcast_id into target_broadcast
  from private.club_broadcast_receipts as receipt
  where receipt.notification_id = new.notification_id;
  if target_broadcast is null then return new; end if;

  update public.club_broadcasts
    set phone_sent_count = (
      select count(distinct receipt.notification_id)
      from private.club_broadcast_receipts as receipt
      join public.push_delivery_jobs as job
        on job.notification_id = receipt.notification_id
      where receipt.broadcast_id = target_broadcast and job.status = 'sent'
    ),
    phone_failed_count = (
      select count(*)
      from private.club_broadcast_receipts as receipt
      where receipt.broadcast_id = target_broadcast
        and exists (
          select 1 from public.push_delivery_jobs as job
          where job.notification_id = receipt.notification_id and job.status = 'failed'
        )
        and not exists (
          select 1 from public.push_delivery_jobs as job
          where job.notification_id = receipt.notification_id
            and job.status in ('pending', 'sent')
        )
    )
    where id = target_broadcast;
  return new;
end;
$$;
revoke all on function private.refresh_club_broadcast_phone_counts()
  from public, anon, authenticated;
create trigger refresh_club_broadcast_phone_counts
  after update of status on public.push_delivery_jobs
  for each row execute function private.refresh_club_broadcast_phone_counts();

create or replace function private.send_due_club_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivered integer := 0;
begin
  insert into public.notifications (
    user_id, type, title, message, href, metadata, dedupe_key
  )
  select
    rsvp.user_id,
    'club_reminder',
    case rsvp.response when 'going' then 'Your club event is coming up' else 'Club event reminder' end,
    left(event.title || ' starts within the next 24 hours at ' || coalesce(nullif(event.location, ''), club.name) || '.', 500),
    '/clubs/' || club.slug || '?tab=events',
    jsonb_build_object('club_id', club.id, 'event_id', event.id, 'response', rsvp.response),
    'club-reminder:' || event.id
  from public.club_calendar_events as event
  join public.clubs as club on club.id = event.club_id
  join public.club_calendar_rsvps as rsvp on rsvp.event_id = event.id
  where not event.is_cancelled
    and event.starts_at > now()
    and event.starts_at <= now() + interval '24 hours'
    and rsvp.response in ('going', 'maybe')
    and not exists (
      select 1 from public.notification_preferences as preference
      where preference.user_id = rsvp.user_id and not preference.club_messages
    )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics delivered = row_count;
  return delivered;
end;
$$;
revoke all on function private.send_due_club_reminders()
  from public, anon, authenticated;

select cron.schedule(
  'cuebracket-club-reminders',
  '*/15 * * * *',
  'select private.send_due_club_reminders()'
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_broadcasts'
  ) then
    alter publication supabase_realtime add table public.club_broadcasts;
  end if;
end;
$$;
