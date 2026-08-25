import assert from "node:assert/strict";
import test from "node:test";

import { rowToTournament, type CloudTournamentRow } from "@/lib/cloud/tournaments";

test("cloud tournament rows preserve all modern engine payloads", () => {
  const row: CloudTournamentRow = {
    id: "cloud-test",
    owner_id: "00000000-0000-0000-0000-000000000001",
    club_id: null,
    name: "Cloud Swiss",
    venue: "KPC",
    stage_type: "single_stage",
    format: "swiss",
    race_to: 5,
    bracket_size: 7,
    status: "live",
    players: ["A", "B", "C", "D", "E", "F", "G"],
    options: null,
    bracket: null,
    competition: null,
    is_public: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const tournament = rowToTournament(row);
  assert.equal(tournament.format, "swiss");
  assert.equal(tournament.bracketSize, 7);
  assert.equal(tournament.options.pointsForWin, 3);
  assert.equal(tournament.status, "live");
});
