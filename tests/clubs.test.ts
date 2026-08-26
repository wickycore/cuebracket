import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeClubSlug, validateClubDetails } from "@/lib/clubs";

test("club links normalize into short public-safe slugs", () => {
  assert.equal(normalizeClubSlug("  Kasarani Pool Club!  "), "kasarani-pool-club");
  assert.equal(normalizeClubSlug("A___B"), "a-b");
  assert.equal(normalizeClubSlug("---"), "");
});

test("club details reject unsafe or unusable public identities", () => {
  assert.equal(validateClubDetails({ name: "K", slug: "k", location: "", description: "" }).ok, false);
  assert.equal(validateClubDetails({ name: "KPC", slug: "kpc", location: "Nairobi", description: "Weekly pool tournaments" }).ok, true);
  assert.equal(validateClubDetails({ name: "KPC", slug: "ab", location: "", description: "" }).ok, false);
});

test("club membership migration keeps follows lightweight and stores request names privately", () => {
  const source = readFileSync(
    new URL("../supabase/migrations/20260826085636_add_club_community_foundation.sql", import.meta.url),
    "utf8",
  );
  const followerTable = source.slice(source.indexOf("create table if not exists public.club_followers"), source.indexOf("create table if not exists public.club_membership_requests"));
  const requestTable = source.slice(source.indexOf("create table if not exists public.club_membership_requests"), source.indexOf("create unique index if not exists club_membership_requests_pending_unique_idx"));
  assert.doesNotMatch(followerTable, /request_name/);
  assert.match(requestTable, /request_name text not null/);
  assert.match(source, /protect_club_owner_membership/);
});
