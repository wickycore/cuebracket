-- Premium club experience: public gallery, achievement stories and private moderation.

alter table public.club_achievements
  add column if not exists recipient_name text;

update public.club_achievements as achievement
set recipient_name = coalesce(
  nullif(btrim(profile.tournament_name), ''),
  nullif(btrim(profile.display_name), ''),
  'Club member'
)
from public.profiles as profile
where profile.id = achievement.recipient_id
  and achievement.recipient_name is null;

update public.club_achievements
set recipient_name = 'Club member'
where recipient_name is null;

alter table public.club_achievements
  alter column recipient_name set not null,
  add constraint club_achievements_recipient_name_length_check
    check (char_length(btrim(recipient_name)) between 2 and 80);

create or replace function private.snapshot_club_achievement_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.recipient_id is distinct from old.recipient_id then
    select coalesce(
      nullif(btrim(profile.tournament_name), ''),
      nullif(btrim(profile.display_name), ''),
      'Club member'
    )
    into new.recipient_name
    from public.profiles as profile
    where profile.id = new.recipient_id;
  elsif new.recipient_name is distinct from old.recipient_name then
    raise exception 'Achievement recipient name cannot be changed directly.';
  end if;
  new.recipient_name := coalesce(new.recipient_name, 'Club member');
  return new;
end;
$$;
revoke all on function private.snapshot_club_achievement_recipient() from public, anon, authenticated;

drop trigger if exists snapshot_club_achievement_recipient on public.club_achievements;
create trigger snapshot_club_achievement_recipient
  before insert or update on public.club_achievements
  for each row execute function private.snapshot_club_achievement_recipient();

create table public.club_gallery_items (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  image_url text not null check (char_length(image_url) between 1 and 2048),
  caption text not null default '' check (char_length(caption) <= 220),
  occurred_on date not null default current_date check (occurred_on <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index club_gallery_items_club_date_idx
  on public.club_gallery_items (club_id, occurred_on desc, created_at desc);
create index club_gallery_items_author_idx on public.club_gallery_items (author_id);

create or replace function private.prepare_club_gallery_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.caption := regexp_replace(btrim(new.caption), '\s+', ' ', 'g');
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.author_id := (select auth.uid());
  elsif new.club_id is distinct from old.club_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Gallery item ownership cannot be reassigned.';
  end if;
  return new;
end;
$$;
revoke all on function private.prepare_club_gallery_item() from public, anon, authenticated;

create trigger prepare_club_gallery_item
  before insert or update on public.club_gallery_items
  for each row execute function private.prepare_club_gallery_item();

alter table public.club_gallery_items enable row level security;
create policy "Visible club gallery items are readable"
  on public.club_gallery_items for select to anon, authenticated
  using (
    exists (
      select 1 from public.clubs as club
      where club.id = club_gallery_items.club_id and club.is_public
    )
    or private.is_club_member(club_id)
    or private.is_club_admin(club_id)
  );
create policy "Club admins create gallery items"
  on public.club_gallery_items for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_club_admin(club_id));
create policy "Club admins update gallery items"
  on public.club_gallery_items for update to authenticated
  using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id));
create policy "Club admins remove gallery items"
  on public.club_gallery_items for delete to authenticated
  using (private.is_club_admin(club_id));

revoke all on table public.club_gallery_items from public, anon, authenticated;
grant select on table public.club_gallery_items to anon, authenticated;
grant insert (club_id, image_url, caption, occurred_on),
  update (image_url, caption, occurred_on), delete
  on table public.club_gallery_items to authenticated;
grant all on table public.club_gallery_items to service_role;

create table public.club_member_reports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reported_name text not null check (char_length(btrim(reported_name)) between 2 and 80),
  category text not null check (category in ('harassment', 'spam', 'unsafe_conduct', 'club_rules', 'other')),
  details text not null check (char_length(btrim(details)) between 5 and 800),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create index club_member_reports_club_status_idx
  on public.club_member_reports (club_id, status, created_at desc);
create index club_member_reports_reporter_idx on public.club_member_reports (reporter_id, created_at desc);

create table public.club_member_restrictions (
  club_id uuid not null,
  user_id uuid not null,
  is_suspended boolean not null default false,
  is_muted boolean not null default false,
  reason text not null default '' check (char_length(reason) <= 500),
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id),
  foreign key (club_id, user_id) references public.club_members(club_id, user_id) on delete cascade,
  check (is_suspended or is_muted)
);
create index club_member_restrictions_user_idx on public.club_member_restrictions (user_id);

create table public.club_member_blocks (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null check (char_length(btrim(user_name)) between 2 and 80),
  blocked_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_member_blocks_user_idx on public.club_member_blocks (user_id);

create or replace function private.can_moderate_club_user(target_club uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_club_owner(target_club)
    or (
      private.is_club_admin(target_club)
      and exists (
        select 1 from public.club_members
        where club_id = target_club and user_id = target_user and role = 'member'
      )
    );
$$;
revoke all on function private.can_moderate_club_user(uuid, uuid) from public, anon;
grant execute on function private.can_moderate_club_user(uuid, uuid) to authenticated;

alter table public.club_member_reports enable row level security;
create policy "Members create club reports"
  on public.club_member_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and private.is_club_member(club_id)
    and exists (
      select 1 from public.club_members
      where club_id = club_member_reports.club_id and user_id = reported_user_id
    )
  );
create policy "Reporters and organizers read club reports"
  on public.club_member_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_club_admin(club_id));
create policy "Organizers review club reports"
  on public.club_member_reports for update to authenticated
  using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id));

alter table public.club_member_restrictions enable row level security;
create policy "Members and organizers read club restrictions"
  on public.club_member_restrictions for select to authenticated
  using (user_id = (select auth.uid()) or private.is_club_admin(club_id));
create policy "Organizers create club restrictions"
  on public.club_member_restrictions for insert to authenticated
  with check (
    updated_by = (select auth.uid())
    and private.can_moderate_club_user(club_id, user_id)
  );
create policy "Organizers update club restrictions"
  on public.club_member_restrictions for update to authenticated
  using (private.can_moderate_club_user(club_id, user_id))
  with check (updated_by = (select auth.uid()) and private.can_moderate_club_user(club_id, user_id));
create policy "Organizers remove club restrictions"
  on public.club_member_restrictions for delete to authenticated
  using (private.can_moderate_club_user(club_id, user_id));

alter table public.club_member_blocks enable row level security;
create policy "Blocked members and organizers read club blocks"
  on public.club_member_blocks for select to authenticated
  using (user_id = (select auth.uid()) or private.is_club_admin(club_id));
create policy "Organizers block club members"
  on public.club_member_blocks for insert to authenticated
  with check (
    blocked_by = (select auth.uid())
    and private.can_moderate_club_user(club_id, user_id)
  );
create policy "Organizers unblock club members"
  on public.club_member_blocks for delete to authenticated
  using (private.is_club_admin(club_id));

revoke all on table public.club_member_reports, public.club_member_restrictions, public.club_member_blocks
  from public, anon, authenticated;
grant select, insert on table public.club_member_reports to authenticated;
grant update (status, reviewed_by, updated_at) on table public.club_member_reports to authenticated;
grant select, delete on table public.club_member_restrictions to authenticated;
grant insert (club_id, user_id, is_suspended, is_muted, reason, updated_by),
  update (is_suspended, is_muted, reason, updated_by, updated_at)
  on table public.club_member_restrictions to authenticated;
grant select, delete on table public.club_member_blocks to authenticated;
grant insert (club_id, user_id, user_name, blocked_by, reason)
  on table public.club_member_blocks to authenticated;
grant all on table public.club_member_reports, public.club_member_restrictions, public.club_member_blocks to service_role;

create or replace function private.is_club_member(target_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.club_members
      where club_id = target_club and user_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.club_member_restrictions
      where club_id = target_club and user_id = (select auth.uid()) and is_suspended
    )
    and not exists (
      select 1 from public.club_member_blocks
      where club_id = target_club and user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_club_member(uuid) from public;
grant execute on function private.is_club_member(uuid) to anon, authenticated;

create or replace function private.is_club_member_muted(target_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_member_restrictions
    where club_id = target_club and user_id = (select auth.uid()) and is_muted
  );
$$;
revoke all on function private.is_club_member_muted(uuid) from public, anon;
grant execute on function private.is_club_member_muted(uuid) to authenticated;

create or replace function private.shares_club_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.club_members as own_membership
      join public.club_members as target_membership on target_membership.club_id = own_membership.club_id
      where own_membership.user_id = (select auth.uid())
        and target_membership.user_id = target_user
        and not exists (
          select 1 from public.club_member_restrictions
          where club_id = own_membership.club_id
            and user_id = own_membership.user_id
            and is_suspended
        )
        and not exists (
          select 1 from public.club_member_blocks
          where club_id = own_membership.club_id and user_id = own_membership.user_id
        )
    );
$$;
revoke all on function private.shares_club_with(uuid) from public;
grant execute on function private.shares_club_with(uuid) to anon, authenticated;

create or replace function private.prepare_club_moderation_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'club_member_reports' then
    new.details := btrim(new.details);
    new.reported_name := regexp_replace(btrim(new.reported_name), '\s+', ' ', 'g');
    new.updated_at := now();
    if tg_op = 'INSERT' then
      new.reporter_id := (select auth.uid());
      new.status := 'open';
      new.reviewed_by := null;
    elsif new.club_id is distinct from old.club_id
      or new.reporter_id is distinct from old.reporter_id
      or new.reported_user_id is distinct from old.reported_user_id
      or new.reported_name is distinct from old.reported_name
      or new.category is distinct from old.category
      or new.details is distinct from old.details
      or new.created_at is distinct from old.created_at then
      raise exception 'A submitted report cannot be rewritten.';
    end if;
  elsif tg_table_name = 'club_member_restrictions' then
    new.reason := btrim(new.reason);
    new.updated_by := (select auth.uid());
    new.updated_at := now();
  else
    new.user_name := regexp_replace(btrim(new.user_name), '\s+', ' ', 'g');
    new.reason := btrim(new.reason);
    new.blocked_by := (select auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.prepare_club_moderation_record() from public, anon, authenticated;

create trigger prepare_club_member_report before insert or update on public.club_member_reports
  for each row execute function private.prepare_club_moderation_record();
create trigger prepare_club_member_restriction before insert or update on public.club_member_restrictions
  for each row execute function private.prepare_club_moderation_record();
create trigger prepare_club_member_block before insert on public.club_member_blocks
  for each row execute function private.prepare_club_moderation_record();

create or replace function private.reject_blocked_club_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.club_member_blocks
    where club_id = new.club_id and user_id = new.user_id
  ) then
    raise exception 'This account cannot join this club. Contact the club owner if you believe this is a mistake.';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_blocked_club_membership() from public, anon, authenticated;

create trigger reject_blocked_club_membership_request
  before insert or update on public.club_membership_requests
  for each row execute function private.reject_blocked_club_membership();
create trigger reject_blocked_club_member
  before insert on public.club_members
  for each row execute function private.reject_blocked_club_membership();

create or replace function private.enforce_club_challenge_mute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_club_member_muted(new.club_id)
    and (
      tg_op = 'INSERT'
      or (new.accepted_by is distinct from old.accepted_by and new.accepted_by = (select auth.uid()))
    ) then
    raise exception 'Your posting access is muted in this club.';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_club_challenge_mute() from public, anon, authenticated;

create trigger enforce_club_challenge_mute
  before insert or update on public.club_challenges
  for each row execute function private.enforce_club_challenge_mute();

create or replace function public.block_club_member(
  target_club uuid,
  target_user uuid,
  target_name text,
  block_reason text default ''
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.club_member_blocks (club_id, user_id, user_name, reason)
  values (target_club, target_user, target_name, block_reason)
  on conflict (club_id, user_id) do nothing;
  delete from public.club_members
  where club_id = target_club and user_id = target_user;
end;
$$;
revoke all on function public.block_club_member(uuid, uuid, text, text) from public, anon;
grant execute on function public.block_club_member(uuid, uuid, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'club_gallery_items'
  ) then
    alter publication supabase_realtime add table public.club_gallery_items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'club_member_reports'
  ) then
    alter publication supabase_realtime add table public.club_member_reports;
  end if;
end;
$$;
