export type TournamentType = "single_stage" | "two_stage";
export type TournamentFormat =
  | "single"
  | "double"
  | "round_robin"
  | "swiss"
  | "free_for_all"
  | "leaderboard";
export type FinalStageFormat = "single" | "double";
export type FreeForAllTieRule = "full_points" | "split_points" | "tiebreak_required";
export type TournamentStatus = "draft" | "live" | "completed";
export type MatchStatus = "pending" | "live" | "finished";

export interface TournamentOptions {
  roundRobinLegs: 1 | 2;
  swissRounds: number;
  freeForAllRounds: number;
  freeForAllHeatSize: number;
  freeForAllTieRule: FreeForAllTieRule;
  leaderboardCycles: number;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  groupCount: number;
  qualifiersPerGroup: number;
  finalStageFormat: FinalStageFormat;
  bracketResetEnabled: boolean;
}

export interface ScoreSnapshot {
  score1: number;
  score2: number;
  recordedAt: string;
}

export type MatchSource =
  | { kind: "seed"; player: string | null }
  | { kind: "winner"; matchId: string }
  | { kind: "loser"; matchId: string };

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  player1: string | null;
  player2: string | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
  completed: boolean;
  status?: MatchStatus;
  tableNumber?: string;
  breakPlayer?: 1 | 2 | null;
  startedAt?: string | null;
  endedAt?: string | null;
  notes?: string;
  scoreHistory?: ScoreSnapshot[];
  source1?: MatchSource;
  source2?: MatchSource;
}

export interface BracketRound {
  round: number;
  name: string;
  matches: BracketMatch[];
}

export interface SingleEliminationBracket {
  type: "single";
  rounds: BracketRound[];
  generatedAt: string;
  champion: string | null;
}

export interface DoubleEliminationBracket {
  type: "double";
  winners: BracketRound[];
  losers: BracketRound[];
  grandFinal: BracketRound[];
  generatedAt: string;
  champion: string | null;
  resetRequired: boolean;
  bracketResetEnabled: boolean;
}

export type TournamentBracket = SingleEliminationBracket | DoubleEliminationBracket;

export interface StandingRow {
  rank: number;
  player: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  framesFor: number;
  framesAgainst: number;
  frameDifference: number;
  points: number;
  buchholz?: number;
  bonusPoints?: number;
  headToHeadPoints?: number;
  headToHeadDifference?: number;
  byes?: number;
  heatWins?: number;
  podiums?: number;
  averagePlacement?: number;
  rawScore?: number;
}

export interface RoundRobinCompetition {
  type: "round_robin";
  rounds: BracketRound[];
  standings: StandingRow[];
  legs: 1 | 2;
  champion: string | null;
  generatedAt: string;
}

export interface SwissCompetition {
  type: "swiss";
  rounds: BracketRound[];
  standings: StandingRow[];
  totalRounds: number;
  currentRound: number;
  champion: string | null;
  generatedAt: string;
}

export interface LeaderboardCompetition {
  type: "leaderboard";
  rounds: BracketRound[];
  standings: StandingRow[];
  cycles: number;
  adjustments: Record<string, number>;
  champion: string | null;
  generatedAt: string;
}

export interface FreeForAllEntry {
  player: string;
  score: number | null;
  placement: number | null;
  points: number;
}

export interface FreeForAllHeat {
  id: string;
  round: number;
  position: number;
  name: string;
  entries: FreeForAllEntry[];
  completed: boolean;
}

export interface FreeForAllCompetition {
  type: "free_for_all";
  heats: FreeForAllHeat[];
  standings: StandingRow[];
  rounds: number;
  heatSize: number;
  tieRule: FreeForAllTieRule;
  champion: string | null;
  generatedAt: string;
}

export interface TwoStageGroup {
  id: string;
  name: string;
  players: string[];
  rounds: BracketRound[];
  standings: StandingRow[];
}

export interface TwoStageCompetition {
  type: "two_stage";
  groups: TwoStageGroup[];
  qualifiersPerGroup: number;
  finalFormat: FinalStageFormat;
  finalBracket?: TournamentBracket;
  champion: string | null;
  generatedAt: string;
}

export type TournamentCompetition =
  | RoundRobinCompetition
  | SwissCompetition
  | LeaderboardCompetition
  | FreeForAllCompetition
  | TwoStageCompetition;

export interface Tournament {
  id: string;
  name: string;
  venue: string;
  type: TournamentType;
  format: TournamentFormat;
  raceTo: number;
  bracketSize: number;
  status: TournamentStatus;
  players: string[];
  options: TournamentOptions;
  bracket?: TournamentBracket;
  competition?: TournamentCompetition;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentInput {
  name: string;
  venue: string;
  type: TournamentType;
  format: TournamentFormat;
  raceTo: number;
  bracketSize: number;
  options?: Partial<TournamentOptions>;
}

const STORAGE_KEY = "cuebracket:tournaments:v1";

export const DEFAULT_TOURNAMENT_OPTIONS: TournamentOptions = {
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
};

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  single: "Single elimination",
  double: "Double elimination",
  round_robin: "Round robin",
  swiss: "Swiss system",
  free_for_all: "Free for all",
  leaderboard: "Leaderboard",
};

export function getFormatLabel(format: TournamentFormat) {
  return FORMAT_LABELS[format] ?? format;
}

export function getTournamentTypeLabel(type: TournamentType) {
  return type === "two_stage" ? "Two-stage tournament" : "Single-stage tournament";
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMatch(match: BracketMatch): BracketMatch {
  return {
    ...match,
    status: match.status ?? (match.completed ? "finished" : "pending"),
    tableNumber: match.tableNumber ?? "",
    breakPlayer: match.breakPlayer ?? null,
    startedAt: match.startedAt ?? null,
    endedAt: match.endedAt ?? null,
    notes: match.notes ?? "",
    scoreHistory: match.scoreHistory ?? [],
  };
}

function normalizeRounds(rounds: BracketRound[] = []) {
  return rounds.map((round) => ({
    ...round,
    matches: (round.matches ?? []).map(normalizeMatch),
  }));
}

function normalizeBracket(bracket?: TournamentBracket): TournamentBracket | undefined {
  if (!bracket) return undefined;
  if (bracket.type === "double") {
    return {
      ...bracket,
      winners: normalizeRounds(bracket.winners),
      losers: normalizeRounds(bracket.losers),
      grandFinal: normalizeRounds(bracket.grandFinal),
      resetRequired: bracket.resetRequired ?? false,
      bracketResetEnabled: bracket.bracketResetEnabled ?? true,
    };
  }
  return { ...bracket, rounds: normalizeRounds(bracket.rounds) };
}

function normalizeStandings(rows: StandingRow[] = []) {
  return rows.map((row, index) => ({
    ...row,
    rank: row.rank ?? index + 1,
    drawn: row.drawn ?? 0,
    bonusPoints: row.bonusPoints ?? 0,
    byes: row.byes ?? 0,
    heatWins: row.heatWins ?? row.won ?? 0,
    podiums: row.podiums ?? 0,
    averagePlacement: row.averagePlacement ?? 0,
    rawScore: row.rawScore ?? row.framesFor ?? 0,
  }));
}

function normalizeCompetition(
  competition?: TournamentCompetition,
): TournamentCompetition | undefined {
  if (!competition) return undefined;
  if (competition.type === "round_robin") {
    return {
      ...competition,
      rounds: normalizeRounds(competition.rounds),
      standings: normalizeStandings(competition.standings),
      legs: competition.legs ?? 1,
    };
  }
  if (competition.type === "swiss") {
    return {
      ...competition,
      rounds: normalizeRounds(competition.rounds),
      standings: normalizeStandings(competition.standings),
      currentRound: competition.currentRound ?? competition.rounds.length,
    };
  }
  if (competition.type === "leaderboard") {
    return {
      ...competition,
      rounds: normalizeRounds(competition.rounds),
      standings: normalizeStandings(competition.standings),
      adjustments: competition.adjustments ?? {},
    };
  }
  if (competition.type === "free_for_all") {
    return {
      ...competition,
      heats: (competition.heats ?? []).map((heat) => ({
        ...heat,
        entries: (heat.entries ?? []).map((entry) => ({
          ...entry,
          points: entry.points ?? 0,
          placement: entry.placement ?? null,
          score: entry.score ?? null,
        })),
      })),
      standings: normalizeStandings(competition.standings),
      tieRule: competition.tieRule ?? "split_points",
    };
  }
  return {
    ...competition,
    groups: (competition.groups ?? []).map((group) => ({
      ...group,
      rounds: normalizeRounds(group.rounds),
      standings: normalizeStandings(group.standings),
    })),
    finalBracket: normalizeBracket(competition.finalBracket),
  };
}

function normalizeTournament(tournament: Tournament): Tournament {
  return {
    ...tournament,
    type: tournament.type ?? "single_stage",
    options: { ...DEFAULT_TOURNAMENT_OPTIONS, ...(tournament.options ?? {}) },
    bracketSize: Number(tournament.bracketSize) || 8,
    players: Array.isArray(tournament.players) ? tournament.players : [],
    bracket: normalizeBracket(tournament.bracket),
    competition: normalizeCompetition(tournament.competition),
  };
}

export function getTournaments(): Tournament[] {
  if (!canUseBrowserStorage()) return [];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as Tournament[];
    return Array.isArray(parsed) ? parsed.map(normalizeTournament) : [];
  } catch {
    return [];
  }
}

export function saveTournaments(tournaments: Tournament[]) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  window.dispatchEvent(new Event("cuebracket:tournaments-changed"));
}

export function createTournament(input: TournamentInput): Tournament {
  const now = new Date().toISOString();
  const tournament: Tournament = {
    id: makeId(),
    name: input.name.trim(),
    venue: input.venue.trim(),
    type: input.type,
    format: input.type === "two_stage" ? "round_robin" : input.format,
    raceTo: Math.max(1, Math.floor(input.raceTo)),
    bracketSize: Math.max(2, Math.min(128, Math.floor(input.bracketSize))),
    status: "draft",
    players: [],
    options: { ...DEFAULT_TOURNAMENT_OPTIONS, ...(input.options ?? {}) },
    createdAt: now,
    updatedAt: now,
  };
  saveTournaments([tournament, ...getTournaments()]);
  return tournament;
}

export function getTournament(id: string): Tournament | undefined {
  return getTournaments().find((tournament) => tournament.id === id);
}

export function updateTournament(
  id: string,
  updates: Partial<Omit<Tournament, "id" | "createdAt">>,
): Tournament | undefined {
  const tournaments = getTournaments();
  const index = tournaments.findIndex((tournament) => tournament.id === id);
  if (index === -1) return undefined;
  tournaments[index] = normalizeTournament({
    ...tournaments[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  saveTournaments(tournaments);
  return tournaments[index];
}

export function deleteTournament(id: string) {
  saveTournaments(getTournaments().filter((tournament) => tournament.id !== id));
}

export function duplicateTournament(id: string): Tournament | undefined {
  const source = getTournament(id);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const copy: Tournament = {
    ...source,
    id: makeId(),
    name: `${source.name} Copy`,
    status: "draft",
    players: [...source.players],
    bracket: undefined,
    competition: undefined,
    createdAt: now,
    updatedAt: now,
  };
  saveTournaments([copy, ...getTournaments()]);
  return copy;
}

export function subscribeToTournamentChanges(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener("cuebracket:tournaments-changed", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("cuebracket:tournaments-changed", listener);
  };
}

export function getBracketRounds(bracket?: TournamentBracket): BracketRound[] {
  if (!bracket) return [];
  return bracket.type === "single"
    ? bracket.rounds
    : [...bracket.winners, ...bracket.losers, ...bracket.grandFinal];
}

export function getCompetitionRounds(competition?: TournamentCompetition): BracketRound[] {
  if (!competition) return [];
  if (
    competition.type === "round_robin" ||
    competition.type === "swiss" ||
    competition.type === "leaderboard"
  ) {
    return competition.rounds;
  }
  if (competition.type === "two_stage") {
    return [
      ...competition.groups.flatMap((group) => group.rounds),
      ...getBracketRounds(competition.finalBracket),
    ];
  }
  return [];
}

export function getAllMatches(tournament: Tournament): BracketMatch[] {
  if (tournament.bracket) return getBracketRounds(tournament.bracket).flatMap((round) => round.matches);
  return getCompetitionRounds(tournament.competition).flatMap((round) => round.matches);
}

export function getTournamentChampion(tournament: Tournament) {
  return tournament.bracket?.champion ?? tournament.competition?.champion ?? null;
}

export function hasTournamentStructure(tournament: Tournament) {
  return Boolean(tournament.bracket || tournament.competition);
}

export function getTournamentEventCounts(tournament: Tournament) {
  if (tournament.competition?.type === "free_for_all") {
    const total = tournament.competition.heats.length;
    const completed = tournament.competition.heats.filter((heat) => heat.completed).length;
    return { total, completed, byes: 0, fixtures: total };
  }

  const fixtures = getAllMatches(tournament).filter((match) => match.player1 || match.player2);
  const playable = fixtures.filter((match) => match.player1 && match.player2);
  const byes = fixtures.filter((match) => Boolean(match.player1) !== Boolean(match.player2));
  return {
    total: playable.length,
    completed: playable.filter((match) => match.completed).length,
    byes: byes.length,
    fixtures: fixtures.length,
  };
}

function formatStandingPoints(points: number) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1).replace(/\.0$/, "");
}

export function getTournamentChampionDescription(tournament: Tournament) {
  const champion = getTournamentChampion(tournament);
  if (!champion) return "";

  const competition = tournament.competition;
  if (!competition) {
    if (tournament.bracket?.type === "double") {
      const resetPlayed = Boolean(tournament.bracket.grandFinal[1]?.matches[0]?.completed);
      return resetPlayed
        ? `${champion} wins the double-elimination tournament after a bracket-reset final.`
        : `${champion} wins the double-elimination tournament.`;
    }
    return `${champion} wins the single-elimination tournament.`;
  }

  const top = "standings" in competition
    ? competition.standings.find((row) => row.player === champion) ?? competition.standings[0]
    : undefined;

  if (competition.type === "round_robin" && top) {
    const second = competition.standings.find((row) => row.player !== top.player);
    if (second && top.points === second.points) {
      let reason = "the configured tiebreakers";
      if ((top.headToHeadPoints ?? 0) !== (second.headToHeadPoints ?? 0)) reason = "head-to-head points";
      else if ((top.headToHeadDifference ?? 0) !== (second.headToHeadDifference ?? 0)) reason = "head-to-head frame difference";
      else if (top.frameDifference !== second.frameDifference) reason = `overall frame difference (${top.frameDifference > 0 ? "+" : ""}${top.frameDifference})`;
      else if (top.framesFor !== second.framesFor) reason = `frames won (${top.framesFor})`;
      return `${champion} wins the round-robin tournament on ${reason} after finishing level on ${formatStandingPoints(top.points)} points.`;
    }
    return `${champion} wins the round-robin tournament with ${formatStandingPoints(top.points)} points and a ${top.frameDifference > 0 ? "+" : ""}${top.frameDifference} frame difference.`;
  }

  if (competition.type === "swiss" && top) {
    const unbeaten = top.lost === 0 && top.drawn === 0;
    return `${champion} wins the Swiss tournament${unbeaten ? " undefeated" : ""} with ${formatStandingPoints(top.points)} points and a Buchholz score of ${top.buchholz ?? 0}.`;
  }

  if (competition.type === "free_for_all" && top) {
    return `${champion} wins the Free For All with ${formatStandingPoints(top.points)} placement points, ${top.heatWins ?? top.won} heat win${(top.heatWins ?? top.won) === 1 ? "" : "s"} and ${top.podiums ?? 0} podium finish${(top.podiums ?? 0) === 1 ? "" : "es"}.`;
  }

  if (competition.type === "leaderboard" && top) {
    return `${champion} finishes top of the leaderboard with ${formatStandingPoints(top.points)} points.`;
  }

  if (competition.type === "two_stage") {
    const resetPlayed = competition.finalBracket?.type === "double" && Boolean(competition.finalBracket.grandFinal[1]?.matches[0]?.completed);
    return resetPlayed
      ? `${champion} wins the groups-to-finals tournament after a bracket-reset final.`
      : `${champion} wins the groups-to-finals tournament and the ${competition.finalFormat === "double" ? "double-elimination" : "single-elimination"} final stage.`;
  }

  return `${champion} wins the tournament.`;
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
