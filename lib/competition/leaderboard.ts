import type {
  BracketMatch,
  LeaderboardCompetition,
  TournamentOptions,
} from "@/lib/tournaments";
import {
  allPlayableMatchesComplete,
  buildRoundRobinRounds,
  calculateStandings,
  cloneRounds,
} from "@/lib/competition/common";

export function buildLeaderboardCompetition(
  players: string[],
  options: TournamentOptions,
): LeaderboardCompetition {
  const cycles = Math.max(1, options.leaderboardCycles);
  const rounds = buildRoundRobinRounds(players, cycles > 1 ? 2 : 1, "lb");
  const selectedRounds = cycles <= 2
    ? rounds
    : Array.from({ length: cycles }, (_, cycle) =>
        buildRoundRobinRounds(players, 1, `lb-c${cycle + 1}`).map((round, index) => ({
          ...round,
          round: cycle * (players.length % 2 === 0 ? players.length - 1 : players.length) + index + 1,
          name: `Cycle ${cycle + 1} · Round ${index + 1}`,
        })),
      ).flat();
  const adjustments: Record<string, number> = {};
  const standings = calculateStandings(players, selectedRounds, options, adjustments);
  return {
    type: "leaderboard",
    rounds: selectedRounds,
    standings,
    cycles,
    adjustments,
    champion: null,
    generatedAt: new Date().toISOString(),
  };
}

export function updateLeaderboardMatch(
  competition: LeaderboardCompetition,
  players: string[],
  options: TournamentOptions,
  matchId: string,
  updater: (match: BracketMatch) => void,
) {
  const rounds = cloneRounds(competition.rounds);
  const match = rounds.flatMap((round) => round.matches).find((item) => item.id === matchId);
  if (!match) return competition;
  updater(match);
  const standings = calculateStandings(players, rounds, options, competition.adjustments);
  return {
    ...competition,
    rounds,
    standings,
    champion: allPlayableMatchesComplete(rounds) ? standings[0]?.player ?? null : null,
  };
}

export function setLeaderboardAdjustment(
  competition: LeaderboardCompetition,
  players: string[],
  options: TournamentOptions,
  player: string,
  value: number,
) {
  const adjustments = { ...competition.adjustments, [player]: value };
  const standings = calculateStandings(players, competition.rounds, options, adjustments);
  return { ...competition, adjustments, standings };
}
