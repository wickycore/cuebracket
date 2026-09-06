-- Give public spectator pages a privacy-safe way to resolve confirmed entrants
-- to public CueBracket profiles. Registration profile IDs remain unavailable
-- through direct anonymous table reads.

create or replace function public.get_public_tournament_participants(
  target_tournament_id text
)
returns table (
  display_name text,
  profile_id uuid,
  username text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    registration.display_name,
    profile.id,
    profile.username,
    profile.avatar_url
  from public.event_registrations as registration
  join public.profiles as profile
    on profile.id = registration.profile_id
  join public.cloud_tournaments as tournament
    on tournament.id = registration.tournament_id
  where registration.tournament_id = target_tournament_id
    and registration.status in ('approved', 'checked_in')
    and tournament.is_public
    and profile.is_public;
$$;

revoke all on function public.get_public_tournament_participants(text)
  from public, anon, authenticated;
grant execute on function public.get_public_tournament_participants(text)
  to anon, authenticated;

comment on function public.get_public_tournament_participants(text) is
  'Returns only public profile fields for confirmed entrants in a public tournament.';
