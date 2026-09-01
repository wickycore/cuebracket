import assert from "node:assert/strict";
import test from "node:test";

import { buildSingleEliminationBracket, updateSingleEliminationMatch } from "@/lib/bracket/singleElimination";
import { buildDoubleEliminationBracket } from "@/lib/bracket/doubleElimination";
import { buildFreeForAllCompetition, updateFreeForAllHeat, updateFreeForAllPlayoffMatch } from "@/lib/competition/freeForAll";
import { buildLeaderboardCompetition, updateLeaderboardMatch } from "@/lib/competition/leaderboard";
import { buildSwissCompetition, updateSwissMatch } from "@/lib/competition/swiss";
import {
  areTwoStageQualificationTiesResolved,
  buildTwoStageCompetition,
  generateTwoStageFinals,
  updateTwoStageGroupMatch,
} from "@/lib/competition/twoStage";
import {
  DEFAULT_TOURNAMENT_OPTIONS,
  getBracketRounds,
  getTournamentEventCounts,
  type BracketMatch,
  type Tournament,
} from "@/lib/tournaments";

function players(count: number) {
  return Array.from({ length: count }, (_, index) => `P${String(index + 1).padStart(2, "0")}`);
}

function finish(score1: number, score2: number) {
  return (match: BracketMatch) => {
    match.score1 = score1;
    match.score2 = score2;
    match.winner = score1 > score2 ? match.player1 : match.player2;
    match.completed = true;
    match.status = "finished";
  };
}

function tournamentFixture(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: "test-tournament",
    name: "Engine test",
    venue: "Test table",
    type: "single_stage",
    format: "single",
    raceTo: 5,
    bracketSize: 32,
    status: "live",
    players: players(32),
    options: { ...DEFAULT_TOURNAMENT_OPTIONS },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("32-player elimination structures have the expected match capacity", () => {
  const single = buildSingleEliminationBracket(players(32), 32);
  assert.equal(getBracketRounds(single).flatMap((round) => round.matches).length, 31);

  const source = tournamentFixture({ format: "double" });
  const double = buildDoubleEliminationBracket(source);
  const activeMatches = getBracketRounds(double)
    .flatMap((round) => round.matches)
    .filter((match) => match.round !== 2 || !match.id.includes("grand-final-reset"));
  assert.ok(activeMatches.length >= 62);
});

test("reopening an upstream single-elimination result clears dependent progression", () => {
  let bracket = buildSingleEliminationBracket(["A", "B", "C", "D"], 4);
  const opener = bracket.rounds[0].matches[0];
  bracket = updateSingleEliminationMatch(bracket, opener.id, finish(5, 2));
  assert.ok(bracket.rounds[1].matches[0].player1 || bracket.rounds[1].matches[0].player2);

  bracket = updateSingleEliminationMatch(bracket, opener.id, (match) => {
    match.score1 = 4;
    match.score2 = 2;
    match.winner = null;
    match.completed = false;
    match.status = "live";
  });
  const final = bracket.rounds[1].matches[0];
  assert.ok(final.player1 === null || final.player2 === null);
  assert.equal(final.completed, false);
});

test("event statistics do not count empty downstream slots as BYEs", () => {
  const full = tournamentFixture({
    bracketSize: 4,
    players: ["A", "B", "C", "D"],
    bracket: buildSingleEliminationBracket(["A", "B", "C", "D"], 4),
  });
  assert.equal(getTournamentEventCounts(full).byes, 0);

  const withBye = tournamentFixture({
    bracketSize: 4,
    players: ["A", "B", "C"],
    bracket: buildSingleEliminationBracket(["A", "B", "C"], 4),
  });
  assert.equal(getTournamentEventCounts(withBye).byes, 1);
});

test("Swiss perfect ties generate and resolve a real playoff", () => {
  const field = ["Zulu", "Alpha", "Bravo", "Charlie"];
  const options = { ...DEFAULT_TOURNAMENT_OPTIONS, swissRounds: 1 };
  let competition = buildSwissCompetition(field, options);
  for (const match of competition.rounds[0].matches.filter((item) => item.player1 && item.player2)) {
    competition = updateSwissMatch(competition, field, options, match.id, finish(5, 0));
  }
  assert.equal(competition.champion, null);
  assert.equal(competition.standings.filter((row) => row.rank === 1).length, 2);
  assert.equal(competition.championshipTiePlayers?.length, 2);
  assert.equal(competition.playoffRounds.length, 1);
  const playoff = competition.playoffRounds[0].matches.find((match) => match.player1 && match.player2)!;
  competition = updateSwissMatch(competition, field, options, playoff.id, finish(5, 3));
  assert.equal(competition.champion, playoff.player1);
});

test("Leaderboard and Free For All perfect ties generate playable deciders", () => {
  const pair = ["Zulu", "Alpha"];
  const leaderboardOptions = { ...DEFAULT_TOURNAMENT_OPTIONS, leaderboardCycles: 2 };
  let leaderboard = buildLeaderboardCompetition(pair, leaderboardOptions);
  const matches = leaderboard.rounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2);
  leaderboard = updateLeaderboardMatch(leaderboard, pair, leaderboardOptions, matches[0].id, finish(5, 4));
  leaderboard = updateLeaderboardMatch(leaderboard, pair, leaderboardOptions, matches[1].id, finish(5, 4));
  assert.equal(leaderboard.champion, null);
  assert.equal(leaderboard.championshipTiePlayers?.length, 2);
  const leaderboardPlayoff = leaderboard.playoffRounds[0].matches.find((match) => match.player1 && match.player2)!;
  leaderboard = updateLeaderboardMatch(leaderboard, pair, leaderboardOptions, leaderboardPlayoff.id, finish(5, 1));
  assert.equal(leaderboard.champion, leaderboardPlayoff.player1);

  const heatPlayers = ["Zulu", "Alpha", "Bravo", "Charlie"];
  const ffaOptions = { ...DEFAULT_TOURNAMENT_OPTIONS, freeForAllRounds: 1, freeForAllHeatSize: 4 };
  let freeForAll = buildFreeForAllCompetition(heatPlayers, ffaOptions);
  freeForAll = updateFreeForAllHeat(
    freeForAll,
    heatPlayers,
    freeForAll.heats[0].id,
    Object.fromEntries(heatPlayers.map((player) => [player, 10])),
  );
  assert.equal(freeForAll.champion, null);
  assert.equal(freeForAll.standings.filter((row) => row.rank === 1).length, 4);
  assert.ok(freeForAll.playoffRounds.length > 0);
  for (const playoffMatch of freeForAll.playoffRounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2)) {
    freeForAll = updateFreeForAllPlayoffMatch(freeForAll, playoffMatch.id, finish(playoffMatch.player1 === "Zulu" ? 5 : 1, playoffMatch.player1 === "Zulu" ? 1 : 5));
  }
  assert.equal(freeForAll.champion, "Zulu");
});

test("two-stage finals stay locked while a cutoff tie is unresolved", () => {
  const field = ["A", "B", "C", "D"];
  const options = {
    ...DEFAULT_TOURNAMENT_OPTIONS,
    groupCount: 2,
    qualifiersPerGroup: 1,
    roundRobinLegs: 2 as const,
  };
  let competition = buildTwoStageCompetition(field, options);
  for (const group of competition.groups) {
    const groupMatches = group.rounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2);
    competition = updateTwoStageGroupMatch(competition, options, group.id, groupMatches[0].id, finish(5, 4));
    competition = updateTwoStageGroupMatch(competition, options, group.id, groupMatches[1].id, finish(5, 4));
  }
  assert.equal(areTwoStageQualificationTiesResolved(competition), false);
  assert.ok(competition.groups.every((group) => (group.qualificationPlayoffRounds?.length ?? 0) > 0));
  const generated = generateTwoStageFinals(competition, tournamentFixture({ players: field, type: "two_stage" }));
  assert.equal(generated.finalBracket, undefined);

  for (const group of competition.groups) {
    const playoff = group.qualificationPlayoffRounds?.flatMap((round) => round.matches).find((match) => match.player1 && match.player2);
    assert.ok(playoff);
    competition = updateTwoStageGroupMatch(competition, options, group.id, playoff.id, finish(5, 2));
  }
  assert.equal(areTwoStageQualificationTiesResolved(competition), true);
  const resolved = generateTwoStageFinals(competition, tournamentFixture({ players: field, type: "two_stage" }));
  assert.ok(resolved.finalBracket);
});
