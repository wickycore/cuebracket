import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildClubActivityFeed, clubAnnouncementLabel, validateClubAnnouncement, validateClubCalendarEvent, validateClubChallenge } from "@/lib/club-command-center";

const migration = readFileSync(
  new URL("../supabase/migrations/20260829093830_add_club_command_center.sql", import.meta.url),
  "utf8",
);
const commandCenter = readFileSync(
  new URL("../components/ClubCommandCenter.tsx", import.meta.url),
  "utf8",
);
const clubPage = readFileSync(
  new URL("../app/clubs/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const adminWorkspace = readFileSync(
  new URL("../components/ClubAdminWorkspace.tsx", import.meta.url),
  "utf8",
);
const managePage = readFileSync(
  new URL("../app/clubs/[slug]/manage/page.tsx", import.meta.url),
  "utf8",
);
const communityMigration = readFileSync(
  new URL("../supabase/migrations/20260831221136_add_club_calendar_and_practice_board.sql", import.meta.url),
  "utf8",
);

test("club announcements are validated before they reach Supabase", () => {
  assert.equal(validateClubAnnouncement({ kind: "event", title: "  Friday   Open ", body: " Doors at 6. " }).ok, true);
  assert.equal(validateClubAnnouncement({ kind: "general", title: "No", body: "Update" }).ok, false);
  assert.equal(validateClubAnnouncement({ kind: "venue", title: "Venue update", body: "" }).ok, false);
  assert.equal(clubAnnouncementLabel("result"), "Result");
});

test("club announcement storage is row-secured, indexed, least-privileged and realtime", () => {
  assert.match(migration, /create table public\.club_announcements/);
  assert.match(migration, /alter table public\.club_announcements enable row level security/);
  assert.match(migration, /private\.is_club_admin\(club_id\)/);
  assert.match(migration, /author_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /grant insert \(club_id, kind, title, body, is_pinned\)/);
  assert.doesNotMatch(migration, /grant insert, update, delete on table public\.club_announcements/);
  assert.match(migration, /alter publication supabase_realtime add table public\.club_announcements/);
  assert.match(migration, /club_announcements_club_feed_idx/);
});

test("the Club Command Center exposes the complete friendly club menu", () => {
  for (const label of ["Home", "Events", "Rankings", "Members", "Clubhouse"]) {
    assert.match(commandCenter, new RegExp(`label: \"${label}\"`));
  }
  assert.match(commandCenter, /Manage club →/);
  assert.match(commandCenter, /ClubAnnouncementBoard/);
  assert.doesNotMatch(commandCenter, /TableManager/);
  assert.match(commandCenter, /Invite players in one tap/);
  assert.match(clubPage, /club_announcements/);
  assert.match(clubPage, /club_player_rankings/);
  assert.match(commandCenter, /ClubCalendarBoard/);
  assert.match(commandCenter, /ClubPracticeBoard/);
  assert.match(commandCenter, /Club activity/);
});

test("club administration has a dedicated server-protected workspace", () => {
  for (const label of ["Overview", "People", "Content", "Operations"]) {
    assert.match(adminWorkspace, new RegExp(`label: "${label}"`));
  }
  assert.match(adminWorkspace, /Private organizer workspace/);
  assert.match(adminWorkspace, /TableManager clubId=\{props\.club\.id\}/);
  assert.match(adminWorkspace, /managementOnly/);
  assert.match(adminWorkspace, /isAdmin/);
  assert.match(managePage, /supabase\.auth\.getUser\(\)/);
  assert.match(managePage, /role !== "owner" && role !== "admin"/);
  assert.match(managePage, /redirect\(`\/clubs\/\$\{club\.slug\}`\)/);
  assert.match(managePage, /robots: \{ index: false, follow: false \}/);
});

test("the member club page never exposes organizer controls inline", () => {
  assert.match(commandCenter, /isAdmin=\{false\}/);
  assert.match(commandCenter, /pendingRequests=\{\[\]\}/);
  assert.doesNotMatch(commandCenter, /Organizer launchpad/);
  assert.doesNotMatch(commandCenter, /Create the next event/);
  assert.doesNotMatch(commandCenter, /\+ Create tournament/);
});

test("calendar events and practice challenges are validated before storage", () => {
  const now = new Date("2026-08-31T12:00:00Z");
  assert.equal(validateClubCalendarEvent({ title: "  Friday   practice ", kind: "practice", description: "", startsAt: "2026-09-01T18:00:00Z", location: "Main room", capacity: 12 }, now).ok, true);
  assert.equal(validateClubCalendarEvent({ title: "Past event", kind: "social", description: "", startsAt: "2026-08-30T18:00:00Z", location: "", capacity: null }, now).ok, false);
  assert.equal(validateClubChallenge({ title: "Race to seven", message: "Friendly set", gameType: "8-ball", skillLevel: "any", raceTo: 7, preferredAt: "2026-09-01T18:00:00Z", venue: "Table 2", expiresAt: "2026-09-14T12:00:00Z" }, now).ok, true);
  assert.equal(validateClubChallenge({ title: "No", message: "", gameType: "any", skillLevel: "any", venue: "", expiresAt: "2026-09-14T12:00:00Z" }, now).ok, false);
});

test("club activity merges community updates into newest-first order", () => {
  const activity = buildClubActivityFeed({
    announcements: [{ id: "a", club_id: "c", author_id: "u", kind: "general", title: "Welcome", body: "Hello", is_pinned: false, published_at: "2026-08-31T10:00:00Z", created_at: "2026-08-31T10:00:00Z", updated_at: "2026-08-31T10:00:00Z" }],
    tournaments: [], leagues: [], challenges: [],
    calendarEvents: [{ id: "e", club_id: "c", creator_id: "u", title: "Practice night", kind: "practice", description: "", starts_at: "2026-09-02T18:00:00Z", ends_at: null, location: "Club", capacity: 10, is_cancelled: false, going_count: 2, maybe_count: 1, created_at: "2026-08-31T11:00:00Z", updated_at: "2026-08-31T11:00:00Z" }],
  });
  assert.deepEqual(activity.map((item) => item.id), ["calendar:e", "announcement:a"]);
  assert.equal(activity[0]?.tab, "events");
});

test("community tables use RLS, narrow grants, membership checks and serialized responses", () => {
  for (const table of ["club_calendar_events", "club_calendar_rsvps", "club_challenges"]) {
    assert.match(communityMigration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(communityMigration, /private\.is_club_member\(target_club uuid\)/);
  assert.match(communityMigration, /for update;/);
  assert.match(communityMigration, /grant insert \(club_id, title, message, game_type/);
  assert.doesNotMatch(communityMigration, /grant update .*public\.club_challenges to authenticated/);
  assert.match(communityMigration, /security definer/);
  assert.match(communityMigration, /respond_to_club_challenge/);
});
