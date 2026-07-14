-- CueBracket 0.9B — Multi-format tournament engine
-- Run this ONCE in Supabase SQL Editor before testing cloud sync.

alter table public.cloud_tournaments
  add column if not exists stage_type text not null default 'single_stage',
  add column if not exists options jsonb not null default '{}'::jsonb,
  add column if not exists competition jsonb;

-- Replace the original single/double-only format check.
do $$
declare
  item record;
begin
  for item in
    select conname
    from pg_constraint
    where conrelid = 'public.cloud_tournaments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%format%'
  loop
    execute format('alter table public.cloud_tournaments drop constraint %I', item.conname);
  end loop;
end $$;

alter table public.cloud_tournaments
  add constraint cloud_tournaments_format_check
  check (format in (
    'single',
    'double',
    'round_robin',
    'swiss',
    'free_for_all',
    'leaderboard'
  ));

-- Replace the original powers-of-two-only capacity check. Elimination formats
-- still enforce powers of two in the application; flexible formats may use any
-- capacity between 2 and 128.
do $$
declare
  item record;
begin
  for item in
    select conname
    from pg_constraint
    where conrelid = 'public.cloud_tournaments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%bracket_size%'
  loop
    execute format('alter table public.cloud_tournaments drop constraint %I', item.conname);
  end loop;
end $$;

alter table public.cloud_tournaments
  add constraint cloud_tournaments_capacity_check
  check (bracket_size between 2 and 128);

alter table public.cloud_tournaments
  drop constraint if exists cloud_tournaments_stage_type_check;

alter table public.cloud_tournaments
  add constraint cloud_tournaments_stage_type_check
  check (stage_type in ('single_stage', 'two_stage'));

alter table public.cloud_tournaments replica identity full;

-- Ask PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';
