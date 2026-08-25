-- Cover the final foreign key reported by the Supabase performance advisor.
create index if not exists club_members_user_id_idx
  on public.club_members (user_id);
