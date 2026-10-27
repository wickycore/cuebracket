import assert from "node:assert/strict";
import test from "node:test";
import { buildRoundRobinCompetition, confirmLeaguePlayoffs, updateRoundRobinMatch } from "../lib/competition/roundRobin.ts";
import { DEFAULT_TOURNAMENT_OPTIONS } from "../lib/tournaments.ts";

const players = Array.from({ length: 10 }, (_, index) => `Player ${index + 1}`);
const options = { ...DEFAULT_TOURNAMENT_OPTIONS, roundRobinLegs: 2 as const, leaguePlayoffQualifiers: 6 as const, leaguePlayoffRaceTo: 5, leagueFinalRaceTo: 7 };

function play(competition: ReturnType<typeof buildRoundRobinCompetition>, matchId: string, firstWins = true) {
  return updateRoundRobinMatch(competition, players, options, matchId, (match) => {
    match.score1 = firstWins ? (match.raceTo ?? 3) : 0;
    match.score2 = firstWins ? 0 : (match.raceTo ?? 3);
    match.winner = firstWins ? match.player1 : match.player2;
    match.completed = true;
  });
}

test("ten-player home-and-away season has 18 rounds and 90 unique directed fixtures", () => {
  const league = buildRoundRobinCompetition(players, options);
  const matches = league.rounds.flatMap((r) => r.matches);
  assert.equal(league.rounds.length, 18);
  assert.equal(matches.length, 90);
  assert.equal(new Set(matches.map((m) => `${m.player1}|${m.player2}`)).size, 90);
});

test("six-player seeded playoffs advance from qualifiers through final; champion waits until final", () => {
  let league = buildRoundRobinCompetition(players, options);
  for (const round of league.rounds) for (const match of round.matches) league = play(league, match.id);
  assert.equal(league.champion, null);
  league = confirmLeaguePlayoffs(league, options);
  assert.equal(league.knockoutRounds?.[0].matches.length, 2);
  assert.equal(league.knockoutRounds?.[0].matches[0].player1, league.knockoutSeeds?.[2]);
  assert.equal(league.knockoutRounds?.[0].matches[0].player2, league.knockoutSeeds?.[5]);
  assert.equal(league.knockoutRounds?.[0].matches[1].player1, league.knockoutSeeds?.[3]);
  assert.equal(league.knockoutRounds?.[0].matches[1].player2, league.knockoutSeeds?.[4]);
  for (const match of league.knockoutRounds![0].matches) league = play(league, match.id);
  assert.equal(league.knockoutRounds?.[1].matches.length, 2);
  assert.equal(league.knockoutRounds?.[1].matches[0].player1, league.knockoutSeeds?.[0]);
  assert.equal(league.knockoutRounds?.[1].matches[1].player1, league.knockoutSeeds?.[1]);
  for (const match of league.knockoutRounds![1].matches) league = play(league, match.id);
  assert.equal(league.knockoutRounds?.[2].name, "Grand Final");
  assert.equal(league.champion, null);
  const final = league.knockoutRounds![2].matches[0];
  assert.equal(final.raceTo, 7);
  league = play(league, final.id);
  assert.equal(league.champion, final.player1);
});

test("classic round robin still crowns league leader", () => {
  const classic = { ...options, leaguePlayoffQualifiers: 0 as const };
  let league = buildRoundRobinCompetition(players, classic);
  for (const round of league.rounds) for (const match of round.matches) {
    league = updateRoundRobinMatch(league, players, classic, match.id, (m) => {
      m.score1 = 3; m.score2 = 0; m.completed = true; m.winner = m.player1;
    });
  }
  assert.ok(league.champion);
});
