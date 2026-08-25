alter table public.profiles
  add column if not exists username text,
  add column if not exists tournament_name text,
  add column if not exists bio text not null default '',
  add column if not exists is_public boolean not null default true;

update public.profiles
set tournament_name = display_name
where tournament_name is null;

insert into public.profiles (id, display_name, tournament_name)
select
  users.id,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(users.email, '@', 1), ''),
    'CueBracket Player'
  ),
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(users.email, '@', 1), ''),
    'CueBracket Player'
  )
from auth.users as users
on conflict (id) do nothing;

alter table public.profiles
  drop constraint if exists profiles_username_format_check,
  add constraint profiles_username_format_check
    check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  drop constraint if exists profiles_tournament_name_length_check,
  add constraint profiles_tournament_name_length_check
    check (
      tournament_name is null
      or char_length(btrim(tournament_name)) between 2 and 40
    ),
  drop constraint if exists profiles_bio_length_check,
  add constraint profiles_bio_length_check
    check (char_length(bio) <= 160);

create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_display_name text;
begin
  new_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'CueBracket Player'
  );

  insert into public.profiles (id, display_name, tournament_name)
  values (new.id, new_display_name, new_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

drop function if exists public.handle_new_user();

drop policy if exists "Profiles readable" on public.profiles;
create policy "Public profiles readable" on public.profiles
  for select to anon, authenticated
  using (is_public or id = (select auth.uid()));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon;
grant select, update on table public.profiles to authenticated;
