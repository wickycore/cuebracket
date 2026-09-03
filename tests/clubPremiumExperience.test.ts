import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateClubGalleryItem, validateClubReport } from "@/lib/club-command-center";

const migration = readFileSync(new URL("../supabase/migrations/20260903100251_add_premium_club_gallery_and_moderation.sql", import.meta.url), "utf8");
const commandCenter = readFileSync(new URL("../components/ClubCommandCenter.tsx", import.meta.url), "utf8");
const gallery = readFileSync(new URL("../components/ClubGallery.tsx", import.meta.url), "utf8");
const moderation = readFileSync(new URL("../components/ClubModerationCenter.tsx", import.meta.url), "utf8");
const reportButton = readFileSync(new URL("../components/ClubReportMemberButton.tsx", import.meta.url), "utf8");
const story = readFileSync(new URL("../app/clubs/[slug]/achievements/[achievementId]/page.tsx", import.meta.url), "utf8");

test("gallery and report input validation rejects unsafe values", () => {
  const now = new Date("2026-09-03T12:00:00Z");
  assert.deepEqual(validateClubGalleryItem({ caption: "  Finals   night ", occurredOn: "2026-09-02" }, now), {
    ok: true,
    value: { caption: "Finals night", occurredOn: "2026-09-02" },
  });
  assert.equal(validateClubGalleryItem({ caption: "x".repeat(221), occurredOn: "2026-09-02" }, now).ok, false);
  assert.equal(validateClubGalleryItem({ caption: "Future", occurredOn: "2026-09-04" }, now).ok, false);
  assert.equal(validateClubReport({ category: "club_rules", details: "Threatening conduct during practice." }).ok, true);
  assert.equal(validateClubReport({ category: "other", details: "bad" }).ok, false);
});

test("gallery is public showcase content with organizer-only writes", () => {
  assert.match(migration, /create table public\.club_gallery_items/);
  assert.match(migration, /alter table public\.club_gallery_items enable row level security/);
  assert.match(migration, /club\.is_public/);
  assert.match(migration, /Club admins create gallery items/);
  assert.match(migration, /grant insert \(club_id, image_url, caption, occurred_on\)/);
  assert.doesNotMatch(migration, /grant all on table public\.club_gallery_items to authenticated/);
  assert.match(gallery, /Club gallery/);
  assert.match(gallery, /maximum 5 MB/);
  assert.match(commandCenter, /id: "gallery"/);
});

test("personalized home is member-only and uses real club data", () => {
  assert.match(commandCenter, /isMember \? <PersonalizedClubHome/);
  for (const label of ["Your next event", "Your club rank", "Club opportunities", "Complete your profile", "People you may know"]) {
    assert.match(commandCenter, new RegExp(label));
  }
  assert.match(commandCenter, /FollowPlayerButton/);
});

test("achievement cards open durable public story pages", () => {
  assert.match(migration, /recipient_name/);
  assert.match(story, /generateMetadata/);
  assert.match(story, /Recognised player/);
  assert.match(story, /Achievement date/);
  assert.match(story, /View player profile/);
});

test("moderation is private, least-privileged and hierarchy-aware", () => {
  for (const table of ["club_member_reports", "club_member_restrictions", "club_member_blocks"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /private\.can_moderate_club_user/);
  assert.match(migration, /private\.is_club_owner\(target_club\)/);
  assert.match(migration, /This account cannot join this club/);
  assert.match(migration, /Your posting access is muted in this club/);
  assert.match(migration, /and is_suspended/);
  for (const label of ["Moderation center", "Suspend", "Mute", "Remove", "Block", "Unblock"]) {
    assert.match(moderation, new RegExp(label));
  }
  assert.match(reportButton, /sent only to club organizers/i);
  assert.match(reportButton, /reported member will not see who reported/i);
});
