alter table public.club_chat_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size integer,
  add column if not exists sticker text;

alter table public.club_chat_messages drop constraint if exists club_chat_messages_body_check;
alter table public.club_chat_messages drop constraint if exists club_chat_message_content_check;
alter table public.club_chat_messages drop constraint if exists club_chat_attachment_size_check;
alter table public.club_chat_messages alter column body set default '';
alter table public.club_chat_messages add constraint club_chat_message_content_check check (
  char_length(body) <= 1000 and (char_length(body) > 0 or attachment_path is not null or sticker is not null)
);
alter table public.club_chat_messages add constraint club_chat_attachment_size_check check (attachment_size is null or attachment_size between 1 and 10485760);

create or replace function private.prepare_club_chat_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.author_id := (select auth.uid());
  new.body := btrim(regexp_replace(coalesce(new.body, ''), '[[:space:]]+', ' ', 'g'));
  if new.author_id is null or not (private.is_club_member(new.club_id) or private.is_club_admin(new.club_id)) then raise exception 'Only approved club members can chat.'; end if;
  if private.is_club_member_muted(new.club_id) then raise exception 'Your clubhouse posting access is muted.'; end if;
  if char_length(new.body) > 1000 or (new.body = '' and new.attachment_path is null and new.sticker is null) then raise exception 'Add a message, attachment or sticker.'; end if;
  if new.attachment_path is not null and new.attachment_path not like new.club_id::text || '/' || new.author_id::text || '/%' then raise exception 'Invalid attachment path.'; end if;
  return new;
end; $$;

grant insert (club_id, body, attachment_path, attachment_name, attachment_type, attachment_size, sticker) on public.club_chat_messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-chat', 'club-chat', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Club members read chat attachments" on storage.objects;
create policy "Club members read chat attachments" on storage.objects for select to authenticated using (
  bucket_id = 'club-chat' and (private.is_club_member(((storage.foldername(name))[1])::uuid) or private.is_club_admin(((storage.foldername(name))[1])::uuid))
);
drop policy if exists "Club members upload chat attachments" on storage.objects;
create policy "Club members upload chat attachments" on storage.objects for insert to authenticated with check (
  bucket_id = 'club-chat' and (storage.foldername(name))[2] = (select auth.uid())::text
  and (private.is_club_member(((storage.foldername(name))[1])::uuid) or private.is_club_admin(((storage.foldername(name))[1])::uuid))
  and not private.is_club_member_muted(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "Authors and admins delete chat attachments" on storage.objects;
create policy "Authors and admins delete chat attachments" on storage.objects for delete to authenticated using (
  bucket_id = 'club-chat' and (owner_id = (select auth.uid()::text) or private.is_club_admin(((storage.foldername(name))[1])::uuid))
);
