import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260901140910_club_identity_onboarding_media.sql", import.meta.url),
  "utf8",
);
const membership = readFileSync(new URL("../components/ClubCommunityPanel.tsx", import.meta.url), "utf8");
const media = readFileSync(new URL("../lib/cloud/media.ts", import.meta.url), "utf8");

test("membership requires the current guide, rules and club location", () => {
  assert.match(migration, /accepted_guide_revision is distinct from current_guide_revision/);
  assert.match(migration, /club_location/);
  assert.match(migration, /guide_rules/);
  assert.match(membership, /Read the club guide/);
  assert.match(membership, /I have read and accept the location information/);
});

test("public media is size-limited and uploads remain owner or organizer controlled", () => {
  assert.match(migration, /'cuebracket-media'/);
  assert.match(migration, /5242880/);
  assert.match(migration, /image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp/);
  assert.match(migration, /private\.is_club_admin/);
  assert.match(migration, /folders\[1\] = 'profiles'/);
  assert.match(migration, /folders\[1\] = 'tournaments'/);
  assert.match(media, /MAX_IMAGE_BYTES = 5 \* 1024 \* 1024/);
});

test("follower totals are public aggregates while follower identities stay private", () => {
  assert.match(migration, /create table if not exists public\.player_follower_counts/);
  assert.match(migration, /profile\.is_public/);
  assert.match(migration, /grant select on table public\.player_follower_counts to anon, authenticated/);
  assert.doesNotMatch(migration, /grant select on table public\.player_followers to anon/);
});
