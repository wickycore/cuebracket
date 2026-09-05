import assert from "node:assert/strict";
import test from "node:test";

import {
  getMatchRaceTo,
  getTournamentRaceGroups,
  raceGroupHasPlayedActivity,
  setTournamentMatchesRaceTo,
} from "@/lib/tournament-races";
import { buildLeaderboardCompetition, updateLeaderboardMatch } from "@/lib/competition/leaderboard";
import { DEFAULT_TOURNAMENT_OPTIONS, type BracketMatch, type Tournament } from "@/lib/tournaments";

function match(id: string, round: number, overrides: Partial<BracketMatch> = {}): BracketMatch {
  return {
    id,
    round,
    position: 0,
    player1: "A",
    player2: "B",
    score1: null,
    score2: null,
    winner: null,
    completed: false,
    ...overrides,
  };
}

function tournament(): Tournament {
  return {
    id: "race-settings",
    name: "Round races",
    venue: "KPC",
    type: "single_stage",
    format: "single",
    raceTo: 5,
    bracketSize: 4,
    status: "draft",
    players: ["A", "B", "C", "D"],
    options: {
      roundRobinLegs: 1,
      swissRounds: 5,
      freeForAllRounds: 3,
      freeForAllHeatSize: 4,
      freeForAllTieRule: "split_points",
      leaderboardCycles: 2,
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
      groupCount: 2,
      qualifiersPerGroup: 2,
      finalStageFormat: "single",
      bracketResetEnabled: true,
    },
    bracket: {
      type: "single",
      rounds: [
        { round: 1, name: "Semi Finals", matches: [match("semi-1", 1), match("semi-2", 1)] },
        { round: 2, name: "Final", matches: [match("final", 2)] },
      ],
      generatedAt: "2026-09-01T00:00:00.000Z",
      champion: null,
    },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

test("round-specific races update only the selected phase", () => {
  const source = tournament();
  const groups = getTournamentRaceGroups(source);
  assert.deepEqual(groups.map((group) => group.label), ["Semi Finals", "Final"]);

  const structures = setTournamentMatchesRaceTo(source, ["final"], 9);
  const final = structures.bracket?.type === "single" ? structures.bracket.rounds[1].matches[0] : null;
  const semi = structures.bracket?.type === "single" ? structures.bracket.rounds[0].matches[0] : null;
  assert.equal(getMatchRaceTo(final!, source.raceTo), 9);
  assert.equal(getMatchRaceTo(semi!, source.raceTo), 5);
});

test("played rounds lock while automatic byes do not", () => {
  const playable = { id: "played", label: "Final", matches: [match("final", 2, { completed: true, winner: "A", score1: 5, score2: 2 })] };
  const automaticBye = { id: "bye", label: "Round 1", matches: [match("bye", 1, { player2: null, completed: true, winner: "A" })] };
  assert.equal(raceGroupHasPlayedActivity(playable), true);
  assert.equal(raceGroupHasPlayedActivity(automaticBye), false);
});

test("sets and standings creates six matches for three teams playing two sets each", () => {
  const teams = ["Brayo & Sammy", "Fidel & Sharon", "Wicky & Fiona"];
  const options = { ...DEFAULT_TOURNAMENT_OPTIONS, leaderboardCycles: 2 };
  const competition = buildLeaderboardCompetition(teams, options);
  const fixtures = competition.rounds.flatMap((round) => round.matches).filter((item) => item.player1 && item.player2);
  assert.equal(fixtures.length, 6);

  const first = fixtures[0];
  const updated = updateLeaderboardMatch(competition, teams, options, first.id, (target) => {
    target.score1 = 3;
    target.score2 = 1;
    target.winner = target.player1;
    target.completed = true;
    target.status = "finished";
  });
  const winner = updated.standings.find((row) => row.player === first.player1);
  const loser = updated.standings.find((row) => row.player === first.player2);
  assert.equal(winner?.won, 1);
  assert.equal(winner?.points, 3);
  assert.equal(loser?.lost, 1);
});
