import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildClubActivityFeed,
  clubAchievementIcon,
  clubAchievementLabel,
  validateClubAchievement,
} from "@/lib/club-command-center";

const migration = readFileSync(
  new URL("../supabase/migrations/20260901083517_add_club_achievement_wall.sql", import.meta.url),
  "utf8",
);
const accountDeletionMigration = readFileSync(
  new URL("../supabase/migrations/20260901083916_align_club_achievement_account_deletion.sql", import.meta.url),
  "utf8",
);
const wall = readFileSync(new URL("../components/ClubAchievementWall.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/clubs/[slug]/page.tsx", import.meta.url), "utf8");
const commandCenter = readFileSync(new URL("../components/ClubCommandCenter.tsx", import.meta.url), "utf8");

test("club achievements are validated and use fixed recognition categories", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  assert.equal(validateClubAchievement({
    recipientId: "123e4567-e89b-42d3-a456-426614174000",
    kind: "sportsmanship",
    title: "  Match night   mentor ",
    description: "Helped new members learn the format.",
    awardedOn: "2026-09-01",
    isFeatured: true,
  }, now).ok, true);
  assert.equal(validateClubAchievement({ recipientId: "not-a-user", kind: "custom", title: "No", description: "", awardedOn: "2026-09-02", isFeatured: false }, now).ok, false);
  assert.equal(clubAchievementLabel("contribution"), "Club contribution");
  assert.equal(clubAchievementIcon("champion"), "🏆");
});

test("achievement storage is row-secured, least-privileged and indexed", () => {
  assert.match(migration, /create table public\.club_achievements/);
  assert.match(migration, /alter table public\.club_achievements enable row level security/);
  assert.match(migration, /private\.is_club_member\(club_id\)/);
  assert.match(migration, /private\.is_club_admin\(club_id\)/);
  assert.match(migration, /Achievements can only be awarded to current club members/);
  assert.match(migration, /grant insert \(club_id, recipient_id, kind, title, description, awarded_on, is_featured\)/);
  assert.doesNotMatch(migration, /grant insert, update, delete on table public\.club_achievements/);
  assert.match(migration, /club_achievements_club_wall_idx/);
  assert.match(migration, /alter publication supabase_realtime add table public\.club_achievements/);
  assert.match(accountDeletionMigration, /recipient_id\) references auth\.users\(id\) on delete cascade/);
  assert.match(accountDeletionMigration, /awarded_by\) references auth\.users\(id\) on delete set null/);
});

test("achievement wall supports filters, spotlights and organizer controls", () => {
  for (const label of ["All honours", "Featured", "Competition", "Community", "Recognise a member", "Feature on Home"]) {
    assert.match(wall, new RegExp(label));
  }
  for (const label of ["5 events attended", "Club MVP this month", "Community champion"]) assert.match(wall, new RegExp(label));
  assert.match(page, /from\("club_achievements"\)/);
  assert.match(commandCenter, /ClubAchievementWall/);
  assert.match(commandCenter, /Member spotlight/);
  assert.match(commandCenter, /achievementCount/);
});

test("club achievements join the activity feed and route to rankings", () => {
  const activity = buildClubActivityFeed({
    announcements: [], tournaments: [], leagues: [], calendarEvents: [], challenges: [],
    achievements: [{
      id: "honour-1", club_id: "club-1", recipient_id: "user-1", recipient_name: "Wicky", awarded_by: "admin-1",
      kind: "milestone", title: "Fifty match wins", description: "A verified club milestone.",
      awarded_on: "2026-08-31", is_featured: true, image_url: null,
      created_at: "2026-09-01T09:00:00Z", updated_at: "2026-09-01T09:00:00Z",
    }],
  });
  assert.equal(activity[0]?.id, "achievement:honour-1");
  assert.equal(activity[0]?.tab, "rankings");
  assert.equal(activity[0]?.tone, "amber");
});
