import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clubAnnouncementLabel, validateClubAnnouncement } from "@/lib/club-command-center";

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
  assert.match(commandCenter, /Organizer launchpad/);
  assert.match(commandCenter, /ClubAnnouncementBoard/);
  assert.match(commandCenter, /TableManager clubId=\{club\.id\}/);
  assert.match(commandCenter, /Invite players in one tap/);
  assert.match(clubPage, /club_announcements/);
  assert.match(clubPage, /club_player_rankings/);
});
