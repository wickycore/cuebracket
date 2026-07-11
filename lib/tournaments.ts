export type TournamentFormat = "single" | "double";
export type TournamentStatus = "draft" | "live" | "completed";
export type MatchStatus = "pending" | "live" | "finished";

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

export interface Tournament {
  id: string;
  name: string;
  venue: string;
  format: TournamentFormat;
  raceTo: number;
  bracketSize: 4 | 8 | 16 | 32 | 64 | 128;
  status: TournamentStatus;
  players: string[];
  bracket?: TournamentBracket;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentInput {
  name: string;
  venue: string;
  format: TournamentFormat;
  raceTo: number;
  bracketSize: Tournament["bracketSize"];
}

const STORAGE_KEY = "cuebracket:tournaments:v1";

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

function normalizeRounds(rounds: BracketRound[]) {
  return rounds.map((round) => ({
    ...round,
    matches: round.matches.map(normalizeMatch),
  }));
}

function normalizeTournament(tournament: Tournament): Tournament {
  if (!tournament.bracket) return tournament;
  if (tournament.bracket.type === "double") {
    return {
      ...tournament,
      bracket: {
        ...tournament.bracket,
        winners: normalizeRounds(tournament.bracket.winners),
        losers: normalizeRounds(tournament.bracket.losers),
        grandFinal: normalizeRounds(tournament.bracket.grandFinal),
        resetRequired: tournament.bracket.resetRequired ?? false,
        bracketResetEnabled: tournament.bracket.bracketResetEnabled ?? true,
      },
    };
  }
  return {
    ...tournament,
    bracket: {
      ...tournament.bracket,
      rounds: normalizeRounds(tournament.bracket.rounds),
    },
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
    format: input.format,
    raceTo: input.raceTo,
    bracketSize: input.bracketSize,
    status: "draft",
    players: [],
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

export function getAllMatches(tournament: Tournament): BracketMatch[] {
  return getBracketRounds(tournament.bracket).flatMap((round) => round.matches);
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
