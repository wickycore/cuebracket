import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260829091935_fix_cloud_backup_rls_recursion.sql",
    import.meta.url,
  ),
  "utf8",
);

test("cloud backup policies use non-recursive security-definer lookups", () => {
  assert.match(
    migration,
    /create or replace function private\.is_tournament_owner/,
  );
  assert.match(
    migration,
    /create or replace function private\.is_tournament_collaborator/,
  );
  assert.match(migration, /security definer/g);
  assert.match(migration, /set search_path = ''/g);
  assert.match(
    migration,
    /select private\.is_tournament_collaborator\(id\)/,
  );
  assert.match(
    migration,
    /select private\.is_tournament_owner\(tournament_id\)/,
  );
});

test("cloud backup helpers only answer for the signed-in user", () => {
  assert.match(migration, /\(select auth\.uid\(\)\) is not null/g);
  assert.match(
    migration,
    /tournament\.owner_id = \(select auth\.uid\(\)\)/,
  );
  assert.match(
    migration,
    /collaborator\.user_id = \(select auth\.uid\(\)\)/,
  );
  assert.match(migration, /collaborator\.status = 'accepted'/);
  assert.match(
    migration,
    /revoke all on function private\.is_tournament_owner\(text\)/,
  );
});
