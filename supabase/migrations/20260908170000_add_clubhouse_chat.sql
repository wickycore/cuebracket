-- Member-only realtime chat for each club clubhouse.
create table public.club_chat_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index club_chat_messages_feed_idx
  on public.club_chat_messages (club_id, created_at desc);
create index club_chat_messages_author_idx
  on public.club_chat_messages (author_id, created_at desc);

create or replace function private.prepare_club_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id := (select auth.uid());
  new.body := btrim(regexp_replace(new.body, '[[:space:]]+', ' ', 'g'));
  if new.author_id is null or not (private.is_club_member(new.club_id) or private.is_club_admin(new.club_id)) then
    raise exception 'Only approved club members can chat.';
  end if;
  if private.is_club_member_muted(new.club_id) then
    raise exception 'Your clubhouse posting access is muted.';
  end if;
  if char_length(new.body) < 1 or char_length(new.body) > 1000 then
    raise exception 'Messages must be between 1 and 1000 characters.';
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_club_chat_message() from public, anon, authenticated;

create trigger prepare_club_chat_message
  before insert on public.club_chat_messages
  for each row execute procedure private.prepare_club_chat_message();

alter table public.club_chat_messages enable row level security;

create policy "Approved members read clubhouse chat"
  on public.club_chat_messages for select
  using (private.is_club_member(club_id) or private.is_club_admin(club_id));

create policy "Approved members post clubhouse chat"
  on public.club_chat_messages for insert
  with check (
    author_id = (select auth.uid())
    and (private.is_club_member(club_id) or private.is_club_admin(club_id))
    and not private.is_club_member_muted(club_id)
  );

create policy "Authors and admins remove clubhouse chat"
  on public.club_chat_messages for delete
  using (author_id = (select auth.uid()) or private.is_club_admin(club_id));

revoke all on table public.club_chat_messages from anon, authenticated;
grant select, insert (club_id, body), delete on table public.club_chat_messages to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'club_chat_messages'
  ) then
    alter publication supabase_realtime add table public.club_chat_messages;
  end if;
end $$;
