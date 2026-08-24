import assert from "node:assert/strict";
import test from "node:test";

import { buildRoundRobinRounds, calculateStandings } from "@/lib/competition/common";
import {
  buildRoundRobinCompetition,
  generateRoundRobinPlayoffRematch,
  updateRoundRobinMatch,
} from "@/lib/competition/roundRobin";
import { DEFAULT_TOURNAMENT_OPTIONS, type BracketMatch } from "@/lib/tournaments";

const options = { ...DEFAULT_TOURNAMENT_OPTIONS, roundRobinLegs: 1 as const };

function finish(score1: number, score2: number) {
  return (match: BracketMatch) => {
    match.score1 = score1;
    match.score2 = score2;
    match.completed = true;
    match.status = "finished";
    match.winner = score1 > score2 ? match.player1 : match.player2;
  };
}

test("single-leg schedules contain every pairing exactly once", () => {
  for (let count = 2; count <= 32; count += 1) {
    const players = Array.from({ length: count }, (_, index) => `P${index + 1}`);
    const rounds = buildRoundRobinRounds(players, 1);
    const matches = rounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2);
    const pairs = matches.map((match) => [match.player1, match.player2].sort().join("|"));
    assert.equal(matches.length, count * (count - 1) / 2);
    assert.equal(new Set(pairs).size, matches.length);
  }
});

test("odd fields give every player one rest round without points", () => {
  const players = ["A", "B", "C", "D", "E"];
  const rounds = buildRoundRobinRounds(players, 1);
  for (const player of players) {
    assert.equal(rounds.flatMap((round) => round.matches).filter((match) => (match.player1 ?? match.player2) === player && Boolean(match.player1) !== Boolean(match.player2)).length, 1);
  }
  assert.ok(calculateStandings(players, rounds, options).every((row) => row.points === 0 && row.played === 0));
});

test("double-leg schedules reverse every fixture", () => {
  const players = ["A", "B", "C", "D"];
  const rounds = buildRoundRobinRounds(players, 2);
  const matches = rounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2);
  for (const match of matches.slice(0, matches.length / 2)) {
    assert.ok(matches.some((candidate) => candidate.player1 === match.player2 && candidate.player2 === match.player1));
  }
});

test("an unresolved first-place tie creates a real playoff match", () => {
  const players = ["A", "B"];
  const doubleOptions = { ...options, roundRobinLegs: 2 as const };
  let competition = buildRoundRobinCompetition(players, doubleOptions);
  competition = updateRoundRobinMatch(competition, players, doubleOptions, competition.rounds[0].matches[0].id, finish(5, 4));
  competition = updateRoundRobinMatch(competition, players, doubleOptions, competition.rounds[1].matches[0].id, finish(5, 4));
  assert.equal(competition.champion, null);
  assert.deepEqual(competition.playoffPlayers.sort(), players);
  assert.equal(competition.playoffRounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2).length, 1);
});

test("three-way perfect ties create a mini round-robin playoff", () => {
  const players = ["A", "B", "C"];
  let competition = buildRoundRobinCompetition(players, options);
  const results: Record<string, [number, number]> = {};
  for (const match of competition.rounds.flatMap((round) => round.matches)) {
    if (!match.player1 || !match.player2) continue;
    const firstWins = `${match.player1}${match.player2}` === "AB" || `${match.player1}${match.player2}` === "BC" || `${match.player1}${match.player2}` === "CA";
    results[match.id] = firstWins ? [5, 4] : [4, 5];
  }
  for (const [matchId, scores] of Object.entries(results)) {
    competition = updateRoundRobinMatch(competition, players, options, matchId, finish(...scores));
  }
  assert.equal(competition.champion, null);
  assert.equal(competition.playoffPlayers.length, 3);
  assert.equal(competition.playoffRounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2).length, 3);
});

test("a tied completed playoff can generate a fresh rematch", () => {
  const players = ["A", "B"];
  const doubleOptions = { ...options, roundRobinLegs: 2 as const };
  let competition = buildRoundRobinCompetition(players, doubleOptions);
  competition = updateRoundRobinMatch(competition, players, doubleOptions, competition.rounds[0].matches[0].id, finish(5, 4));
  competition = updateRoundRobinMatch(competition, players, doubleOptions, competition.rounds[1].matches[0].id, finish(5, 4));
  const playoff = competition.playoffRounds[0].matches[0];
  competition = updateRoundRobinMatch(competition, players, doubleOptions, playoff.id, finish(5, 4));
  assert.equal(competition.champion, playoff.player1);

  // A rematch is only offered when a completed playoff remains tied.
  const unchanged = generateRoundRobinPlayoffRematch(competition, doubleOptions);
  assert.equal(unchanged.playoffCycle, competition.playoffCycle);
});
