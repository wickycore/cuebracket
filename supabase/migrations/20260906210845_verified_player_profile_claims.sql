-- Verified ownership claims for guest tournament entries.
-- A name is never enough to attach results: the tournament organizer must approve.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'club_event', 'registration_status', 'membership_status', 'match_live',
    'table_assignment', 'followed_player_live', 'delivery_test',
    'club_message', 'club_reminder', 'profile_claim'
  ));

create table public.player_profile_claims (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.cloud_tournaments(id) on delete cascade,
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  participant_name text not null check (char_length(btrim(participant_name)) between 1 and 80),
  claimant_name text not null check (char_length(btrim(claimant_name)) between 1 and 80),
  claimant_username text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index player_profile_claims_tournament_status_idx
  on public.player_profile_claims (tournament_id, status, created_at desc);
create index player_profile_claims_claimant_idx
  on public.player_profile_claims (claimant_id, created_at desc);
create unique index player_profile_claims_one_pending_entry_idx
  on public.player_profile_claims (registration_id, claimant_id)
  where status = 'pending';
create unique index player_profile_claims_one_pending_tournament_idx
  on public.player_profile_claims (tournament_id, claimant_id)
  where status = 'pending';

alter table public.player_profile_claims enable row level security;

create policy "Claimants and tournament organizers read profile claims"
  on public.player_profile_claims for select to authenticated
  using (
    claimant_id = (select auth.uid())
    or private.can_manage_tournament(tournament_id)
  );

create policy "Players request their own profile claim"
  on public.player_profile_claims for insert to authenticated
  with check (
    claimant_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "Claimants withdraw pending profile claims"
  on public.player_profile_claims for update to authenticated
  using (claimant_id = (select auth.uid()) and status = 'pending')
  with check (claimant_id = (select auth.uid()) and status = 'withdrawn');

create policy "Tournament organizers review profile claims"
  on public.player_profile_claims for update to authenticated
  using (private.can_manage_tournament(tournament_id) and status = 'pending')
  with check (
    private.can_manage_tournament(tournament_id)
    and status in ('approved', 'rejected')
  );

revoke all on table public.player_profile_claims from public, anon, authenticated;
grant select, insert, update on table public.player_profile_claims to authenticated;
grant all on table public.player_profile_claims to service_role;

create or replace function private.prepare_player_profile_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  registration_row public.event_registrations%rowtype;
  claimant_profile public.profiles%rowtype;
begin
  if actor_id is null then
    raise exception 'Sign in to claim a tournament entry.';
  end if;

  if tg_op = 'INSERT' then
    if new.claimant_id <> actor_id then
      raise exception 'You can only request a claim for your own profile.';
    end if;

    select * into registration_row
    from public.event_registrations
    where id = new.registration_id and tournament_id = new.tournament_id;

    if not found or registration_row.status not in ('approved', 'checked_in') then
      raise exception 'This tournament entry is not available to claim.';
    end if;
    if registration_row.profile_id is not null then
      raise exception 'This tournament entry is already linked to a player.';
    end if;
    if exists (
      select 1 from public.event_registrations
      where tournament_id = new.tournament_id and profile_id = actor_id
    ) then
      raise exception 'Your profile is already linked to this tournament.';
    end if;
    if (
      select count(*) from public.player_profile_claims
      where claimant_id = actor_id and created_at > now() - interval '24 hours'
    ) >= 5 then
      raise exception 'Too many claim requests. Please try again tomorrow.';
    end if;

    select * into claimant_profile from public.profiles where id = actor_id;
    if not found then
      raise exception 'Complete your CueBracket profile before requesting verification.';
    end if;

    new.participant_name := registration_row.display_name;
    new.claimant_name := coalesce(nullif(btrim(claimant_profile.display_name), ''), claimant_profile.tournament_name, 'CueBracket player');
    new.claimant_username := nullif(btrim(claimant_profile.username), '');
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id
    or new.tournament_id <> old.tournament_id
    or new.registration_id <> old.registration_id
    or new.claimant_id <> old.claimant_id
    or new.participant_name <> old.participant_name
    or new.claimant_name <> old.claimant_name
    or new.claimant_username is distinct from old.claimant_username
    or new.created_at <> old.created_at then
    raise exception 'Claim identity fields cannot be changed.';
  end if;

  if actor_id = old.claimant_id then
    if old.status <> 'pending' or new.status <> 'withdrawn' then
      raise exception 'You can only withdraw a pending claim.';
    end if;
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif private.can_manage_tournament(old.tournament_id) then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Organizers can only approve or reject pending claims.';
    end if;
    new.reviewed_by := actor_id;
    new.reviewed_at := now();
  else
    raise exception 'You cannot review this claim.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.prepare_player_profile_claim() from public, anon, authenticated;

create trigger prepare_player_profile_claim
  before insert or update on public.player_profile_claims
  for each row execute function private.prepare_player_profile_claim();

create or replace function private.finish_player_profile_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organizer_id uuid;
  affected integer;
begin
  if tg_op = 'INSERT' then
    for organizer_id in
      select tournament.owner_id from public.cloud_tournaments tournament
      where tournament.id = new.tournament_id
      union
      select collaborator.user_id from public.tournament_collaborators collaborator
      where collaborator.tournament_id = new.tournament_id and collaborator.status = 'accepted'
      union
      select member.user_id
      from public.cloud_tournaments tournament
      join public.club_members member on member.club_id = tournament.club_id
      where tournament.id = new.tournament_id and member.role in ('owner', 'admin')
    loop
      if organizer_id <> new.claimant_id then
        insert into public.notifications (user_id, type, title, message, href, metadata, dedupe_key)
        values (
          organizer_id, 'profile_claim', 'Player profile claim',
          new.claimant_name || ' asked to claim ' || new.participant_name || '.',
          '/tournaments/' || new.tournament_id,
          jsonb_build_object('claim_id', new.id, 'registration_id', new.registration_id),
          'profile-claim-request:' || new.id::text
        ) on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
    end loop;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'approved' then
    update public.event_registrations
    set profile_id = new.claimant_id, updated_at = now()
    where id = new.registration_id
      and tournament_id = new.tournament_id
      and profile_id is null
      and status in ('approved', 'checked_in');
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'This tournament entry can no longer be linked.';
    end if;

    update public.player_profile_claims
    set status = 'rejected', reviewed_by = new.reviewed_by,
        reviewed_at = now(), updated_at = now()
    where registration_id = new.registration_id
      and id <> new.id and status = 'pending';

    insert into public.notifications (user_id, type, title, message, href, metadata, dedupe_key)
    values (
      new.claimant_id, 'profile_claim', 'Tournament record linked',
      new.participant_name || ' is now linked to your CueBracket profile.',
      '/players/' || coalesce(new.claimant_username, new.claimant_id::text),
      jsonb_build_object('claim_id', new.id, 'tournament_id', new.tournament_id),
      'profile-claim-approved:' || new.id::text
    ) on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  elsif old.status = 'pending' and new.status = 'rejected' then
    insert into public.notifications (user_id, type, title, message, href, metadata, dedupe_key)
    values (
      new.claimant_id, 'profile_claim', 'Profile claim not approved',
      'The organizer did not link ' || new.participant_name || ' to your profile.',
      '/cloud/live/' || new.tournament_id || '/players/' || replace(new.participant_name, ' ', '%20'),
      jsonb_build_object('claim_id', new.id, 'tournament_id', new.tournament_id),
      'profile-claim-rejected:' || new.id::text
    ) on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.finish_player_profile_claim() from public, anon, authenticated;

create trigger finish_player_profile_claim
  after insert or update of status on public.player_profile_claims
  for each row execute function private.finish_player_profile_claim();

do $$
begin
  alter publication supabase_realtime add table public.player_profile_claims;
exception when duplicate_object then null;
end;
$$;
