-- Platform-controlled club verification. Eligibility is calculated from trusted
-- CueBracket data and never grants the badge automatically.

alter table public.clubs
  add column is_verified boolean not null default false,
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users(id) on delete set null,
  add constraint clubs_verification_consistent check (
    (not is_verified and verified_at is null and verified_by is null)
    or (is_verified and verified_at is not null and verified_by is not null)
  );

create index clubs_verified_public_idx on public.clubs (name)
  where is_public and is_verified;

create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;
revoke all on table private.platform_admins from public, anon, authenticated;
grant all on table private.platform_admins to service_role;

create or replace function private.is_platform_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and exists (
    select 1 from private.platform_admins where user_id = target_user
  );
$$;
revoke all on function private.is_platform_admin(uuid) from public, anon, authenticated;

create or replace function private.club_verification_eligibility(target_club uuid)
returns table (eligible boolean, missing_criteria text[], completed_event_count bigint, approved_member_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with facts as (
    select
      c.id,
      (
        length(btrim(c.location)) > 0
        and lower(btrim(c.location)) not in ('not published yet', 'tba', 'to be announced')
        and length(btrim(coalesce(g.opening_hours, ''))) > 0
        and lower(btrim(coalesce(g.opening_hours, ''))) not in ('not published yet', 'tba', 'to be announced')
      ) as has_location_and_hours,
      length(btrim(coalesce(g.rules, ''))) >= 20 as has_completed_guide,
      (
        select count(*) from public.cloud_tournaments t
        where t.club_id = c.id and t.status = 'completed'
      ) + (
        select count(*) from public.club_calendar_events e
        where e.club_id = c.id and not e.is_cancelled
          and coalesce(e.ends_at, e.starts_at) < now()
      ) as event_count,
      (select count(*) from public.club_members m where m.club_id = c.id) as member_count
    from public.clubs c
    left join public.club_guides g on g.club_id = c.id
    where c.id = target_club
  ), result as (
    select *, array_remove(array[
      case when not has_location_and_hours then 'Published location and opening hours' end,
      case when not has_completed_guide then 'Completed joining guide and house rules' end,
      case when event_count < 3 then 'At least 3 completed tournaments or events' end,
      case when member_count < 5 then 'At least 5 approved members' end
    ], null)::text[] as missing
    from facts
  )
  select cardinality(missing) = 0, missing, event_count, member_count from result;
$$;
revoke all on function private.club_verification_eligibility(uuid) from public, anon, authenticated;

create or replace function public.check_club_verification_eligibility(target_club uuid)
returns table (eligible boolean, missing_criteria text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator access required.';
  end if;
  return query select e.eligible, e.missing_criteria
    from private.club_verification_eligibility(target_club) e;
end;
$$;
revoke all on function public.check_club_verification_eligibility(uuid) from public, anon;
grant execute on function public.check_club_verification_eligibility(uuid) to authenticated, service_role;

create or replace function public.list_clubs_eligible_for_verification()
returns table (
  club_id uuid, club_name text, club_slug text, club_location text,
  completed_event_count bigint, approved_member_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator access required.';
  end if;
  return query
    select c.id, c.name, c.slug, c.location, e.completed_event_count, e.approved_member_count
    from public.clubs c
    cross join lateral private.club_verification_eligibility(c.id) e
    where e.eligible and not c.is_verified
    order by c.name;
end;
$$;
revoke all on function public.list_clubs_eligible_for_verification() from public, anon;
grant execute on function public.list_clubs_eligible_for_verification() to authenticated, service_role;

create or replace function public.approve_club_verification(target_club uuid)
returns public.clubs
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.clubs;
  eligibility record;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator access required.';
  end if;
  select * into eligibility from private.club_verification_eligibility(target_club);
  if eligibility is null or not eligibility.eligible then
    raise exception 'This club is not currently eligible for verification.';
  end if;
  update public.clubs set
    is_verified = true,
    verified_at = now(),
    verified_by = auth.uid(),
    updated_at = now()
  where id = target_club and not is_verified
  returning * into result;
  if result.id is null then raise exception 'Club not found or already verified.'; end if;
  return result;
end;
$$;
revoke all on function public.approve_club_verification(uuid) from public, anon;
grant execute on function public.approve_club_verification(uuid) to authenticated, service_role;

create or replace function private.protect_club_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.verified_at := null;
    new.verified_by := null;
  elsif new.is_verified is distinct from old.is_verified
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by then
    if not private.is_platform_admin(auth.uid()) then
      raise exception 'Only a CueBracket platform administrator can change verification.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_club_verification() from public, anon, authenticated;

create trigger protect_club_verification
  before insert or update of is_verified, verified_at, verified_by on public.clubs
  for each row execute function private.protect_club_verification();

