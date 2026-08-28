import assert from "node:assert/strict";
import test from "node:test";

import { rowToTournament, type CloudTournamentRow } from "@/lib/cloud/tournaments";
import { rowToLeague, type CloudLeagueRow } from "@/lib/cloud/leagues";
import type { League } from "@/lib/leagues";

test("cloud tournament rows preserve all modern engine payloads", () => {
  const row: CloudTournamentRow = {
    id: "cloud-test",
    owner_id: "00000000-0000-0000-0000-000000000001",
    club_id: "00000000-0000-0000-0000-000000000099",
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
  assert.equal(tournament.clubId, row.club_id);
  assert.equal(tournament.bracketSize, 7);
  assert.equal(tournament.options.pointsForWin, 3);
  assert.equal(tournament.status, "live");
});

test("cloud league payloads preserve seasons, registered identities and playoffs", () => {
  const payload = {
    id: "league-cloud",
    seriesId: "series-cloud",
    clubId: "00000000-0000-0000-0000-000000000099",
    name: "Club Premier League",
    season: "2026/27",
    venue: "KPC",
    gameType: "8-ball",
    raceTo: 5,
    format: "single-round-robin",
    winPoints: 3,
    lossPoints: 0,
    status: "live",
    startDate: "",
    endDate: "",
    players: [{ id: "p1", name: "Wicky", profileId: "profile-1", username: "wicky" }],
    fixtures: [],
    playoff: { enabled: true, qualifierCount: 4, status: "pending", qualifierPlayerIds: [], rounds: [], generatedAt: null },
    championPlayerId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as League;
  const row: CloudLeagueRow = {
    id: payload.id,
    owner_id: "00000000-0000-0000-0000-000000000001",
    club_id: payload.clubId,
    name: payload.name,
    season: payload.season,
    payload,
    is_public: true,
    created_at: payload.createdAt,
    updated_at: payload.updatedAt,
  };
  const league = rowToLeague(row);
  assert.equal(league.seriesId, "series-cloud");
  assert.equal(league.players[0].profileId, "profile-1");
  assert.equal(league.playoff.qualifierCount, 4);
});
