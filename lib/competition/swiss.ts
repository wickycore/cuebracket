import type {
  BracketMatch,
  BracketRound,
  StandingRow,
  SwissCompetition,
  TournamentOptions,
} from "@/lib/tournaments";
import {
  calculateStandings,
  cloneRounds,
  currentRoundComplete,
  makeCompetitionMatch,
} from "@/lib/competition/common";

function pairKey(a: string, b: string) {
  return [a, b].sort((left, right) => left.localeCompare(right)).join("::");
}

function previousPairs(rounds: BracketRound[]) {
  return new Set(
    rounds
      .flatMap((round) => round.matches)
      .filter((match) => match.player1 && match.player2)
      .map((match) => pairKey(match.player1!, match.player2!)),
  );
}

function byeRecipients(rounds: BracketRound[]) {
  return new Set(
    rounds
      .flatMap((round) => round.matches)
      .filter((match) => Boolean(match.player1) !== Boolean(match.player2))
      .map((match) => match.player1 ?? match.player2)
      .filter((player): player is string => Boolean(player)),
  );
}

function sortSwissRows(rows: StandingRow[]) {
  return [...rows]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if ((b.buchholz ?? 0) !== (a.buchholz ?? 0)) return (b.buchholz ?? 0) - (a.buchholz ?? 0);
      if (b.frameDifference !== a.frameDifference) return b.frameDifference - a.frameDifference;
      if (b.framesFor !== a.framesFor) return b.framesFor - a.framesFor;
      return a.player.localeCompare(b.player);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function swissStandings(
  players: string[],
  rounds: BracketRound[],
  options: TournamentOptions,
) {
  const rows = calculateStandings(players, rounds, options, {}, true);
  const map = new Map(rows.map((row) => [row.player, { ...row }]));
  rounds.flatMap((round) => round.matches).forEach((match) => {
    if (!match.completed || Boolean(match.player1) === Boolean(match.player2)) return;
    const player = match.player1 ?? match.player2;
    if (!player) return;
    const row = map.get(player);
    if (!row) return;
    // A Swiss BYE awards the configured win points, but it is not an
    // on-table match. Keep P and W as physical-match statistics and
    // track the automatic award separately in the BYE column.
    row.byes = (row.byes ?? 0) + 1;
    row.points += options.pointsForWin;
  });
  return sortSwissRows(Array.from(map.values()));
}

function makeSwissRound(
  players: string[],
  standings: StandingRow[],
  previousRounds: BracketRound[],
  roundNumber: number,
): BracketRound {
  let pool = standings.length
    ? standings.map((row) => row.player)
    : [...players];
  const usedByes = byeRecipients(previousRounds);
  const matches: BracketMatch[] = [];

  if (pool.length % 2 === 1) {
    let byeIndex = -1;
    for (let index = pool.length - 1; index >= 0; index -= 1) {
      if (!usedByes.has(pool[index])) {
        byeIndex = index;
        break;
      }
    }
    if (byeIndex < 0) byeIndex = pool.length - 1;
    const [byePlayer] = pool.splice(byeIndex, 1);
    matches.push(
      makeCompetitionMatch(
        `sw-r${roundNumber}-bye`,
        roundNumber,
        999,
        byePlayer,
        null,
      ),
    );
  }

  const seen = previousPairs(previousRounds);
  let position = 0;
  while (pool.length >= 2) {
    const player1 = pool.shift()!;
    let opponentIndex = pool.findIndex((candidate) => !seen.has(pairKey(player1, candidate)));
    if (opponentIndex < 0) opponentIndex = 0;
    const [player2] = pool.splice(opponentIndex, 1);
    matches.push(
      makeCompetitionMatch(
        `sw-r${roundNumber}-m${position}`,
        roundNumber,
        position,
        player1,
        player2,
      ),
    );
    position += 1;
  }

  return {
    round: roundNumber,
    name: `Swiss Round ${roundNumber}`,
    matches: matches.sort((a, b) => a.position - b.position),
  };
}

export function buildSwissCompetition(
  players: string[],
  options: TournamentOptions,
): SwissCompetition {
  const seedRows = players.map((player, index) => ({
    rank: index + 1,
    player,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    framesFor: 0,
    framesAgainst: 0,
    frameDifference: 0,
    points: 0,
    buchholz: 0,
    byes: 0,
  }));
  const firstRound = makeSwissRound(players, seedRows, [], 1);
  const rounds = [firstRound];
  return {
    type: "swiss",
    rounds,
    standings: swissStandings(players, rounds, options),
    totalRounds: Math.max(1, options.swissRounds),
    currentRound: 1,
    champion: null,
    generatedAt: new Date().toISOString(),
  };
}

export function updateSwissMatch(
  competition: SwissCompetition,
  players: string[],
  options: TournamentOptions,
  matchId: string,
  updater: (match: BracketMatch) => void,
) {
  const rounds = cloneRounds(competition.rounds);
  const match = rounds.flatMap((round) => round.matches).find((item) => item.id === matchId);
  if (!match) return competition;
  updater(match);
  const standings = swissStandings(players, rounds, options);
  const finished = competition.currentRound >= competition.totalRounds && currentRoundComplete(rounds);
  return {
    ...competition,
    rounds,
    standings,
    champion: finished ? standings[0]?.player ?? null : null,
  };
}

export function canGenerateNextSwissRound(competition: SwissCompetition) {
  return competition.currentRound < competition.totalRounds && currentRoundComplete(competition.rounds);
}

export function generateNextSwissRound(
  competition: SwissCompetition,
  players: string[],
  options: TournamentOptions,
) {
  if (!canGenerateNextSwissRound(competition)) return competition;
  const roundNumber = competition.currentRound + 1;
  const nextRound = makeSwissRound(players, competition.standings, competition.rounds, roundNumber);
  const rounds = [...cloneRounds(competition.rounds), nextRound];
  return {
    ...competition,
    rounds,
    currentRound: roundNumber,
    standings: swissStandings(players, rounds, options),
  };
}
