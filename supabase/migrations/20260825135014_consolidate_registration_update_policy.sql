drop policy if exists "Players withdraw their registrations"
  on public.event_registrations;
drop policy if exists "Tournament owners manage registrations"
  on public.event_registrations;

create policy "Players and owners update registrations"
  on public.event_registrations
  for update to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1
      from public.event_registration_settings as settings
      where settings.tournament_id = event_registrations.tournament_id
        and settings.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.event_registration_settings as settings
      where settings.tournament_id = event_registrations.tournament_id
        and settings.owner_id = (select auth.uid())
    )
    or (
      profile_id = (select auth.uid())
      and status = 'withdrawn'
      and source = 'self'
    )
  );
