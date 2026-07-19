import type { BracketMatch } from "@/lib/tournaments";

export type LateEntryByeSlot = {
  matchId: string;
  matchNumber: number;
  roundName: string;
  advancingPlayer: string;
  available: boolean;
  lockedReason?: string;
};

/**
 * A match is considered started once an organizer has explicitly started it,
 * entered a score, or saved a genuine two-player result.
 * Automatic BYE advances do not count as started matches.
 */
export function hasPlayedOrStartedMatch(match: BracketMatch | undefined) {
  if (!match) return false;

  const hasEnteredScore = match.score1 !== null || match.score2 !== null;
  const hasRealResult = Boolean(
    match.completed && match.player1 && match.player2 && match.winner,
  );

  return Boolean(
    match.status === "live" ||
      match.startedAt ||
      hasEnteredScore ||
      hasRealResult,
  );
}

export function clearBracketMatch(match: BracketMatch) {
  match.score1 = null;
  match.score2 = null;
  match.winner = null;
  match.completed = false;
  match.status = "pending";
  match.startedAt = null;
  match.endedAt = null;
  match.breakPlayer = null;
  match.tableNumber = undefined;
  match.notes = undefined;
  match.scoreHistory = [];
}

export function normalizeLatePlayerName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export type LateEntryResult<TBracket> =
  | { ok: true; bracket: TBracket }
  | { ok: false; reason: string };
