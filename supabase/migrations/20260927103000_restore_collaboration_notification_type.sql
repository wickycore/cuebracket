-- Later notification migrations replaced the type list and accidentally
-- removed collaboration, causing invite/response triggers to roll back.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'club_event', 'registration_status', 'membership_status', 'match_live',
    'table_assignment', 'followed_player_live', 'delivery_test',
    'club_message', 'club_reminder', 'marketplace_price_drop',
    'marketplace_restock', 'collaboration'
  ));
