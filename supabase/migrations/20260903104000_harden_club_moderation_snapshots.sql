-- Keep moderation identities authoritative and cover moderation foreign keys.

create index if not exists club_member_reports_reported_user_idx
  on public.club_member_reports (reported_user_id);
create index if not exists club_member_reports_reviewed_by_idx
  on public.club_member_reports (reviewed_by)
  where reviewed_by is not null;
create index if not exists club_member_restrictions_updated_by_idx
  on public.club_member_restrictions (updated_by);
create index if not exists club_member_blocks_blocked_by_idx
  on public.club_member_blocks (blocked_by);

create or replace function private.prepare_club_moderation_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'club_member_reports' then
    new.details := btrim(new.details);
    new.updated_at := now();
    if tg_op = 'INSERT' then
      new.reporter_id := (select auth.uid());
      new.status := 'open';
      new.reviewed_by := null;
      select coalesce(
        nullif(btrim(profile.tournament_name), ''),
        nullif(btrim(profile.display_name), ''),
        'Club member'
      ) into new.reported_name
      from public.profiles as profile
      where profile.id = new.reported_user_id;
      new.reported_name := coalesce(new.reported_name, 'Club member');
    elsif new.club_id is distinct from old.club_id
      or new.reporter_id is distinct from old.reporter_id
      or new.reported_user_id is distinct from old.reported_user_id
      or new.reported_name is distinct from old.reported_name
      or new.category is distinct from old.category
      or new.details is distinct from old.details
      or new.created_at is distinct from old.created_at then
      raise exception 'A submitted report cannot be rewritten.';
    end if;
  elsif tg_table_name = 'club_member_restrictions' then
    new.reason := btrim(new.reason);
    new.updated_by := (select auth.uid());
    new.updated_at := now();
  else
    new.reason := btrim(new.reason);
    new.blocked_by := (select auth.uid());
    select coalesce(
      nullif(btrim(profile.tournament_name), ''),
      nullif(btrim(profile.display_name), ''),
      'Club member'
    ) into new.user_name
    from public.profiles as profile
    where profile.id = new.user_id;
    new.user_name := coalesce(new.user_name, 'Club member');
  end if;
  return new;
end;
$$;
revoke all on function private.prepare_club_moderation_record() from public, anon, authenticated;
