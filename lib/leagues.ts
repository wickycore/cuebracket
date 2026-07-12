"use client";

export type LeagueStatus = "draft" | "live" | "completed";
export type LeagueFormat = "single-round-robin" | "home-and-away";

export interface LeaguePlayer {
  id: string;
  name: string;
}

export interface LeagueFixture {
  id: string;
  round: number;
  homePlayerId: string;
  awayPlayerId: string;
  homeScore: number | null;
  awayScore: number | null;
  completed: boolean;
  playedAt: string | null;
}

export interface League {
  id: string;
  name: string;
  season: string;
  venue: string;
  gameType: "8-ball" | "9-ball" | "10-ball" | "snooker" | "blackball";
  raceTo: number;
  format: LeagueFormat;
  winPoints: number;
  lossPoints: number;
  status: LeagueStatus;
  startDate: string;
  endDate: string;
  players: LeaguePlayer[];
  fixtures: LeagueFixture[];
  createdAt: string;
  updatedAt: string;
}

export interface LeagueInput {
  name: string;
  season: string;
  venue: string;
  gameType: League["gameType"];
  raceTo: number;
  format: LeagueFormat;
  winPoints: number;
  lossPoints: number;
  startDate: string;
  endDate: string;
}

export interface StandingRow {
  playerId: string;
  playerName: string;
  played: number;
  won: number;
  lost: number;
  framesFor: number;
  framesAgainst: number;
  difference: number;
  points: number;
}

const STORAGE_KEY = "cuebracket:leagues:v1";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function makeId(prefix = "league") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeLeague(league: League): League {
  return {
    ...league,
    players: Array.isArray(league.players) ? league.players : [],
    fixtures: Array.isArray(league.fixtures) ? league.fixtures : [],
    winPoints: Number.isFinite(league.winPoints) ? league.winPoints : 3,
    lossPoints: Number.isFinite(league.lossPoints) ? league.lossPoints : 0,
  };
}

export function getLeagues(): League[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as League[];
    return Array.isArray(parsed) ? parsed.map(normalizeLeague) : [];
  } catch {
    return [];
  }
}

export function saveLeagues(leagues: League[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leagues));
  window.dispatchEvent(new Event("cuebracket:leagues-changed"));
}

export function subscribeToLeagueChanges(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener("cuebracket:leagues-changed", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("cuebracket:leagues-changed", listener);
  };
}

export function createLeague(input: LeagueInput): League {
  const now = new Date().toISOString();
  const league: League = {
    id: makeId(),
    ...input,
    name: input.name.trim(),
    season: input.season.trim(),
    venue: input.venue.trim(),
    status: "draft",
    players: [],
    fixtures: [],
    createdAt: now,
    updatedAt: now,
  };
  saveLeagues([league, ...getLeagues()]);
  return league;
}

export function getLeague(id: string): League | undefined {
  return getLeagues().find((league) => league.id === id);
}

export function updateLeague(id: string, updates: Partial<League>): League | undefined {
  const leagues = getLeagues();
  const index = leagues.findIndex((league) => league.id === id);
  if (index < 0) return undefined;
  leagues[index] = normalizeLeague({
    ...leagues[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  saveLeagues(leagues);
  return leagues[index];
}

export function deleteLeague(id: string) {
  saveLeagues(getLeagues().filter((league) => league.id !== id));
}

export function duplicateLeague(id: string): League | undefined {
  const source = getLeague(id);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const copy: League = {
    ...source,
    id: makeId(),
    name: `${source.name} Copy`,
    status: "draft",
    players: source.players.map((player) => ({ ...player, id: makeId("player") })),
    fixtures: [],
    createdAt: now,
    updatedAt: now,
  };
  saveLeagues([copy, ...getLeagues()]);
  return copy;
}

export function addLeaguePlayer(leagueId: string, name: string): League | undefined {
  const league = getLeague(leagueId);
  const clean = name.trim();
  if (!league || !clean) return league;
  if (league.players.some((player) => player.name.toLowerCase() === clean.toLowerCase())) {
    return league;
  }
  return updateLeague(leagueId, {
    players: [...league.players, { id: makeId("player"), name: clean }],
    fixtures: [],
  });
}

export function addManyLeaguePlayers(leagueId: string, names: string[]): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  const existing = new Set(league.players.map((p) => p.name.toLowerCase()));
  const additions: LeaguePlayer[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || existing.has(name.toLowerCase())) continue;
    existing.add(name.toLowerCase());
    additions.push({ id: makeId("player"), name });
  }
  return updateLeague(leagueId, {
    players: [...league.players, ...additions],
    fixtures: [],
  });
}

export function removeLeaguePlayer(leagueId: string, playerId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  return updateLeague(leagueId, {
    players: league.players.filter((player) => player.id !== playerId),
    fixtures: [],
  });
}

function roundRobinPairs(players: LeaguePlayer[]) {
  const working: Array<LeaguePlayer | null> = [...players];
  if (working.length % 2 !== 0) working.push(null);

  const rounds: Array<Array<[LeaguePlayer, LeaguePlayer]>> = [];
  const totalRounds = working.length - 1;

  for (let round = 0; round < totalRounds; round += 1) {
    const matches: Array<[LeaguePlayer, LeaguePlayer]> = [];
    for (let i = 0; i < working.length / 2; i += 1) {
      const a = working[i];
      const b = working[working.length - 1 - i];
      if (a && b) {
        const swap = round % 2 === 1 && i === 0;
        matches.push(swap ? [b, a] : [a, b]);
      }
    }
    rounds.push(matches);
    const fixed = working[0];
    const rest = working.slice(1);
    rest.unshift(rest.pop() ?? null);
    working.splice(0, working.length, fixed, ...rest);
  }
  return rounds;
}

export function generateLeagueFixtures(leagueId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league || league.players.length < 2) return league;

  const firstLeg = roundRobinPairs(league.players);
  const fixtures: LeagueFixture[] = [];

  firstLeg.forEach((round, roundIndex) => {
    round.forEach(([home, away]) => {
      fixtures.push({
        id: makeId("fixture"),
        round: roundIndex + 1,
        homePlayerId: home.id,
        awayPlayerId: away.id,
        homeScore: null,
        awayScore: null,
        completed: false,
        playedAt: null,
      });
    });
  });

  if (league.format === "home-and-away") {
    const offset = firstLeg.length;
    firstLeg.forEach((round, roundIndex) => {
      round.forEach(([home, away]) => {
        fixtures.push({
          id: makeId("fixture"),
          round: offset + roundIndex + 1,
          homePlayerId: away.id,
          awayPlayerId: home.id,
          homeScore: null,
          awayScore: null,
          completed: false,
          playedAt: null,
        });
      });
    });
  }

  return updateLeague(leagueId, { fixtures, status: "live" });
}

export function saveFixtureResult(
  leagueId: string,
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;

  const fixtures = league.fixtures.map((fixture) =>
    fixture.id === fixtureId
      ? {
          ...fixture,
          homeScore: Math.max(0, homeScore),
          awayScore: Math.max(0, awayScore),
          completed: true,
          playedAt: new Date().toISOString(),
        }
      : fixture,
  );

  const completed = fixtures.length > 0 && fixtures.every((fixture) => fixture.completed);
  return updateLeague(leagueId, {
    fixtures,
    status: completed ? "completed" : "live",
  });
}

export function resetFixtureResult(leagueId: string, fixtureId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  return updateLeague(leagueId, {
    status: "live",
    fixtures: league.fixtures.map((fixture) =>
      fixture.id === fixtureId
        ? {
            ...fixture,
            homeScore: null,
            awayScore: null,
            completed: false,
            playedAt: null,
          }
        : fixture,
    ),
  });
}

export function getLeagueStandings(league: League): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  league.players.forEach((player) => {
    rows.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      played: 0,
      won: 0,
      lost: 0,
      framesFor: 0,
      framesAgainst: 0,
      difference: 0,
      points: 0,
    });
  });

  league.fixtures.filter((fixture) => fixture.completed).forEach((fixture) => {
    const home = rows.get(fixture.homePlayerId);
    const away = rows.get(fixture.awayPlayerId);
    if (!home || !away) return;

    const homeScore = fixture.homeScore ?? 0;
    const awayScore = fixture.awayScore ?? 0;

    home.played += 1;
    away.played += 1;
    home.framesFor += homeScore;
    home.framesAgainst += awayScore;
    away.framesFor += awayScore;
    away.framesAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += league.winPoints;
      away.points += league.lossPoints;
    } else if (awayScore > homeScore) {
      away.won += 1;
      home.lost += 1;
      away.points += league.winPoints;
      home.points += league.lossPoints;
    }
  });

  return [...rows.values()]
    .map((row) => ({ ...row, difference: row.framesFor - row.framesAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.difference - a.difference ||
        b.framesFor - a.framesFor ||
        a.playerName.localeCompare(b.playerName),
    );
}

export function getPlayerName(league: League, playerId: string) {
  return league.players.find((player) => player.id === playerId)?.name ?? "Unknown player";
}
