export type TournamentFormat = "single" | "double";
export type TournamentStatus = "draft" | "live" | "completed";

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
}

export interface BracketRound {
  round: number;
  name: string;
  matches: BracketMatch[];
}

export interface TournamentBracket {
  type: "single";
  rounds: BracketRound[];
  generatedAt: string;
  champion: string | null;
}

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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTournaments(): Tournament[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];

    const parsed = JSON.parse(value) as Tournament[];
    return Array.isArray(parsed) ? parsed : [];
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

  tournaments[index] = {
    ...tournaments[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

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
