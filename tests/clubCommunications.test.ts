import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CLUB_BROADCAST_TEMPLATES, clubBroadcastAudienceLabel, validateClubBroadcast } from "@/lib/club-communications";

const migration = readFileSync(new URL("../supabase/migrations/20260901095000_add_club_communications_and_reminders.sql", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/ClubCommunicationCenter.tsx", import.meta.url), "utf8");
const communicationModel = readFileSync(new URL("../lib/club-communications.ts", import.meta.url), "utf8");
const managePage = readFileSync(new URL("../app/clubs/[slug]/manage/page.tsx", import.meta.url), "utf8");
const pushWorker = readFileSync(new URL("../supabase/functions/push-notifications/index.ts", import.meta.url), "utf8");

test("club broadcasts validate fixed audiences, templates and useful copy", () => {
  assert.equal(CLUB_BROADCAST_TEMPLATES.length, 5);
  assert.equal(validateClubBroadcast({ audience: "members", template: "meeting", title: " Club   meeting ", message: "Friday at 7." }).ok, true);
  assert.equal(validateClubBroadcast({ audience: "members", template: "meeting", title: "No", message: "Friday" }).ok, false);
  assert.equal(validateClubBroadcast({ audience: "everyone", template: "general", title: "Club update", message: "x".repeat(501) }).ok, false);
  assert.equal(clubBroadcastAudienceLabel("everyone"), "Members & followers");
});

test("broadcast storage is private, least-privileged and role checked", () => {
  assert.match(migration, /alter table public\.club_broadcasts enable row level security/);
  assert.match(migration, /using \(private\.is_club_admin\(club_id\)\)/);
  assert.match(migration, /revoke all on table public\.club_broadcasts from anon, authenticated/);
  assert.match(migration, /grant select on table public\.club_broadcasts to authenticated/);
  assert.doesNotMatch(migration, /grant insert[^;]*club_broadcasts to authenticated/);
  assert.match(migration, /alter table private\.club_broadcast_receipts enable row level security/);
  assert.match(migration, /sender uuid := auth\.uid\(\)/);
  assert.match(migration, /not private\.is_club_admin\(target_club\)/);
  assert.match(migration, />= 5 then/);
});

test("broadcast fan-out respects preferences without exposing follower lists", () => {
  assert.match(migration, /target_audience in \('everyone', 'members'\)/);
  assert.match(migration, /target_audience in \('everyone', 'followers'\)/);
  assert.match(migration, /not preference\.club_messages/);
  assert.match(migration, /'club-message:' \|\| result\.id/);
  assert.match(migration, /recipient_count = delivered/);
  assert.match(migration, /refresh_club_broadcast_open_count/);
  assert.match(migration, /refresh_club_broadcast_phone_counts/);
});

test("RSVP reminders are automatic, deduplicated and preference aware", () => {
  assert.match(migration, /function private\.send_due_club_reminders\(\)/);
  assert.match(migration, /rsvp\.response in \('going', 'maybe'\)/);
  assert.match(migration, /event\.starts_at <= now\(\) \+ interval '24 hours'/);
  assert.match(migration, /'club-reminder:' \|\| event\.id/);
  assert.match(migration, /'cuebracket-club-reminders'/);
  assert.match(migration, /'\*\/15 \* \* \* \*'/);
});

test("the organizer workspace exposes templates, audiences and aggregate delivery", () => {
  for (const label of ["General update", "Tournament", "Club meeting", "Venue change", "Registration"]) assert.match(communicationModel, new RegExp(label));
  for (const label of ["Inbox", "Opened", "Phone", "Failed"]) assert.match(component, new RegExp(label));
  assert.match(component, /five sends per organizer every ten minutes/);
  assert.match(managePage, /club_broadcasts/);
  assert.match(pushWorker, /club_messages/);
});
