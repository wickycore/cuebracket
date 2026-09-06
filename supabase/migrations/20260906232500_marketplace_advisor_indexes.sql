-- Cover marketplace foreign keys reported by the Supabase performance advisor.
create index marketplace_threads_buyer_idx on public.marketplace_threads (buyer_user_id, updated_at desc);
create index marketplace_messages_sender_idx on public.marketplace_messages (sender_user_id);
create index marketplace_reports_reporter_idx on public.marketplace_listing_reports (reporter_id, created_at desc);
