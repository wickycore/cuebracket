-- Close Marketplace interaction gaps found by regression testing.

create or replace function private.notify_marketplace_savers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.price < old.price then
    insert into public.notifications(user_id,type,title,message,href,metadata,dedupe_key)
    select s.user_id, 'marketplace_price_drop', 'Price drop on a saved item',
      left(new.title || ' now costs ' || new.currency || ' ' || trim(to_char(new.price, 'FM9999999990.00')), 500),
      '/marketplace/' || new.id, jsonb_build_object('listing_id',new.id,'old_price',old.price,'new_price',new.price),
      'market-price:' || new.id || ':' || new.currency || ':' || trim(to_char(new.price, 'FM9999999990.00'))
    from public.marketplace_saved_listings s where s.listing_id = new.id and s.user_id <> new.seller_user_id
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if old.status = 'sold_out' and new.status = 'active' then
    insert into public.notifications(user_id,type,title,message,href,metadata,dedupe_key)
    select s.user_id, 'marketplace_restock', 'A saved item is available again',
      left(new.title || ' is back in stock.', 500), '/marketplace/' || new.id,
      jsonb_build_object('listing_id',new.id), 'market-restock:' || new.id || ':' || extract(epoch from new.updated_at)::numeric::text
    from public.marketplace_saved_listings s where s.listing_id = new.id and s.user_id <> new.seller_user_id
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.notify_marketplace_savers() from public, anon, authenticated;

create table public.marketplace_review_removal_requests (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketplace_reviews(id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason text not null default 'Submitted in error' check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'open' check (status in ('open','approved','dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id)
);
drop policy "Buyers request review removal" on public.marketplace_reviews;
revoke update (removal_requested_at) on public.marketplace_reviews from authenticated;
create index marketplace_review_removal_requester_idx on public.marketplace_review_removal_requests(requester_id,created_at desc);
create index marketplace_review_removal_open_idx on public.marketplace_review_removal_requests(status,created_at desc);
create index marketplace_review_removal_reviewer_idx on public.marketplace_review_removal_requests(reviewed_by) where reviewed_by is not null;

create or replace function private.prepare_marketplace_review_removal_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.requester_id := (select auth.uid());
  if new.requester_id is null or not exists (
    select 1 from public.marketplace_reviews r where r.id=new.review_id and r.buyer_user_id=new.requester_id
  ) then raise exception 'You can only request removal of your own review.'; end if;
  new.reason := btrim(new.reason);
  new.status := 'open'; new.reviewed_by := null; new.reviewed_at := null;
  update public.marketplace_reviews set removal_requested_at=now() where id=new.review_id;
  return new;
end; $$;
revoke all on function private.prepare_marketplace_review_removal_request() from public, anon, authenticated;
create trigger prepare_marketplace_review_removal_request before insert on public.marketplace_review_removal_requests
for each row execute function private.prepare_marketplace_review_removal_request();

alter table public.marketplace_review_removal_requests enable row level security;
create policy "Buyers read their review removal requests" on public.marketplace_review_removal_requests for select to authenticated
using (requester_id=(select auth.uid()) or private.is_platform_admin((select auth.uid())));
create policy "Buyers request removal of their reviews" on public.marketplace_review_removal_requests for insert to authenticated
with check (requester_id=(select auth.uid()));
create policy "Platform admins review removal requests" on public.marketplace_review_removal_requests for update to authenticated
using (private.is_platform_admin((select auth.uid()))) with check (private.is_platform_admin((select auth.uid())));

create policy "Platform admins read marketplace listing reports" on public.marketplace_listing_reports for select to authenticated
using (private.is_platform_admin((select auth.uid())));
create policy "Platform admins review marketplace listing reports" on public.marketplace_listing_reports for update to authenticated
using (private.is_platform_admin((select auth.uid()))) with check (private.is_platform_admin((select auth.uid())));

create or replace function public.resolve_marketplace_review_removal(request_id uuid, resolution_value text)
returns void language plpgsql security definer set search_path='' as $$
declare request_row public.marketplace_review_removal_requests;
begin
  if not private.is_platform_admin(auth.uid()) then raise exception 'Platform administrator access required.'; end if;
  if resolution_value not in ('approved','dismissed') then raise exception 'Choose approved or dismissed.'; end if;
  select * into request_row from public.marketplace_review_removal_requests where id=request_id and status='open' for update;
  if request_row.id is null then raise exception 'Open request not found.'; end if;
  if resolution_value='approved' then
    delete from public.marketplace_reviews where id=request_row.review_id;
  else
    update public.marketplace_reviews set removal_requested_at=null where id=request_row.review_id;
  end if;
  update public.marketplace_review_removal_requests set status=resolution_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=request_id;
end; $$;
revoke all on function public.resolve_marketplace_review_removal(uuid,text) from public,anon;
grant execute on function public.resolve_marketplace_review_removal(uuid,text) to authenticated,service_role;

create or replace function public.list_marketplace_moderation_queue()
returns table(id uuid,kind text,subject text,detail text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_platform_admin(auth.uid()) then raise exception 'Platform administrator access required.'; end if;
  return query
    select r.id,'listing_report'::text,l.title,r.category||': '||r.details,r.status,r.created_at
    from public.marketplace_listing_reports r join public.marketplace_listings l on l.id=r.listing_id
    union all
    select q.id,'review_removal'::text,'Review by '||coalesce(p.display_name,'CueBracket buyer'),q.reason,q.status,q.created_at
    from public.marketplace_review_removal_requests q
    join public.marketplace_reviews r on r.id=q.review_id
    left join public.profiles p on p.id=r.buyer_user_id
    order by created_at desc;
end; $$;
revoke all on function public.list_marketplace_moderation_queue() from public,anon;
grant execute on function public.list_marketplace_moderation_queue() to authenticated,service_role;

revoke all on table public.marketplace_review_removal_requests from public,anon,authenticated;
grant select,insert(review_id,reason),update(status,reviewed_by,reviewed_at,updated_at) on public.marketplace_review_removal_requests to authenticated;
grant update(status,updated_at) on public.marketplace_listing_reports to authenticated;
grant all on public.marketplace_review_removal_requests to service_role;
