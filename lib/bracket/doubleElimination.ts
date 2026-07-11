import {
  BracketMatch,
  BracketRound,
  DoubleEliminationBracket,
  MatchSource,
  Tournament,
} from "@/lib/tournaments";

function id(prefix: string, round: number, position: number) {
  return `${prefix}-r${round}-m${position}`;
}

function seed(player: string | null): MatchSource {
  return { kind: "seed", player };
}

function winner(matchId: string): MatchSource {
  return { kind: "winner", matchId };
}

function loser(matchId: string): MatchSource {
  return { kind: "loser", matchId };
}

function blankMatch(
  matchId: string,
  round: number,
  position: number,
  source1: MatchSource,
  source2: MatchSource,
): BracketMatch {
  return {
    id: matchId,
    round,
    position,
    player1: null,
    player2: null,
    score1: null,
    score2: null,
    winner: null,
    completed: false,
    status: "pending",
    source1,
    source2,
    scoreHistory: [],
  };
}

function cloneMatch(match: BracketMatch): BracketMatch {
  return {
    ...match,
    source1: match.source1 ? { ...match.source1 } : undefined,
    source2: match.source2 ? { ...match.source2 } : undefined,
    scoreHistory: [...(match.scoreHistory ?? [])],
  };
}

function cloneRounds(rounds: BracketRound[]) {
  return rounds.map((round) => ({
    ...round,
    matches: round.matches.map(cloneMatch),
  }));
}

function loserOf(match: BracketMatch) {
  if (!match.completed || !match.winner || !match.player1 || !match.player2) return null;
  return match.winner === match.player1 ? match.player2 : match.player1;
}

function resolveSource(source: MatchSource | undefined, matches: Map<string, BracketMatch>) {
  if (!source) return { ready: false, player: null as string | null };
  if (source.kind === "seed") return { ready: true, player: source.player ?? null };
  const match = matches.get(source.matchId);
  if (!match || !match.completed) return { ready: false, player: null as string | null };
  return {
    ready: true,
    player: source.kind === "winner" ? match.winner : loserOf(match),
  };
}

function applyParticipants(
  match: BracketMatch,
  player1: string | null,
  player2: string | null,
  ready1: boolean,
  ready2: boolean,
) {
  const changed = match.player1 !== player1 || match.player2 !== player2;
  match.player1 = player1;
  match.player2 = player2;

  if (changed) {
    match.score1 = null;
    match.score2 = null;
    match.winner = null;
    match.completed = false;
    match.status = "pending";
    match.startedAt = null;
    match.endedAt = null;
    match.breakPlayer = null;
    match.scoreHistory = [];
  }

  if (!ready1 || !ready2 || match.completed) return;
  if (player1 && !player2) {
    match.winner = player1;
    match.completed = true;
    match.status = "finished";
  } else if (!player1 && player2) {
    match.winner = player2;
    match.completed = true;
    match.status = "finished";
  }
}

export function buildDoubleEliminationBracket(tournament: Tournament): DoubleEliminationBracket {
  const size = tournament.bracketSize;
  const roundsCount = Math.log2(size);
  const slots = Array.from({ length: size }, (_, index) => tournament.players[index] ?? null);

  const winners: BracketRound[] = [];
  const firstRoundMatches = size / 2;
  winners.push({
    round: 1,
    name: `Winners Round 1`,
    matches: Array.from({ length: firstRoundMatches }, (_, position) =>
      blankMatch(
        id("w", 1, position),
        1,
        position,
        seed(slots[position * 2]),
        seed(slots[position * 2 + 1]),
      ),
    ),
  });

  for (let round = 2; round <= roundsCount; round += 1) {
    const count = size / 2 ** round;
    const previous = winners[round - 2].matches;
    winners.push({
      round,
      name: round === roundsCount ? "Winners Final" : `Winners Round ${round}`,
      matches: Array.from({ length: count }, (_, position) =>
        blankMatch(
          id("w", round, position),
          round,
          position,
          winner(previous[position * 2].id),
          winner(previous[position * 2 + 1].id),
        ),
      ),
    });
  }

  const losers: BracketRound[] = [];
  let losersRoundNumber = 1;
  const wbRound1 = winners[0].matches;
  losers.push({
    round: losersRoundNumber,
    name: "Losers Round 1",
    matches: Array.from({ length: size / 4 }, (_, position) =>
      blankMatch(
        id("l", losersRoundNumber, position),
        losersRoundNumber,
        position,
        loser(wbRound1[position * 2].id),
        loser(wbRound1[position * 2 + 1].id),
      ),
    ),
  });

  let previousLosersRound = losers[0];
  for (let wbRoundIndex = 2; wbRoundIndex <= roundsCount; wbRoundIndex += 1) {
    losersRoundNumber += 1;
    const wbRound = winners[wbRoundIndex - 1];
    const majorCount = wbRound.matches.length;
    const majorRound: BracketRound = {
      round: losersRoundNumber,
      name: wbRoundIndex === roundsCount ? "Losers Final" : `Losers Round ${losersRoundNumber}`,
      matches: Array.from({ length: majorCount }, (_, position) =>
        blankMatch(
          id("l", losersRoundNumber, position),
          losersRoundNumber,
          position,
          winner(previousLosersRound.matches[position].id),
          loser(wbRound.matches[position].id),
        ),
      ),
    };
    losers.push(majorRound);
    previousLosersRound = majorRound;

    if (wbRoundIndex < roundsCount) {
      losersRoundNumber += 1;
      const minorRound: BracketRound = {
        round: losersRoundNumber,
        name: `Losers Round ${losersRoundNumber}`,
        matches: Array.from({ length: majorCount / 2 }, (_, position) =>
          blankMatch(
            id("l", losersRoundNumber, position),
            losersRoundNumber,
            position,
            winner(majorRound.matches[position * 2].id),
            winner(majorRound.matches[position * 2 + 1].id),
          ),
        ),
      };
      losers.push(minorRound);
      previousLosersRound = minorRound;
    }
  }

  const winnersFinal = winners.at(-1)!.matches[0];
  const losersFinal = losers.at(-1)!.matches[0];
  const grandFinal: BracketRound[] = [
    {
      round: 1,
      name: "Grand Final",
      matches: [blankMatch("gf-r1-m0", 1, 0, winner(winnersFinal.id), winner(losersFinal.id))],
    },
    {
      round: 2,
      name: "Bracket Reset",
      matches: [blankMatch("gf-r2-m0", 2, 0, seed(null), seed(null))],
    },
  ];

  return recomputeDoubleEliminationBracket({
    type: "double",
    winners,
    losers,
    grandFinal,
    generatedAt: new Date().toISOString(),
    champion: null,
    resetRequired: false,
    bracketResetEnabled: true,
  });
}

export function recomputeDoubleEliminationBracket(
  bracket: DoubleEliminationBracket,
): DoubleEliminationBracket {
  const next: DoubleEliminationBracket = {
    ...bracket,
    winners: cloneRounds(bracket.winners),
    losers: cloneRounds(bracket.losers),
    grandFinal: cloneRounds(bracket.grandFinal),
    champion: null,
    resetRequired: false,
  };

  const allMatches = [
    ...next.winners.flatMap((round) => round.matches),
    ...next.losers.flatMap((round) => round.matches),
    ...next.grandFinal.flatMap((round) => round.matches),
  ];
  const map = new Map(allMatches.map((match) => [match.id, match]));

  for (const round of [...next.winners, ...next.losers]) {
    for (const match of round.matches) {
      const left = resolveSource(match.source1, map);
      const right = resolveSource(match.source2, map);
      applyParticipants(match, left.player, right.player, left.ready, right.ready);
    }
  }

  const gf1 = next.grandFinal[0].matches[0];
  const left = resolveSource(gf1.source1, map);
  const right = resolveSource(gf1.source2, map);
  applyParticipants(gf1, left.player, right.player, left.ready, right.ready);

  const gf2 = next.grandFinal[1].matches[0];
  const winnersChampion = left.player;
  const losersChampion = right.player;
  const resetNeeded = Boolean(
    next.bracketResetEnabled &&
      gf1.completed &&
      gf1.winner &&
      losersChampion &&
      gf1.winner === losersChampion,
  );
  next.resetRequired = resetNeeded;

  if (resetNeeded && winnersChampion && losersChampion) {
    applyParticipants(gf2, winnersChampion, losersChampion, true, true);
    if (gf2.completed) next.champion = gf2.winner;
  } else {
    applyParticipants(gf2, null, null, true, true);
    gf2.completed = false;
    gf2.winner = null;
    gf2.score1 = null;
    gf2.score2 = null;
    gf2.status = "pending";
    if (gf1.completed) next.champion = gf1.winner;
  }

  return next;
}

export function findDoubleMatch(bracket: DoubleEliminationBracket, matchId: string) {
  return [
    ...bracket.winners.flatMap((round) => round.matches),
    ...bracket.losers.flatMap((round) => round.matches),
    ...bracket.grandFinal.flatMap((round) => round.matches),
  ].find((match) => match.id === matchId);
}

export function updateDoubleMatch(
  bracket: DoubleEliminationBracket,
  matchId: string,
  updater: (match: BracketMatch) => void,
) {
  const next: DoubleEliminationBracket = {
    ...bracket,
    winners: cloneRounds(bracket.winners),
    losers: cloneRounds(bracket.losers),
    grandFinal: cloneRounds(bracket.grandFinal),
  };
  const match = findDoubleMatch(next, matchId);
  if (!match) return bracket;
  updater(match);
  return recomputeDoubleEliminationBracket(next);
}
