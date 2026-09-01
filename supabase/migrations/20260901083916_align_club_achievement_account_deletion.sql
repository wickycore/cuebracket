-- Keep honours compatible with account deletion while preserving club history.

alter table public.club_achievements
  drop constraint club_achievements_recipient_id_fkey,
  add constraint club_achievements_recipient_id_fkey
    foreign key (recipient_id) references auth.users(id) on delete cascade,
  drop constraint club_achievements_awarded_by_fkey,
  alter column awarded_by drop not null,
  add constraint club_achievements_awarded_by_fkey
    foreign key (awarded_by) references auth.users(id) on delete set null;
