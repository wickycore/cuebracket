import type { Tournament, TournamentCompetition } from "@/lib/tournaments";
import { buildRoundRobinCompetition } from "@/lib/competition/roundRobin";
import { buildSwissCompetition } from "@/lib/competition/swiss";
import { buildFreeForAllCompetition } from "@/lib/competition/freeForAll";
import { buildLeaderboardCompetition } from "@/lib/competition/leaderboard";
import { buildTwoStageCompetition } from "@/lib/competition/twoStage";

export function buildTournamentCompetition(tournament: Tournament): TournamentCompetition {
  if (tournament.type === "two_stage") {
    return buildTwoStageCompetition(tournament.players, tournament.options);
  }
  switch (tournament.format) {
    case "round_robin":
      return buildRoundRobinCompetition(tournament.players, tournament.options);
    case "swiss":
      return buildSwissCompetition(tournament.players, tournament.options);
    case "free_for_all":
      return buildFreeForAllCompetition(tournament.players, tournament.options);
    case "leaderboard":
      return buildLeaderboardCompetition(tournament.players, tournament.options);
    default:
      throw new Error("This format uses the elimination bracket engine.");
  }
}
