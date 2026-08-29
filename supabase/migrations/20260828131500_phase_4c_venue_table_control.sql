-- Phase 4C: club-aware venue tables with realtime floor control.

create table public.venue_tables (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  name text not null,
  status text not null default 'available'
    check (status in ('available', 'playing', 'reserved')),
  note text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  active_event_type text
    check (active_event_type is null or active_event_type in ('tournament', 'league')),
  active_event_id text,
  active_match_id text,
  active_match_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_tables_name_length_check
    check (char_length(btrim(name)) between 1 and 50),
  constraint venue_tables_note_length_check
    check (char_length(note) <= 160),
  constraint venue_tables_active_assignment_check
    check (
      (active_event_type is null and active_event_id is null and active_match_id is null)
      or (active_event_type is not null and active_event_id is not null and active_match_id is not null)
    )
);

create index venue_tables_owner_id_idx on public.venue_tables (owner_id);
create index venue_tables_club_id_idx on public.venue_tables (club_id) where club_id is not null;
create index venue_tables_active_event_idx on public.venue_tables (active_event_type, active_event_id)
  where active_event_id is not null;
create unique index venue_tables_personal_name_unique_idx
  on public.venue_tables (owner_id, lower(btrim(name))) where club_id is null;
create unique index venue_tables_club_name_unique_idx
  on public.venue_tables (club_id, lower(btrim(name))) where club_id is not null;

create or replace function private.touch_venue_table_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.name := btrim(new.name);
  new.note := btrim(new.note);
  new.active_match_label := btrim(new.active_match_label);
  return new;
end;
$$;

revoke all on function private.touch_venue_table_updated_at() from public, anon, authenticated;

create trigger touch_venue_table_updated_at
  before insert or update on public.venue_tables
  for each row execute procedure private.touch_venue_table_updated_at();

alter table public.venue_tables enable row level security;

create policy "Organizers read venue tables"
  on public.venue_tables for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and exists (
      select 1 from public.club_members member
      where member.club_id = venue_tables.club_id
        and member.user_id = (select auth.uid())
    ))
    or exists (
      select 1
      from public.tournament_collaborators collaborator
      join public.cloud_tournaments tournament
        on tournament.id = collaborator.tournament_id
      where collaborator.user_id = (select auth.uid())
        and collaborator.status = 'accepted'
        and (
          (venue_tables.club_id is not null and tournament.club_id = venue_tables.club_id)
          or (venue_tables.club_id is null and tournament.club_id is null and tournament.owner_id = venue_tables.owner_id)
        )
    )
  );

create policy "Owners create venue tables"
  on public.venue_tables for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (club_id is null or private.is_club_admin(club_id))
  );

create policy "Organizers update venue tables"
  on public.venue_tables for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
    or exists (
      select 1
      from public.tournament_collaborators collaborator
      join public.cloud_tournaments tournament
        on tournament.id = collaborator.tournament_id
      where collaborator.user_id = (select auth.uid())
        and collaborator.status = 'accepted'
        and (
          (venue_tables.club_id is not null and tournament.club_id = venue_tables.club_id)
          or (venue_tables.club_id is null and tournament.club_id is null and tournament.owner_id = venue_tables.owner_id)
        )
    )
  )
  with check (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
    or exists (
      select 1
      from public.tournament_collaborators collaborator
      join public.cloud_tournaments tournament
        on tournament.id = collaborator.tournament_id
      where collaborator.user_id = (select auth.uid())
        and collaborator.status = 'accepted'
        and (
          (venue_tables.club_id is not null and tournament.club_id = venue_tables.club_id)
          or (venue_tables.club_id is null and tournament.club_id is null and tournament.owner_id = venue_tables.owner_id)
        )
        and (
          venue_tables.active_event_id is null
          or (
            venue_tables.active_event_type = 'tournament'
            and venue_tables.active_event_id = collaborator.tournament_id
          )
        )
    )
  );

create policy "Owners delete venue tables"
  on public.venue_tables for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (club_id is not null and private.is_club_admin(club_id))
  );

revoke all on table public.venue_tables from anon, authenticated;
grant select, delete on table public.venue_tables to authenticated;
grant insert (club_id, name, note, sort_order) on table public.venue_tables to authenticated;
grant update (
  name,
  status,
  note,
  sort_order,
  active_event_type,
  active_event_id,
  active_match_id,
  active_match_label
) on table public.venue_tables to authenticated;
grant usage, select on sequence public.venue_tables_id_seq to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'venue_tables'
  ) then
    alter publication supabase_realtime add table public.venue_tables;
  end if;
end;
$$;
