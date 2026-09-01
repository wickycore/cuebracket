-- Phase 4J: Club Honours achievement wall and member recognition.

create table public.club_achievements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  awarded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  kind text not null default 'custom'
    check (kind in ('champion', 'podium', 'milestone', 'sportsmanship', 'contribution', 'custom')),
  title text not null
    check (char_length(btrim(title)) between 3 and 80),
  description text not null
    check (char_length(btrim(description)) between 1 and 300),
  awarded_on date not null default current_date
    check (awarded_on <= current_date),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index club_achievements_club_wall_idx
  on public.club_achievements (club_id, is_featured desc, awarded_on desc, created_at desc);
create index club_achievements_recipient_idx
  on public.club_achievements (recipient_id, awarded_on desc);
create index club_achievements_awarded_by_idx
  on public.club_achievements (awarded_by);

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
    new.awarded_by := (select auth.uid());
  elsif new.club_id is distinct from old.club_id
    or new.recipient_id is distinct from old.recipient_id
    or new.awarded_by is distinct from old.awarded_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Achievement ownership cannot be reassigned.';
  end if;

  if not exists (
    select 1
    from public.club_members as member
    where member.club_id = new.club_id
      and member.user_id = new.recipient_id
  ) then
    raise exception 'Achievements can only be awarded to current club members.';
  end if;

  return new;
end;
$$;
revoke all on function private.prepare_club_achievement()
  from public, anon, authenticated;

create trigger prepare_club_achievement
  before insert or update on public.club_achievements
  for each row execute procedure private.prepare_club_achievement();

alter table public.club_achievements enable row level security;

create policy "Visible club achievements are readable"
  on public.club_achievements
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.clubs as club
      where club.id = club_achievements.club_id
        and club.is_public
    )
    or (select private.is_club_member(club_id))
  );

create policy "Club admins create achievements"
  on public.club_achievements
  for insert to authenticated
  with check (
    awarded_by = (select auth.uid())
    and (select private.is_club_admin(club_id))
  );

create policy "Club admins update achievements"
  on public.club_achievements
  for update to authenticated
  using ((select private.is_club_admin(club_id)))
  with check ((select private.is_club_admin(club_id)));

create policy "Club admins remove achievements"
  on public.club_achievements
  for delete to authenticated
  using ((select private.is_club_admin(club_id)));

revoke all on table public.club_achievements from anon, authenticated;
grant select on table public.club_achievements to anon, authenticated;
grant insert (club_id, recipient_id, kind, title, description, awarded_on, is_featured)
  on table public.club_achievements to authenticated;
grant update (kind, title, description, awarded_on, is_featured)
  on table public.club_achievements to authenticated;
grant delete on table public.club_achievements to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_achievements'
  ) then
    alter publication supabase_realtime add table public.club_achievements;
  end if;
end;
$$;
