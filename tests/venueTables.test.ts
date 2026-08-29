import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260828131500_phase_4c_venue_table_control.sql", import.meta.url),
  "utf8",
);

test("venue tables are row-secured, least-privileged and realtime", () => {
  assert.match(migration, /alter table public\.venue_tables enable row level security/);
  assert.match(migration, /grant insert \(club_id, name, note, sort_order\)/);
  assert.match(migration, /grant update \([\s\S]*active_match_id[\s\S]*\) on table public\.venue_tables/);
  assert.doesNotMatch(migration, /grant update \([\s\S]*owner_id[\s\S]*\) on table public\.venue_tables/);
  assert.match(migration, /alter publication supabase_realtime add table public\.venue_tables/);
});

test("co-organizers can control only accepted tournament table assignments", () => {
  assert.match(migration, /collaborator\.status = 'accepted'/);
  assert.match(migration, /venue_tables\.active_event_type = 'tournament'/);
  assert.match(migration, /venue_tables\.active_event_id = collaborator\.tournament_id/);
  assert.doesNotMatch(migration, /Co-organizers.*delete venue tables/);
});

test("every pair-match surface uses cloud table assignment and automatic release", () => {
  for (const component of ["LiveMatchCenter.tsx", "CompetitionManager.tsx", "LeagueFixtures.tsx", "LeaguePlayoffs.tsx"]) {
    const source = readFileSync(new URL(`../components/${component}`, import.meta.url), "utf8");
    assert.match(source, /assignVenueTable/, component);
    assert.match(source, /releaseVenueTable/, component);
  }
  const cloudClient = readFileSync(new URL("../lib/cloud/tables.ts", import.meta.url), "utf8");
  assert.match(cloudClient, /active_match_id\.is\.null,active_match_id\.eq/);
});
