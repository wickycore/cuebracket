import type { TournamentBracket } from "@/lib/tournaments";

export const MAX_KNOCKOUT_DRAW_SIZE = 128;

/**
 * Smallest power-of-two draw that can hold the current field.
 * Event registration capacity is deliberately separate from active draw size.
 */
export function getKnockoutDrawSize(playerCount: number) {
  const safeCount = Math.max(2, Math.min(MAX_KNOCKOUT_DRAW_SIZE, Math.floor(playerCount)));
  let size = 2;
  while (size < safeCount) size *= 2;
  return size;
}

export function getKnockoutDrawCapacity(bracket: TournamentBracket) {
  if (bracket.type === "single") {
    return (bracket.rounds[0]?.matches.length ?? 0) * 2;
  }
  return (bracket.winners[0]?.matches.length ?? 0) * 2;
}

export function getFirstRoundByeCount(bracket: TournamentBracket) {
  const firstRound = bracket.type === "single" ? bracket.rounds[0] : bracket.winners[0];
  if (!firstRound) return 0;
  return firstRound.matches.filter(
    (match) => Boolean(match.player1) !== Boolean(match.player2),
  ).length;
}

export function isDrawEditable(status: "draft" | "live" | "completed") {
  return status === "draft";
}

export const DRAW_LOCKED_MESSAGE =
  "The draw is locked. Existing positions cannot change after the tournament starts.";
