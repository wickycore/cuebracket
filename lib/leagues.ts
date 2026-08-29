"use client";

export type LeagueStatus = "draft" | "live" | "completed";
export type LeagueFormat = "single-round-robin" | "home-and-away";
export type LeaguePlayoffSize = 2 | 4 | 8;
export type LeaguePlayoffStatus = "pending" | "ready" | "live" | "completed";

export interface LeaguePlayer {
  id: string;
  name: string;
  profileId?: string | null;
  username?: string | null;
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
  tableId?: number | null;
  tableName?: string;
}

export interface LeaguePlayoffMatch {
  id: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  seed1: number | null;
  seed2: number | null;
  score1: number | null;
  score2: number | null;
  winnerPlayerId: string | null;
  completed: boolean;
  playedAt: string | null;
  tableId?: number | null;
  tableName?: string;
}

export interface LeaguePlayoffRound {
  id: string;
  number: number;
  name: string;
  matches: LeaguePlayoffMatch[];
}

export interface LeaguePlayoff {
  enabled: boolean;
  qualifierCount: LeaguePlayoffSize;
  status: LeaguePlayoffStatus;
  qualifierPlayerIds: string[];
  rounds: LeaguePlayoffRound[];
  generatedAt: string | null;
}

export interface League {
  id: string;
  seriesId: string;
  clubId: string | null;
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
  playoff: LeaguePlayoff;
  championPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueInput {
  clubId?: string | null;
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
  playoffEnabled: boolean;
  playoffQualifierCount: LeaguePlayoffSize;
}

export interface StandingRow {
  rank: number;
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

export interface RegisteredLeaguePlayerInput {
  profileId: string;
  name: string;
  username?: string | null;
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

function emptyPlayoff(enabled = false, qualifierCount: LeaguePlayoffSize = 4): LeaguePlayoff {
  return {
    enabled,
    qualifierCount,
    status: "pending",
    qualifierPlayerIds: [],
    rounds: [],
    generatedAt: null,
  };
}

export function normalizeLeague(raw: League): League {
  const playoff = raw.playoff ?? emptyPlayoff(false, 4);
  return {
    ...raw,
    seriesId: raw.seriesId || raw.id,
    clubId: raw.clubId ?? null,
    players: Array.isArray(raw.players) ? raw.players : [],
    fixtures: Array.isArray(raw.fixtures) ? raw.fixtures.map((fixture) => ({
      ...fixture,
      tableId: fixture.tableId ?? null,
      tableName: fixture.tableName ?? "",
    })) : [],
    winPoints: Number.isFinite(raw.winPoints) ? raw.winPoints : 3,
    lossPoints: Number.isFinite(raw.lossPoints) ? raw.lossPoints : 0,
    playoff: {
      ...emptyPlayoff(playoff.enabled, playoff.qualifierCount),
      ...playoff,
      qualifierPlayerIds: Array.isArray(playoff.qualifierPlayerIds) ? playoff.qualifierPlayerIds : [],
      rounds: Array.isArray(playoff.rounds) ? playoff.rounds.map((round) => ({
        ...round,
        matches: (round.matches ?? []).map((match) => ({
          ...match,
          tableId: match.tableId ?? null,
          tableName: match.tableName ?? "",
        })),
      })) : [],
    },
    championPlayerId: raw.championPlayerId ?? null,
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leagues.map(normalizeLeague)));
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
  const id = makeId();
  const league: League = {
    id,
    seriesId: id,
    clubId: input.clubId ?? null,
    name: input.name.trim(),
    season: input.season.trim(),
    venue: input.venue.trim(),
    gameType: input.gameType,
    raceTo: input.raceTo,
    format: input.format,
    winPoints: input.winPoints,
    lossPoints: input.lossPoints,
    startDate: input.startDate,
    endDate: input.endDate,
    status: "draft",
    players: [],
    fixtures: [],
    playoff: emptyPlayoff(input.playoffEnabled, input.playoffQualifierCount),
    championPlayerId: null,
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
  const copyId = makeId();
  const copy: League = {
    ...source,
    id: copyId,
    seriesId: copyId,
    name: `${source.name} Copy`,
    status: "draft",
    players: source.players.map((player) => ({ ...player, id: makeId("player") })),
    fixtures: [],
    playoff: emptyPlayoff(source.playoff.enabled, source.playoff.qualifierCount),
    championPlayerId: null,
    createdAt: now,
    updatedAt: now,
  };
  saveLeagues([copy, ...getLeagues()]);
  return copy;
}

export function createNextLeagueSeason(id: string, season: string): League | undefined {
  const source = getLeague(id);
  const cleanSeason = season.trim();
  if (!source || !cleanSeason) return undefined;
  const now = new Date().toISOString();
  const next: League = {
    ...source,
    id: makeId(),
    seriesId: source.seriesId || source.id,
    season: cleanSeason,
    status: "draft",
    players: source.players.map((player) => ({ ...player, id: makeId("player") })),
    fixtures: [],
    playoff: emptyPlayoff(source.playoff.enabled, source.playoff.qualifierCount),
    championPlayerId: null,
    startDate: "",
    endDate: "",
    createdAt: now,
    updatedAt: now,
  };
  saveLeagues([next, ...getLeagues()]);
  return next;
}

function resetCompetition(league: League, players: LeaguePlayer[]) {
  return updateLeague(league.id, {
    players,
    fixtures: [],
    playoff: emptyPlayoff(league.playoff.enabled, league.playoff.qualifierCount),
    championPlayerId: null,
    status: "draft",
  });
}

export function addLeaguePlayer(leagueId: string, name: string): League | undefined {
  const league = getLeague(leagueId);
  const clean = name.trim();
  if (!league || !clean) return league;
  if (league.players.some((player) => player.name.toLowerCase() === clean.toLowerCase())) return league;
  return resetCompetition(league, [...league.players, { id: makeId("player"), name: clean }]);
}

export function addRegisteredLeaguePlayer(leagueId: string, input: RegisteredLeaguePlayerInput): League | undefined {
  const league = getLeague(leagueId);
  const name = input.name.trim();
  if (!league || !name) return league;
  if (league.players.some((player) => player.profileId === input.profileId || player.name.toLowerCase() === name.toLowerCase())) return league;
  return resetCompetition(league, [
    ...league.players,
    { id: makeId("player"), name, profileId: input.profileId, username: input.username ?? null },
  ]);
}

export function addManyLeaguePlayers(leagueId: string, names: string[]): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  const existing = new Set(league.players.map((player) => player.name.toLowerCase()));
  const additions: LeaguePlayer[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || existing.has(name.toLowerCase())) continue;
    existing.add(name.toLowerCase());
    additions.push({ id: makeId("player"), name });
  }
  return resetCompetition(league, [...league.players, ...additions]);
}

export function removeLeaguePlayer(leagueId: string, playerId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  return resetCompetition(league, league.players.filter((player) => player.id !== playerId));
}

function roundRobinPairs(players: LeaguePlayer[]) {
  const working: Array<LeaguePlayer | null> = [...players];
  if (working.length % 2 !== 0) working.push(null);
  const rounds: Array<Array<[LeaguePlayer, LeaguePlayer]>> = [];
  for (let round = 0; round < working.length - 1; round += 1) {
    const matches: Array<[LeaguePlayer, LeaguePlayer]> = [];
    for (let index = 0; index < working.length / 2; index += 1) {
      const first = working[index];
      const second = working[working.length - 1 - index];
      if (first && second) {
        const swap = round % 2 === 1 && index === 0;
        matches.push(swap ? [second, first] : [first, second]);
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

export function buildLeagueFixtures(league: League): LeagueFixture[] {
  if (league.players.length < 2) return [];
  const firstLeg = roundRobinPairs(league.players);
  const fixtures: LeagueFixture[] = [];
  const add = (round: number, homePlayerId: string, awayPlayerId: string) => fixtures.push({
    id: makeId("fixture"), round, homePlayerId, awayPlayerId,
    homeScore: null, awayScore: null, completed: false, playedAt: null,
    tableId: null, tableName: "",
  });
  firstLeg.forEach((round, roundIndex) => round.forEach(([home, away]) => add(roundIndex + 1, home.id, away.id)));
  if (league.format === "home-and-away") {
    const offset = firstLeg.length;
    firstLeg.forEach((round, roundIndex) => round.forEach(([home, away]) => add(offset + roundIndex + 1, away.id, home.id)));
  }
  return fixtures;
}

export function generateLeagueFixtures(leagueId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league || league.players.length < 2 || (league.playoff.enabled && league.players.length < league.playoff.qualifierCount)) return league;
  return updateLeague(leagueId, {
    fixtures: buildLeagueFixtures(league),
    playoff: emptyPlayoff(league.playoff.enabled, league.playoff.qualifierCount),
    championPlayerId: null,
    status: "live",
  });
}

export function validateLeagueResult(raceTo: number, score1: number, score2: number) {
  if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
    return "Scores must be whole numbers of zero or more.";
  }
  if (score1 === score2) return "League matches cannot finish level.";
  if (Math.max(score1, score2) !== raceTo || Math.min(score1, score2) >= raceTo) {
    return `A valid race to ${raceTo} must finish ${raceTo}–0 through ${raceTo}–${raceTo - 1}.`;
  }
  return null;
}

function fixtureCompletionState(league: League, fixtures: LeagueFixture[]) {
  const regularComplete = fixtures.length > 0 && fixtures.every((fixture) => fixture.completed);
  if (!regularComplete) return { status: "live" as const, championPlayerId: null, playoffStatus: "pending" as const };
  if (league.playoff.enabled) return { status: "live" as const, championPlayerId: null, playoffStatus: "ready" as const };
  return { status: "completed" as const, championPlayerId: getLeagueStandings({ ...league, fixtures })[0]?.playerId ?? null, playoffStatus: "pending" as const };
}

export function saveFixtureResult(leagueId: string, fixtureId: string, homeScore: number, awayScore: number): League | undefined {
  const league = getLeague(leagueId);
  if (!league || validateLeagueResult(league.raceTo, homeScore, awayScore)) return league;
  const fixtures = league.fixtures.map((fixture) => fixture.id === fixtureId ? {
    ...fixture, homeScore, awayScore, completed: true, playedAt: new Date().toISOString(),
  } : fixture);
  const completion = fixtureCompletionState(league, fixtures);
  return updateLeague(leagueId, {
    fixtures,
    status: completion.status,
    championPlayerId: completion.championPlayerId,
    playoff: {
      ...emptyPlayoff(league.playoff.enabled, league.playoff.qualifierCount),
      status: completion.playoffStatus,
    },
  });
}

export function setLeagueFixtureTable(leagueId: string, fixtureId: string, tableId: number | null, tableName: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  return updateLeague(leagueId, {
    fixtures: league.fixtures.map((fixture) => fixture.id === fixtureId ? {
      ...fixture,
      tableId,
      tableName: tableName.trim(),
    } : fixture),
  });
}

export function resetFixtureResult(leagueId: string, fixtureId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  return updateLeague(leagueId, {
    status: "live",
    championPlayerId: null,
    playoff: emptyPlayoff(league.playoff.enabled, league.playoff.qualifierCount),
    fixtures: league.fixtures.map((fixture) => fixture.id === fixtureId ? {
      ...fixture, homeScore: null, awayScore: null, completed: false, playedAt: null,
    } : fixture),
  });
}

function baseStanding(player: LeaguePlayer): StandingRow {
  return { rank: 0, playerId: player.id, playerName: player.name, played: 0, won: 0, lost: 0, framesFor: 0, framesAgainst: 0, difference: 0, points: 0 };
}

function addFixtureToRows(rows: Map<string, StandingRow>, league: League, fixture: LeagueFixture) {
  const home = rows.get(fixture.homePlayerId);
  const away = rows.get(fixture.awayPlayerId);
  if (!home || !away || !fixture.completed) return;
  const homeScore = fixture.homeScore ?? 0;
  const awayScore = fixture.awayScore ?? 0;
  home.played += 1; away.played += 1;
  home.framesFor += homeScore; home.framesAgainst += awayScore;
  away.framesFor += awayScore; away.framesAgainst += homeScore;
  if (homeScore > awayScore) {
    home.won += 1; away.lost += 1; home.points += league.winPoints; away.points += league.lossPoints;
  } else {
    away.won += 1; home.lost += 1; away.points += league.winPoints; home.points += league.lossPoints;
  }
  home.difference = home.framesFor - home.framesAgainst;
  away.difference = away.framesFor - away.framesAgainst;
}

export function getLeagueStandings(league: League): StandingRow[] {
  const rows = new Map(league.players.map((player) => [player.id, baseStanding(player)]));
  league.fixtures.forEach((fixture) => addFixtureToRows(rows, league, fixture));
  const allRows = [...rows.values()];
  const pointsGroups = new Map<number, StandingRow[]>();
  allRows.forEach((row) => pointsGroups.set(row.points, [...(pointsGroups.get(row.points) ?? []), row]));
  const mini = new Map<string, StandingRow>();
  for (const group of pointsGroups.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((row) => row.playerId));
    const groupRows = new Map(group.map((row) => [row.playerId, baseStanding({ id: row.playerId, name: row.playerName })]));
    league.fixtures.filter((fixture) => ids.has(fixture.homePlayerId) && ids.has(fixture.awayPlayerId)).forEach((fixture) => addFixtureToRows(groupRows, league, fixture));
    groupRows.forEach((row, id) => mini.set(id, row));
  }
  const sorted = allRows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const miniA = mini.get(a.playerId);
    const miniB = mini.get(b.playerId);
    return (miniB?.points ?? 0) - (miniA?.points ?? 0)
      || (miniB?.difference ?? 0) - (miniA?.difference ?? 0)
      || (miniB?.framesFor ?? 0) - (miniA?.framesFor ?? 0)
      || b.difference - a.difference
      || b.framesFor - a.framesFor
      || a.playerName.localeCompare(b.playerName);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

function playoffRoundName(round: number, totalRounds: number) {
  const remaining = totalRounds - round;
  if (remaining === 0) return "Final";
  if (remaining === 1) return "Semi-finals";
  if (remaining === 2) return "Quarter-finals";
  return `Playoff round ${round}`;
}

function seedOrder(size: LeaguePlayoffSize) {
  if (size === 2) return [[1, 2]];
  if (size === 4) return [[1, 4], [2, 3]];
  return [[1, 8], [4, 5], [2, 7], [3, 6]];
}

export function buildLeaguePlayoff(league: League): LeaguePlayoff {
  if (!league.fixtures.length || !league.fixtures.every((fixture) => fixture.completed)) {
    throw new Error("Complete every regular-season fixture before generating the playoffs.");
  }
  const size = league.playoff.qualifierCount;
  if (league.players.length < size) throw new Error(`This playoff needs at least ${size} league players.`);
  const qualifiers = getLeagueStandings(league).slice(0, size);
  const totalRounds = Math.log2(size);
  const rounds: LeaguePlayoffRound[] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    const matchCount = size / 2 ** round;
    rounds.push({
      id: makeId("playoff-round"), number: round, name: playoffRoundName(round, totalRounds),
      matches: Array.from({ length: matchCount }, (_, position) => ({
        id: makeId("playoff-match"), round, position,
        player1Id: null, player2Id: null, seed1: null, seed2: null,
        score1: null, score2: null, winnerPlayerId: null, completed: false, playedAt: null,
        tableId: null, tableName: "",
      })),
    });
  }
  seedOrder(size).forEach(([seed1, seed2], index) => {
    const match = rounds[0].matches[index];
    match.player1Id = qualifiers[seed1 - 1].playerId;
    match.player2Id = qualifiers[seed2 - 1].playerId;
    match.seed1 = seed1;
    match.seed2 = seed2;
  });
  return {
    enabled: true, qualifierCount: size, status: "live",
    qualifierPlayerIds: qualifiers.map((row) => row.playerId), rounds,
    generatedAt: new Date().toISOString(),
  };
}

export function generateLeaguePlayoff(leagueId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league || !league.playoff.enabled) return league;
  const playoff = buildLeaguePlayoff(league);
  return updateLeague(leagueId, { playoff, status: "live", championPlayerId: null });
}

function recomputePlayoff(playoff: LeaguePlayoff) {
  const rounds = playoff.rounds.map((round) => ({ ...round, matches: round.matches.map((match) => ({ ...match })) }));
  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    rounds[roundIndex].matches.forEach((match, position) => {
      const source1 = rounds[roundIndex - 1].matches[position * 2];
      const source2 = rounds[roundIndex - 1].matches[position * 2 + 1];
      const player1Id = source1?.winnerPlayerId ?? null;
      const player2Id = source2?.winnerPlayerId ?? null;
      if (match.player1Id !== player1Id || match.player2Id !== player2Id) {
        Object.assign(match, { player1Id, player2Id, seed1: null, seed2: null, score1: null, score2: null, winnerPlayerId: null, completed: false, playedAt: null });
      }
    });
  }
  const final = rounds.at(-1)?.matches[0];
  return {
    playoff: { ...playoff, rounds, status: final?.completed ? "completed" as const : "live" as const },
    championPlayerId: final?.winnerPlayerId ?? null,
  };
}

export function saveLeaguePlayoffResult(leagueId: string, matchId: string, score1: number, score2: number): League | undefined {
  const league = getLeague(leagueId);
  if (!league || validateLeagueResult(league.raceTo, score1, score2)) return league;
  const playoff = { ...league.playoff, rounds: league.playoff.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => match.id === matchId && match.player1Id && match.player2Id ? {
      ...match, score1, score2, completed: true,
      winnerPlayerId: score1 > score2 ? match.player1Id : match.player2Id,
      playedAt: new Date().toISOString(),
    } : match),
  })) };
  const recomputed = recomputePlayoff(playoff);
  return updateLeague(leagueId, {
    playoff: recomputed.playoff,
    championPlayerId: recomputed.championPlayerId,
    status: recomputed.championPlayerId ? "completed" : "live",
  });
}

export function setLeaguePlayoffMatchTable(leagueId: string, matchId: string, tableId: number | null, tableName: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  return updateLeague(leagueId, {
    playoff: {
      ...league.playoff,
      rounds: league.playoff.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) => match.id === matchId ? {
          ...match,
          tableId,
          tableName: tableName.trim(),
        } : match),
      })),
    },
  });
}

export function resetLeaguePlayoffResult(leagueId: string, matchId: string): League | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  const playoff = { ...league.playoff, rounds: league.playoff.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => match.id === matchId ? {
      ...match, score1: null, score2: null, winnerPlayerId: null, completed: false, playedAt: null,
    } : match),
  })) };
  const recomputed = recomputePlayoff(playoff);
  return updateLeague(leagueId, { playoff: recomputed.playoff, championPlayerId: null, status: "live" });
}

export function getLeagueSeasons(league: League) {
  return getLeagues()
    .filter((item) => item.seriesId === league.seriesId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPlayerName(league: League, playerId: string | null) {
  if (!playerId) return "TBD";
  return league.players.find((player) => player.id === playerId)?.name ?? "Unknown player";
}
