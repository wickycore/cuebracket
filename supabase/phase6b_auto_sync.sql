-- CueBracket Phase 6B — Automatic Cloud Synchronization
-- Run this once in Supabase: SQL Editor -> New query -> Run.

create or replace function public.set_cuebracket_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_cloud_tournaments_updated_at
on public.cloud_tournaments;

create trigger set_cloud_tournaments_updated_at
before update on public.cloud_tournaments
for each row
execute function public.set_cuebracket_updated_at();

create index if not exists cloud_tournaments_owner_updated_idx
on public.cloud_tournaments (owner_id, updated_at desc);

alter table public.cloud_tournaments replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.cloud_tournaments;
exception
  when duplicate_object then null;
end $$;
