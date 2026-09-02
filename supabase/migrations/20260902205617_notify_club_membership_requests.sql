-- Notify club organizers as soon as a player asks to join.
create or replace function private.notify_club_membership_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_name text;
  club_slug text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select name, slug
  into club_name, club_slug
  from public.clubs
  where id = new.club_id;

  insert into public.notifications (
    user_id, type, title, message, href, metadata, dedupe_key
  )
  select
    organizer.user_id,
    'membership_status',
    'New request for ' || club_name,
    new.request_name || ' wants to join your club.',
    '/clubs/' || club_slug || '/manage?section=people',
    jsonb_build_object(
      'club_id', new.club_id,
      'request_id', new.id,
      'status', new.status,
      'organizer_action', true
    ),
    'membership-request:' || new.id
  from (
    select club.owner_id as user_id
    from public.clubs as club
    where club.id = new.club_id
    union
    select member.user_id
    from public.club_members as member
    where member.club_id = new.club_id
      and member.role in ('owner', 'admin')
  ) as organizer
  where organizer.user_id <> new.user_id
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;
revoke all on function private.notify_club_membership_request() from public, anon, authenticated;

drop trigger if exists notify_club_membership_request on public.club_membership_requests;
create trigger notify_club_membership_request
  after insert on public.club_membership_requests
  for each row execute procedure private.notify_club_membership_request();

-- Make any request that was already waiting visible in the organizer inbox.
insert into public.notifications (
  user_id, type, title, message, href, metadata, dedupe_key
)
select
  organizer.user_id,
  'membership_status',
  'New request for ' || club.name,
  request.request_name || ' wants to join your club.',
  '/clubs/' || club.slug || '/manage?section=people',
  jsonb_build_object(
    'club_id', request.club_id,
    'request_id', request.id,
    'status', request.status,
    'organizer_action', true
  ),
  'membership-request:' || request.id
from public.club_membership_requests as request
join public.clubs as club on club.id = request.club_id
cross join lateral (
  select club.owner_id as user_id
  union
  select member.user_id
  from public.club_members as member
  where member.club_id = request.club_id
    and member.role in ('owner', 'admin')
) as organizer
where request.status = 'pending'
  and organizer.user_id <> request.user_id
on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
