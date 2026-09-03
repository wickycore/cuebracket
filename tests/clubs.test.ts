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

test("only club owners can grant, demote or remove admin access", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260902092753_owner_only_club_admin_roles.sql", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("../components/ClubCommunityPanel.tsx", import.meta.url),
    "utf8",
  );
  const client = readFileSync(
    new URL("../lib/cloud/clubs.ts", import.meta.url),
    "utf8",
  );

  assert.match(migration, /private\.is_club_owner\(club_id\)/);
  assert.match(migration, /create policy "Club owners assign member roles"/);
  assert.match(migration, /private\.is_club_admin\(club_id\) and role = 'member'/);
  assert.match(migration, /revoke all on function private\.is_club_owner\(uuid\) from public/);
  assert.match(panel, /const isOwner = ownRole === "owner" && club\.owner_id === userId/);
  assert.match(panel, /isOwner \|\| member\.role === "member"/);
  assert.match(client, /Only the club owner can assign or remove admin access/);
});

test("club organizers are notified and management refreshes when membership requests arrive", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260902205617_notify_club_membership_requests.sql", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("../components/ClubCommunityPanel.tsx", import.meta.url),
    "utf8",
  );
  const workspace = readFileSync(
    new URL("../components/ClubAdminWorkspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(migration, /function private\.notify_club_membership_request\(\)/);
  assert.match(migration, /after insert on public\.club_membership_requests/);
  assert.match(migration, /member\.role in \('owner', 'admin'\)/);
  assert.match(migration, /\/manage\?section=people/);
  assert.match(migration, /revoke all on function private\.notify_club_membership_request\(\) from public, anon, authenticated/);
  assert.match(panel, /table: "club_membership_requests"/);
  assert.match(panel, /Refresh requests/);
  assert.match(workspace, /We will not show an incorrect zero/);
});

test("public club pages expose a showcase while approved members unlock the private club", () => {
  const privacyMigration = readFileSync(
    new URL("../supabase/migrations/20260903090323_club_public_showcase_member_privacy.sql", import.meta.url),
    "utf8",
  );
  const directory = readFileSync(new URL("../app/clubs/page.tsx", import.meta.url), "utf8");
  const clubPage = readFileSync(new URL("../app/clubs/[slug]/page.tsx", import.meta.url), "utf8");
  const commandCenter = readFileSync(new URL("../components/ClubCommandCenter.tsx", import.meta.url), "utf8");

  assert.match(privacyMigration, /create policy "Approved members read their club roster"/);
  assert.match(privacyMigration, /create policy "Followers read own follow and organizers read followers"/);
  assert.match(privacyMigration, /revoke select on table public\.club_followers from anon/);
  assert.match(privacyMigration, /create table if not exists public\.club_member_counts/);
  assert.match(privacyMigration, /create table if not exists public\.club_follower_counts/);
  assert.match(privacyMigration, /create policy "Approved members read club announcements"/);
  assert.match(privacyMigration, /create policy "Approved members read club calendar events"/);
  assert.match(privacyMigration, /create policy "Approved members read club challenges"/);
  assert.match(directory, /from\("club_member_counts"\)/);
  assert.doesNotMatch(directory, /from\("club_followers"\)/);
  assert.match(clubPage, /isMember \? supabase\.from\("club_members"\)/);
  assert.match(clubPage, /isMember \? supabase\.from\("club_announcements"\)/);
  assert.match(commandCenter, /The member directory is private/);
  assert.match(commandCenter, /The clubhouse is for approved members/);
});

test("approved members can open every clubmate profile without exposing private profiles publicly", () => {
  const privacyMigration = readFileSync(
    new URL("../supabase/migrations/20260903090323_club_public_showcase_member_privacy.sql", import.meta.url),
    "utf8",
  );
  const commandCenter = readFileSync(new URL("../components/ClubCommandCenter.tsx", import.meta.url), "utf8");
  const profilePage = readFileSync(new URL("../app/players/[username]/page.tsx", import.meta.url), "utf8");

  assert.match(privacyMigration, /function private\.shares_club_with\(target_user uuid\)/);
  assert.match(privacyMigration, /create policy "Public or shared club profiles readable"/);
  assert.match(privacyMigration, /or private\.shares_club_with\(id\)/);
  assert.match(commandCenter, /member\.username \?\? member\.userId/);
  assert.match(profilePage, /UUID_PATTERN\.test\(identifier\)/);
  assert.match(profilePage, /robots: profile\.is_public && profile\.username/);
  assert.match(profilePage, /This profile is shared privately with approved club members/);
});
