import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { placementLabel, RANKING_POINTS_DESCRIPTION } from "@/lib/rankings";

const migration = readFileSync(
  new URL("../supabase/migrations/20260828120000_phase_3c_co_organizers_and_4a_rankings.sql", import.meta.url),
  "utf8",
);

test("co-organizer access is accepted explicitly and keeps ownership protected", () => {
  assert.match(migration, /status in \('pending', 'accepted', 'declined'\)/);
  assert.match(migration, /collaborator\.status = 'accepted'/);
  assert.match(migration, /new\.owner_id is distinct from old\.owner_id/);
  assert.match(migration, /Co-organizers can manage matches, scores and tables/);
  assert.doesNotMatch(migration, /grant insert[^;]*tournament_match_results/);
});

test("verified rankings are trigger-maintained, row-secured and use security-invoker views", () => {
  assert.match(migration, /alter table public\.tournament_match_results enable row level security/);
  assert.match(migration, /create trigger refresh_results_after_tournament_change/);
  assert.match(migration, /create view public\.player_statistics\s+with \(security_invoker = true\)/);
  assert.match(migration, /create view public\.club_player_rankings\s+with \(security_invoker = true\)/);
  assert.match(migration, /coalesce\(matches\.wins, 0\) \* 10/);
  assert.match(RANKING_POINTS_DESCRIPTION, /100 for a title/);
});

test("podium labels are clear on player history", () => {
  assert.equal(placementLabel(1), "Champion");
  assert.equal(placementLabel(2), "Runner-up");
  assert.equal(placementLabel(3), "Third place");
  assert.equal(placementLabel(null), "Played");
});
