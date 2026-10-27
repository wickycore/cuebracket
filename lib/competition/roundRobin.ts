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
  if ((options.leaguePlayoffQualifiers ?? 0) > 0) {
    const knockoutRounds = progressKnockout(competition.knockoutRounds ?? [], options);
    const final = knockoutRounds.at(-1);
    const finalMatch = final?.name === "Grand Final" ? final.matches[0] : undefined;
    return { ...competition, standings, knockoutRounds, champion: finalMatch?.completed ? finalMatch.winner : null };
  }
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
  const knockoutRounds = cloneRounds(competition.knockoutRounds ?? []);
  const match = [...rounds, ...playoffRounds, ...knockoutRounds]
    .flatMap((round) => round.matches)
    .find((item) => item.id === matchId);
  if (!match) return competition;
  updater(match);
  return resolveRoundRobin({
    ...competition,
    rounds,
    playoffRounds,
    knockoutRounds,
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

function knockoutMatch(id: string, round: number, position: number, a: string, b: string, raceTo: number): BracketMatch {
  return { id, round, position, player1: a, player2: b, score1: null, score2: null, winner: null, completed: false, status: "pending", raceTo };
}

function progressKnockout(rounds: RoundRobinCompetition["rounds"], options: TournamentOptions) {
  if (!rounds.length) return rounds;
  const last = rounds[rounds.length - 1];
  if (!last.matches.every((m) => m.completed && m.winner)) return rounds;
  if (last.name === "Grand Final") return rounds;
  const winners = last.matches.map((m) => m.winner!);
  const qualifiers = options.leaguePlayoffQualifiers ?? 0;
  const race = options.leaguePlayoffRaceTo ?? 5;
  const finalRace = options.leagueFinalRaceTo ?? 7;
  let next: BracketMatch[];
  let name: string;
  if (qualifiers === 6 && rounds.length === 1) {
    const seeds = rounds[0].name.split("|").slice(1);
    // Third vs sixth, fourth vs fifth. Seed 1 faces winner of fourth vs fifth.
    next = [knockoutMatch("league-sf-1", 2, 0, seeds[0], winners[1], race),
      knockoutMatch("league-sf-2", 2, 1, seeds[1], winners[0], race)];
    name = "Semifinals";
  } else if (winners.length === 4) {
    next = [knockoutMatch("league-sf-1", 2, 0, winners[0], winners[3], race),
      knockoutMatch("league-sf-2", 2, 1, winners[1], winners[2], race)];
    name = "Semifinals";
  } else if (winners.length === 2) {
    next = [knockoutMatch("league-final", last.round + 1, 0, winners[0], winners[1], finalRace)];
    name = "Grand Final";
  } else return rounds;
  return [...rounds, { round: last.round + 1, name, matches: next }];
}

export function confirmLeaguePlayoffs(competition: RoundRobinCompetition, options: TournamentOptions) {
  if (!allPlayableMatchesComplete(competition.rounds)) throw new Error("Complete all league fixtures first.");
  const count = options.leaguePlayoffQualifiers ?? 0;
  if (![4, 6, 8].includes(count) || competition.standings.length < count) throw new Error("Invalid playoff qualification size.");
  const selected = competition.standings.slice(0, count);
  if (selected.some((row) => row.rank !== selected.indexOf(row) + 1)) {
    throw new Error("Playoff qualification has an unresolved ranking tie. Resolve the tie before confirming.");
  }
  const p = selected.map((r) => r.player);
  const race = options.leaguePlayoffRaceTo ?? 5;
  const first = count === 6
    ? [knockoutMatch("league-q-1", 1, 0, p[2], p[5], race), knockoutMatch("league-q-2", 1, 1, p[3], p[4], race)]
    : count === 4
    ? [knockoutMatch("league-sf-1", 1, 0, p[0], p[3], race), knockoutMatch("league-sf-2", 1, 1, p[1], p[2], race)]
    : [knockoutMatch("league-q-1", 1, 0, p[0], p[7], race), knockoutMatch("league-q-2", 1, 1, p[3], p[4], race),
       knockoutMatch("league-q-3", 1, 2, p[1], p[6], race), knockoutMatch("league-q-4", 1, 3, p[2], p[5], race)];
  const title = count === 4 ? "Semifinals" : "Quarterfinals";
  // Persist top-two seed identities for the six-player semifinal bye.
  const name = count === 6 ? title + "|" + p[0] + "|" + p[1] : title;
  return { ...competition, knockoutConfirmed: true, knockoutRounds: [{ round: 1, name, matches: first }], champion: null };
}
