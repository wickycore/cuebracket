import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLeagueFixtures,
  buildLeaguePlayoff,
  createNextLeagueSeason,
  getLeague,
  getLeagueStandings,
  resetLeaguePlayoffResult,
  saveLeaguePlayoffResult,
  saveLeagues,
  validateLeagueResult,
  type League,
  type LeaguePlayer,
} from "@/lib/leagues";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  },
});

function leagueFixture(playerCount = 4, overrides: Partial<League> = {}): League {
  const players: LeaguePlayer[] = Array.from({ length: playerCount }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}` }));
  return {
    id: "league-test",
    seriesId: "league-series",
    clubId: null,
    name: "Premier League",
    season: "Season 1",
    venue: "Club",
    gameType: "8-ball",
    raceTo: 5,
    format: "single-round-robin",
    winPoints: 3,
    lossPoints: 0,
    status: "live",
    startDate: "",
    endDate: "",
    players,
    fixtures: [],
    playoff: { enabled: true, qualifierCount: 4, status: "pending", qualifierPlayerIds: [], rounds: [], generatedAt: null },
    championPlayerId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("round robin scheduling covers every pairing once and supports a return leg", () => {
  const single = leagueFixture(5);
  const firstLeg = buildLeagueFixtures(single);
  assert.equal(firstLeg.length, 10);
  assert.equal(new Set(firstLeg.map((fixture) => [fixture.homePlayerId, fixture.awayPlayerId].sort().join(":"))).size, 10);

  const double = buildLeagueFixtures({ ...single, format: "home-and-away" });
  assert.equal(double.length, 20);
  assert.equal(Math.max(...double.map((fixture) => fixture.round)), 10);
});

test("race results require one winner to reach the exact target", () => {
  assert.equal(validateLeagueResult(5, 5, 4), null);
  assert.match(validateLeagueResult(5, 4, 3) ?? "", /valid race to 5/i);
  assert.match(validateLeagueResult(5, 5, 5) ?? "", /cannot finish level/i);
  assert.match(validateLeagueResult(5, 6, 2) ?? "", /valid race to 5/i);
});

test("standings apply head-to-head before overall frame difference", () => {
  const league = leagueFixture(4);
  league.fixtures = [
    { id: "a", round: 1, homePlayerId: "p1", awayPlayerId: "p2", homeScore: 5, awayScore: 4, completed: true, playedAt: null },
    { id: "b", round: 2, homePlayerId: "p1", awayPlayerId: "p3", homeScore: 5, awayScore: 4, completed: true, playedAt: null },
    { id: "c", round: 3, homePlayerId: "p4", awayPlayerId: "p1", homeScore: 5, awayScore: 0, completed: true, playedAt: null },
    { id: "d", round: 4, homePlayerId: "p2", awayPlayerId: "p3", homeScore: 5, awayScore: 0, completed: true, playedAt: null },
    { id: "e", round: 5, homePlayerId: "p2", awayPlayerId: "p4", homeScore: 5, awayScore: 0, completed: true, playedAt: null },
    { id: "f", round: 6, homePlayerId: "p3", awayPlayerId: "p4", homeScore: 5, awayScore: 4, completed: true, playedAt: null },
  ];
  const table = getLeagueStandings(league);
  assert.deepEqual(table.slice(0, 2).map((row) => row.playerId), ["p1", "p2"]);
  assert.ok(table[1].difference > table[0].difference);
  assert.equal(table[0].rank, 1);
});

test("playoffs seed the table and only crown the final winner", () => {
  const league = leagueFixture(4);
  league.fixtures = buildLeagueFixtures(league).map((fixture, index) => ({
    ...fixture,
    homeScore: 5,
    awayScore: index % 4,
    completed: true,
    playedAt: "2026-01-02T00:00:00.000Z",
  }));
  const playoff = buildLeaguePlayoff(league);
  assert.equal(playoff.rounds[0].matches.length, 2);
  assert.deepEqual(playoff.rounds[0].matches.map((match) => [match.seed1, match.seed2]), [[1, 4], [2, 3]]);

  saveLeagues([{ ...league, playoff }]);
  let stored = getLeague(league.id)!;
  for (const semi of stored.playoff.rounds[0].matches) {
    stored = saveLeaguePlayoffResult(stored.id, semi.id, 5, 2)!;
  }
  const final = stored.playoff.rounds[1].matches[0];
  assert.ok(final.player1Id && final.player2Id);
  assert.equal(stored.championPlayerId, null);
  stored = saveLeaguePlayoffResult(stored.id, final.id, 5, 3)!;
  assert.equal(stored.championPlayerId, final.player1Id);
  assert.equal(stored.status, "completed");

  stored = resetLeaguePlayoffResult(stored.id, stored.playoff.rounds[0].matches[0].id)!;
  assert.equal(stored.playoff.rounds[1].matches[0].completed, false);
  assert.equal(stored.championPlayerId, null);
});

test("creating a new season preserves the old record and resets competition state", () => {
  const oldSeason = leagueFixture(4, { status: "completed", championPlayerId: "p1" });
  saveLeagues([oldSeason]);
  const next = createNextLeagueSeason(oldSeason.id, "Season 2")!;
  assert.notEqual(next.id, oldSeason.id);
  assert.equal(next.seriesId, oldSeason.seriesId);
  assert.equal(next.season, "Season 2");
  assert.equal(next.status, "draft");
  assert.equal(next.championPlayerId, null);
  assert.equal(getLeague(oldSeason.id)?.championPlayerId, "p1");
});
