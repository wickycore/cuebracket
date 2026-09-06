create index clubs_verified_by_idx on public.clubs (verified_by)
  where verified_by is not null;

-- The table is private and has no client grants. This explicit deny policy also
-- documents that platform-admin membership is never directly readable/writable.
create policy "No direct platform admin table access"
  on private.platform_admins for all to authenticated
  using (false) with check (false);

