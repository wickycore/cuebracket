import type { BracketRound } from "@/lib/tournaments";
import { getSpectatorMatchState } from "@/lib/bracket/spectator";
import { normalizeParticipantName } from "@/lib/cloud/public-participants";

export type TournamentPlayerMatchOutcome = "win" | "loss" | "live" | "upcoming" | "bye";

export interface TournamentPlayerMatch {
  id: string;
  roundName: string;
  opponent: string | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  outcome: TournamentPlayerMatchOutcome;
}

export interface TournamentPlayerCardSummary {
  name: string;
  initials: string;
  wins: number;
  losses: number;
  latestRound: string;
  matches: TournamentPlayerMatch[];
}

function samePlayer(left: string | null | undefined, right: string) {
  return Boolean(left && normalizeParticipantName(left) === normalizeParticipantName(right));
}

export function shortRoundName(name: string) {
  const normalized = name.toLocaleLowerCase();
  const roundOf = normalized.match(/round of\s+(\d+)/);
  if (roundOf) return `R${roundOf[1]}`;
  if (normalized.includes("quarter")) return "QF";
  if (normalized.includes("semi")) return "SF";
  if (normalized.includes("grand final")) return "GF";
  if (normalized.includes("final")) return "Final";
  return name;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CB";
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

export function buildTournamentPlayerCard(
  rounds: BracketRound[],
  playerName: string,
): TournamentPlayerCardSummary | null {
  const appearances = rounds.flatMap((round) => round.matches
    .filter((match) => samePlayer(match.player1, playerName) || samePlayer(match.player2, playerName))
    .map((match): TournamentPlayerMatch => {
      const isPlayer1 = samePlayer(match.player1, playerName);
      const opponent = isPlayer1 ? match.player2 : match.player1;
      const scoreFor = isPlayer1 ? match.score1 : match.score2;
      const scoreAgainst = isPlayer1 ? match.score2 : match.score1;
      const state = getSpectatorMatchState(match);
      const outcome: TournamentPlayerMatchOutcome = state === "advanced"
        ? "bye"
        : state === "live"
          ? "live"
          : state === "finished"
            ? samePlayer(match.winner, playerName) ? "win" : "loss"
            : "upcoming";

      return {
        id: match.id,
        roundName: round.name,
        opponent,
        scoreFor,
        scoreAgainst,
        outcome,
      };
    }));

  if (!appearances.length) return null;

  return {
    name: playerName,
    initials: initials(playerName),
    wins: appearances.filter((match) => match.outcome === "win").length,
    losses: appearances.filter((match) => match.outcome === "loss").length,
    latestRound: shortRoundName(appearances.at(-1)?.roundName ?? "Tournament"),
    matches: appearances,
  };
}
