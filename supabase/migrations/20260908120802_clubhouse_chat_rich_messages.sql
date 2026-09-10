-- Compatibility marker retained for databases that already recorded this
-- migration version. The chat table is created by the later 17:00 migration;
-- the idempotent 19:30 migration applies the rich-message fields and policies.
select 1;
