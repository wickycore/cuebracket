-- Phase 4E: Club Command Center announcements and activity feed.

create table public.club_announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'general'
    check (kind in ('general', 'event', 'venue', 'league', 'result')),
  title text not null
    check (char_length(btrim(title)) between 3 and 100),
  body text not null
    check (char_length(btrim(body)) between 1 and 1000),
  is_pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index club_announcements_club_feed_idx
  on public.club_announcements (club_id, is_pinned desc, published_at desc);
create index club_announcements_author_id_idx
  on public.club_announcements (author_id);

create or replace function private.prepare_club_announcement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.body := btrim(new.body);
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.author_id := (select auth.uid());
    new.published_at := now();
  elsif new.club_id is distinct from old.club_id
    or new.author_id is distinct from old.author_id
    or new.published_at is distinct from old.published_at then
    raise exception 'Announcement ownership cannot be reassigned.';
  end if;

  return new;
end;
$$;
revoke all on function private.prepare_club_announcement()
  from public, anon, authenticated;

create trigger prepare_club_announcement
  before insert or update on public.club_announcements
  for each row execute procedure private.prepare_club_announcement();

alter table public.club_announcements enable row level security;

create policy "Public club announcements are readable"
  on public.club_announcements
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.clubs as club
      where club.id = club_announcements.club_id
        and club.is_public
    )
    or (select private.is_club_admin(club_id))
  );

create policy "Club admins create announcements"
  on public.club_announcements
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_club_admin(club_id))
  );

create policy "Club admins update announcements"
  on public.club_announcements
  for update to authenticated
  using ((select private.is_club_admin(club_id)))
  with check ((select private.is_club_admin(club_id)));

create policy "Club admins remove announcements"
  on public.club_announcements
  for delete to authenticated
  using ((select private.is_club_admin(club_id)));

revoke all on table public.club_announcements from anon, authenticated;
grant select on table public.club_announcements to anon, authenticated;
grant insert (club_id, kind, title, body, is_pinned)
  on table public.club_announcements to authenticated;
grant update (kind, title, body, is_pinned)
  on table public.club_announcements to authenticated;
grant delete on table public.club_announcements to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_announcements'
  ) then
    alter publication supabase_realtime add table public.club_announcements;
  end if;
end;
$$;
