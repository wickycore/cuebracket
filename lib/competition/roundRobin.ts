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

function samePlayers(first: string[], second: string[]) {
  return (
    first.length === second.length &&
    [...first].sort().every((player, index) => player === [...second].sort()[index])
  );
}

function makePlayoffRounds(players: string[], cycle: number) {
  return buildRoundRobinRounds(players, 1, `rr-playoff-${cycle}`).map(
    (round, index) => ({
      ...round,
      round: index + 1,
      name:
        players.length === 2
          ? `Championship Playoff ${cycle}`
          : `Championship Playoff ${cycle} · Round ${index + 1}`,
      matches: round.matches.map((match) => ({ ...match, round: index + 1 })),
    }),
  );
}

function resolveRoundRobin(
  competition: RoundRobinCompetition,
  players: string[],
  options: TournamentOptions,
): RoundRobinCompetition {
  const standings = calculateStandings(players, competition.rounds, options);
  if (!allPlayableMatchesComplete(competition.rounds)) {
    return { ...competition, standings, champion: null };
  }

  const tiedForFirst = standings.filter((row) => row.rank === 1).map((row) => row.player);
  if (tiedForFirst.length === 1) {
    return {
      ...competition,
      standings,
      playoffRounds: [],
      playoffStandings: [],
      playoffPlayers: [],
      champion: tiedForFirst[0],
    };
  }

  const reusePlayoff = samePlayers(competition.playoffPlayers, tiedForFirst);
  const playoffCycle = reusePlayoff ? competition.playoffCycle || 1 : 1;
  const playoffPlayers = reusePlayoff ? competition.playoffPlayers : tiedForFirst;
  const playoffRounds =
    competition.playoffRounds.length && reusePlayoff
      ? competition.playoffRounds
      : makePlayoffRounds(tiedForFirst, playoffCycle);
  const playoffStandings = calculateStandings(playoffPlayers, playoffRounds, options);
  const playoffComplete = allPlayableMatchesComplete(playoffRounds);
  const playoffLeaders = playoffStandings.filter((row) => row.rank === 1);

  return {
    ...competition,
    standings,
    playoffRounds,
    playoffStandings,
    playoffPlayers,
    playoffCycle,
    champion:
      playoffComplete && playoffLeaders.length === 1
        ? playoffLeaders[0].player
        : null,
  };
}

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
    playoffRounds: [],
    playoffStandings: [],
    playoffPlayers: [],
    playoffCycle: 0,
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
  const playoffRounds = cloneRounds(competition.playoffRounds ?? []);
  const match = [...rounds, ...playoffRounds]
    .flatMap((round) => round.matches)
    .find((item) => item.id === matchId);
  if (!match) return competition;
  updater(match);
  return resolveRoundRobin({
    ...competition,
    rounds,
    playoffRounds,
  }, players, options);
}

export function generateRoundRobinPlayoffRematch(
  competition: RoundRobinCompetition,
  options: TournamentOptions,
) {
  if (!allPlayableMatchesComplete(competition.playoffRounds ?? [])) return competition;
  const tiedPlayers = competition.playoffStandings
    .filter((row) => row.rank === 1)
    .map((row) => row.player);
  if (tiedPlayers.length < 2) return competition;
  const playoffCycle = (competition.playoffCycle ?? 1) + 1;
  const playoffRounds = makePlayoffRounds(tiedPlayers, playoffCycle);
  return {
    ...competition,
    playoffPlayers: tiedPlayers,
    playoffCycle,
    playoffRounds,
    playoffStandings: calculateStandings(tiedPlayers, playoffRounds, options),
    champion: null,
  };
}
