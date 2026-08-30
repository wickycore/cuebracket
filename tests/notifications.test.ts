import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationIcon,
} from "@/lib/notifications";

const migration = readFileSync(
  new URL("../supabase/migrations/20260826093202_add_in_app_notifications.sql", import.meta.url),
  "utf8",
);

test("notification types keep useful defaults and distinct inbox icons", () => {
  assert.deepEqual(DEFAULT_NOTIFICATION_PREFERENCES, {
    club_events: true,
    registration_updates: true,
    match_alerts: true,
    followed_player_alerts: true,
  });
  assert.notEqual(notificationIcon("club_event"), notificationIcon("match_live"));
  assert.notEqual(notificationIcon("registration_status"), notificationIcon("membership_status"));
});

test("notification data is private, least-privileged and realtime", () => {
  assert.match(migration, /alter table public\.notifications enable row level security/);
  assert.match(migration, /using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(migration, /grant update \(read_at\) on table public\.notifications to authenticated/);
  assert.doesNotMatch(migration, /grant insert[^;]*public\.notifications to authenticated/);
  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/);
});

test("notification automation runs through private revoked trigger functions", () => {
  for (const functionName of [
    "notify_club_event_opened",
    "notify_registration_status",
    "notify_membership_status",
    "notify_match_participants",
  ]) {
    assert.match(migration, new RegExp(`function private\\.${functionName}\\(\\)`));
    assert.match(migration, new RegExp(`revoke all on function private\\.${functionName}\\(\\) from public, anon, authenticated`));
  }
  assert.match(migration, /unique \(tournament_id, match_key\)/);
});

test("every pair-match organizer engine announces an explicit match start", () => {
  for (const component of ["LiveMatchCenter.tsx", "CompetitionManager.tsx"]) {
    const source = readFileSync(
      new URL(`../components/${component}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /recordMatchStarted\(tournament, match\)/, component);
  }
});
