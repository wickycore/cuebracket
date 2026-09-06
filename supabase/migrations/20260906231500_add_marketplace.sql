-- CueBracket Marketplace: off-platform listings, listing-scoped chat and reports.

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 1500),
  category text not null check (category in ('cue','case','chalk','gloves','table_felt','balls','rack','tips_ferrules','apparel','maintenance','table','other')),
  condition text not null check (condition in ('new','like_new','used')),
  price numeric(12,2) not null check (price >= 0 and price <= 9999999999.99),
  currency text not null default 'KES' check (currency ~ '^[A-Z]{3}$'),
  quantity_total integer not null check (quantity_total between 1 and 9999),
  quantity_sold integer not null default 0 check (quantity_sold >= 0 and quantity_sold <= quantity_total),
  location text not null check (char_length(btrim(location)) between 2 and 100),
  photos text[] not null default '{}' check (cardinality(photos) <= 5),
  club_id uuid references public.clubs(id) on delete set null,
  status text not null default 'active' check (status in ('active','sold_out','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_listings add constraint marketplace_listings_seller_profile_fkey
  foreign key (seller_user_id) references public.profiles(id) on delete cascade;

create index marketplace_listings_browse_idx on public.marketplace_listings (status, created_at desc);
create index marketplace_listings_seller_idx on public.marketplace_listings (seller_user_id, updated_at desc);
create index marketplace_listings_club_idx on public.marketplace_listings (club_id) where club_id is not null;
create index marketplace_listings_category_idx on public.marketplace_listings (category, condition, price);

create or replace function private.prepare_marketplace_listing()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.description := btrim(new.description);
  new.location := regexp_replace(btrim(new.location), '\s+', ' ', 'g');
  new.currency := upper(btrim(new.currency));
  if tg_op = 'INSERT' then
    new.seller_user_id := (select auth.uid());
  elsif new.seller_user_id is distinct from old.seller_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Listing ownership cannot be reassigned.';
  end if;
  if new.club_id is not null and not exists (
    select 1 from public.club_members m
    where m.club_id = new.club_id and m.user_id = (select auth.uid())
  ) then
    raise exception 'You can only tag a club you belong to.';
  end if;
  if new.status <> 'removed' then
    new.status := case when new.quantity_sold >= new.quantity_total then 'sold_out' else 'active' end;
  end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function private.prepare_marketplace_listing() from public, anon, authenticated;
create trigger prepare_marketplace_listing before insert or update on public.marketplace_listings
for each row execute function private.prepare_marketplace_listing();

alter table public.marketplace_listings enable row level security;
create policy "Marketplace listings are publicly readable" on public.marketplace_listings
for select to anon, authenticated using (status in ('active','sold_out') or seller_user_id = (select auth.uid()));
create policy "Users create their listings" on public.marketplace_listings
for insert to authenticated with check (seller_user_id = (select auth.uid()));
create policy "Sellers update their listings" on public.marketplace_listings
for update to authenticated using (seller_user_id = (select auth.uid())) with check (seller_user_id = (select auth.uid()));

create table public.marketplace_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_user_id),
  check (buyer_user_id <> seller_user_id)
);
create index marketplace_threads_seller_idx on public.marketplace_threads (seller_user_id, updated_at desc);

create table public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.marketplace_threads(id) on delete cascade,
  sender_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index marketplace_messages_thread_idx on public.marketplace_messages (thread_id, created_at);

create or replace function private.prepare_marketplace_thread()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.buyer_user_id := (select auth.uid());
  select seller_user_id into new.seller_user_id from public.marketplace_listings where id = new.listing_id and status <> 'removed';
  if new.seller_user_id is null then raise exception 'Listing is unavailable.'; end if;
  return new;
end; $$;
revoke all on function private.prepare_marketplace_thread() from public, anon, authenticated;
create trigger prepare_marketplace_thread before insert on public.marketplace_threads for each row execute function private.prepare_marketplace_thread();

create or replace function private.prepare_marketplace_message()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.sender_user_id := (select auth.uid());
  new.body := btrim(new.body);
  update public.marketplace_threads set updated_at = now() where id = new.thread_id;
  return new;
end; $$;
revoke all on function private.prepare_marketplace_message() from public, anon, authenticated;
create trigger prepare_marketplace_message before insert on public.marketplace_messages for each row execute function private.prepare_marketplace_message();

alter table public.marketplace_threads enable row level security;
alter table public.marketplace_messages enable row level security;
create policy "Participants read listing threads" on public.marketplace_threads for select to authenticated
using ((select auth.uid()) in (buyer_user_id, seller_user_id));
create policy "Buyers open listing threads" on public.marketplace_threads for insert to authenticated
with check (buyer_user_id = (select auth.uid()));
create policy "Participants touch listing threads" on public.marketplace_threads for update to authenticated
using ((select auth.uid()) in (buyer_user_id, seller_user_id))
with check ((select auth.uid()) in (buyer_user_id, seller_user_id));
create policy "Participants read listing messages" on public.marketplace_messages for select to authenticated
using (exists (select 1 from public.marketplace_threads t where t.id = thread_id and (select auth.uid()) in (t.buyer_user_id,t.seller_user_id)));
create policy "Participants send listing messages" on public.marketplace_messages for insert to authenticated
with check (sender_user_id = (select auth.uid()) and exists (select 1 from public.marketplace_threads t where t.id = thread_id and (select auth.uid()) in (t.buyer_user_id,t.seller_user_id)));

create table public.marketplace_listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('prohibited_item','misleading','spam','unsafe','other')),
  details text not null check (char_length(btrim(details)) between 5 and 800),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);
create index marketplace_reports_status_idx on public.marketplace_listing_reports (status, created_at desc);
alter table public.marketplace_listing_reports enable row level security;
create policy "Users report marketplace listings" on public.marketplace_listing_reports for insert to authenticated
with check (reporter_id = (select auth.uid()));
create policy "Reporters read their reports" on public.marketplace_listing_reports for select to authenticated
using (reporter_id = (select auth.uid()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('marketplace-photos','marketplace-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Marketplace photos upload by owner" on storage.objects for insert to authenticated
with check (bucket_id='marketplace-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Marketplace photos update by owner" on storage.objects for update to authenticated
using (bucket_id='marketplace-photos' and owner_id=(select auth.uid())::text)
with check (bucket_id='marketplace-photos' and owner_id=(select auth.uid())::text);
create policy "Marketplace photos delete by owner" on storage.objects for delete to authenticated
using (bucket_id='marketplace-photos' and owner_id=(select auth.uid())::text);

revoke all on table public.marketplace_listings, public.marketplace_threads, public.marketplace_messages, public.marketplace_listing_reports from public, anon, authenticated;
grant select on public.marketplace_listings to anon, authenticated;
grant insert (title,description,category,condition,price,currency,quantity_total,location,photos,club_id),
  update (title,description,category,condition,price,currency,quantity_total,quantity_sold,location,photos,club_id,status)
  on public.marketplace_listings to authenticated;
grant select, insert (listing_id) on public.marketplace_threads to authenticated;
grant update (updated_at) on public.marketplace_threads to authenticated;
grant select, insert (thread_id,body) on public.marketplace_messages to authenticated;
grant select, insert (listing_id,category,details) on public.marketplace_listing_reports to authenticated;
grant all on public.marketplace_listings, public.marketplace_threads, public.marketplace_messages, public.marketplace_listing_reports to service_role;
