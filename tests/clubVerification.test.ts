import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260906223000_verified_club_badges.sql", "utf8");
const directory = readFileSync("components/ClubDirectory.tsx", "utf8");
const header = readFileSync("components/ClubCommandCenter.tsx", "utf8");
const preview = readFileSync("app/clubs/[slug]/opengraph-image.tsx", "utf8");
const admin = readFileSync("app/admin/clubs/verification/page.tsx", "utf8");
const advisorFix = readFileSync("supabase/migrations/20260906223500_verified_club_badge_advisor_fixes.sql", "utf8");

test("new clubs start unverified and organizers cannot change verification", () => {
  assert.match(migration, /is_verified boolean not null default false/);
  assert.match(migration, /new\.is_verified := false/);
  assert.match(migration, /Only a CueBracket platform administrator can change verification/);
  assert.doesNotMatch(header, /checkVerificationEligibility|missingCriteria|criteria met/i);
});

test("eligibility requires all four trusted club criteria without auto granting", () => {
  assert.match(migration, /has_location_and_hours/);
  assert.match(migration, /has_completed_guide/);
  assert.match(migration, /event_count < 3/);
  assert.match(migration, /member_count < 5/);
  assert.match(migration, /where e\.eligible and not c\.is_verified/);
  assert.match(migration, /create or replace function public\.approve_club_verification[\s\S]*update public\.clubs set\s+is_verified = true/);
  assert.doesNotMatch(migration, /after insert or update[\s\S]*is_verified/i);
  assert.match(admin, /list_clubs_eligible_for_verification/);
});

test("manual approval renders verified clubs in directory header and share preview", () => {
  assert.match(migration, /approve_club_verification/);
  assert.match(migration, /verified_by = auth\.uid\(\)/);
  assert.match(advisorFix, /clubs_verified_by_idx/);
  assert.match(directory, /Verified only/);
  assert.match(directory, /club\.is_verified \? <ClubVerifiedBadge/);
  assert.match(header, /club\.is_verified \? <ClubVerifiedBadge/);
  assert.match(preview, /club\?\.is_verified/);
  assert.match(preview, /Verified CueBracket club/);
});
