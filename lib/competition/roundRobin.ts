import type {
  BracketMatch,
  RoundRobinCompetition,
  TournamentOptions,
} from "@/lib/tournaments";
import {
  allPlayableMatchesComplete,
  buildRoundRobinRounds,
  calculateStandings,
  cloneRounds,
} from "@/lib/competition/common";

export function buildRoundRobinCompetition(
  players: string[],
  options: TournamentOptions,
): RoundRobinCompetition {
  const rounds = buildRoundRobinRounds(players, options.roundRobinLegs, "rr");
  const standings = calculateStandings(players, rounds, options);
  return {
    type: "round_robin",
    rounds,
    standings,
    legs: options.roundRobinLegs,
    champion: null,
    generatedAt: new Date().toISOString(),
  };
}

export function updateRoundRobinMatch(
  competition: RoundRobinCompetition,
  players: string[],
  options: TournamentOptions,
  matchId: string,
  updater: (match: BracketMatch) => void,
) {
  const rounds = cloneRounds(competition.rounds);
  const match = rounds.flatMap((round) => round.matches).find((item) => item.id === matchId);
  if (!match) return competition;
  updater(match);
  const standings = calculateStandings(players, rounds, options);
  return {
    ...competition,
    rounds,
    standings,
    champion: allPlayableMatchesComplete(rounds) ? standings[0]?.player ?? null : null,
  };
}
