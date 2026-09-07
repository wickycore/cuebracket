-- Marketplace trust and retention: ratings, saved listings, and saver alerts.

alter table public.profiles
  add column seller_avg_rating numeric(3,2) not null default 0 check (seller_avg_rating between 0 and 5),
  add column seller_review_count integer not null default 0 check (seller_review_count >= 0);

create table public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  buyer_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(btrim(comment)) between 2 and 500),
  removal_requested_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_user_id),
  check (buyer_user_id <> seller_user_id)
);
create index marketplace_reviews_seller_idx on public.marketplace_reviews (seller_user_id, created_at desc);
create index marketplace_reviews_buyer_idx on public.marketplace_reviews (buyer_user_id, created_at desc);

create or replace function private.prepare_marketplace_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare listing_seller uuid;
begin
  new.buyer_user_id := (select auth.uid());
  select seller_user_id into listing_seller from public.marketplace_listings where id = new.listing_id;
  if listing_seller is null then raise exception 'Listing not found.'; end if;
  new.seller_user_id := listing_seller;
  if new.buyer_user_id is null or new.buyer_user_id = listing_seller then raise exception 'Sellers cannot review themselves.'; end if;
  if not exists (
    select 1 from public.marketplace_threads
    where listing_id = new.listing_id and buyer_user_id = new.buyer_user_id and seller_user_id = listing_seller
  ) then raise exception 'Message the seller about this listing before rating them.'; end if;
  new.comment := nullif(btrim(new.comment), '');
  new.removal_requested_at := null;
  return new;
end; $$;
revoke all on function private.prepare_marketplace_review() from public, anon, authenticated;
create trigger prepare_marketplace_review before insert on public.marketplace_reviews
for each row execute function private.prepare_marketplace_review();

create or replace function private.refresh_marketplace_seller_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare seller uuid := coalesce(new.seller_user_id, old.seller_user_id);
begin
  update public.profiles p set
    seller_avg_rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.marketplace_reviews r where r.seller_user_id = seller), 0),
    seller_review_count = (select count(*) from public.marketplace_reviews r where r.seller_user_id = seller)
  where p.id = seller;
  return coalesce(new, old);
end; $$;
revoke all on function private.refresh_marketplace_seller_rating() from public, anon, authenticated;
create trigger refresh_marketplace_seller_rating after insert or delete on public.marketplace_reviews
for each row execute function private.refresh_marketplace_seller_rating();

alter table public.marketplace_reviews enable row level security;
create policy "Marketplace reviews are publicly readable" on public.marketplace_reviews for select to anon, authenticated using (true);
create policy "Buyers submit listing reviews" on public.marketplace_reviews for insert to authenticated with check (buyer_user_id = (select auth.uid()));
create policy "Buyers request review removal" on public.marketplace_reviews for update to authenticated
using (buyer_user_id = (select auth.uid())) with check (buyer_user_id = (select auth.uid()));

create table public.marketplace_saved_listings (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index marketplace_saved_listing_idx on public.marketplace_saved_listings (listing_id, created_at desc);
alter table public.marketplace_saved_listings enable row level security;
create policy "Users read their saved listings" on public.marketplace_saved_listings for select to authenticated using (user_id = (select auth.uid()));
create policy "Users save listings" on public.marketplace_saved_listings for insert to authenticated
with check (user_id = (select auth.uid()) and exists (select 1 from public.marketplace_listings l where l.id = listing_id and l.seller_user_id <> (select auth.uid()) and l.status in ('active','sold_out')));
create policy "Users unsave listings" on public.marketplace_saved_listings for delete to authenticated using (user_id = (select auth.uid()));

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in ('club_event','registration_status','membership_status','match_live','table_assignment','followed_player_live','delivery_test','club_message','club_reminder','marketplace_price_drop','marketplace_restock'));

create or replace function private.notify_marketplace_savers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.price < old.price then
    insert into public.notifications(user_id,type,title,message,href,metadata,dedupe_key)
    select s.user_id, 'marketplace_price_drop', 'Price drop on a saved item',
      left(new.title || ' now costs ' || new.currency || ' ' || trim(to_char(new.price, 'FM9999999990.00')), 500),
      '/marketplace/' || new.id, jsonb_build_object('listing_id',new.id,'old_price',old.price,'new_price',new.price),
      'market-price:' || new.id || ':' || extract(epoch from new.updated_at)::bigint
    from public.marketplace_saved_listings s where s.listing_id = new.id and s.user_id <> new.seller_user_id
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if old.status = 'sold_out' and new.status = 'active' then
    insert into public.notifications(user_id,type,title,message,href,metadata,dedupe_key)
    select s.user_id, 'marketplace_restock', 'A saved item is available again',
      left(new.title || ' is back in stock.', 500), '/marketplace/' || new.id,
      jsonb_build_object('listing_id',new.id), 'market-restock:' || new.id || ':' || extract(epoch from new.updated_at)::bigint
    from public.marketplace_saved_listings s where s.listing_id = new.id and s.user_id <> new.seller_user_id
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.notify_marketplace_savers() from public, anon, authenticated;
create trigger notify_marketplace_savers after update of price, status on public.marketplace_listings
for each row execute function private.notify_marketplace_savers();

revoke all on table public.marketplace_reviews, public.marketplace_saved_listings from public, anon, authenticated;
grant select on public.marketplace_reviews to anon, authenticated;
grant insert (listing_id,rating,comment), update (removal_requested_at) on public.marketplace_reviews to authenticated;
grant select, insert (listing_id), delete on public.marketplace_saved_listings to authenticated;
grant all on public.marketplace_reviews, public.marketplace_saved_listings to service_role;
grant select (seller_avg_rating,seller_review_count) on public.profiles to anon, authenticated;
