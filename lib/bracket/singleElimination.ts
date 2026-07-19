import type {
  BracketMatch,
  BracketRound,
  SingleEliminationBracket,
} from "@/lib/tournaments";

// CueBracket 0.9E.7 — stable single-elimination engine.
const MAX_BRACKET_SIZE = 128;

function nextPowerOfTwo(value: number) {
  let size = 2;
  while (size < value && size < MAX_BRACKET_SIZE) size *= 2;
  return size;
}

function normalizeBracketSize(playerCount: number, requestedSize?: number) {
  const minimum = Math.max(2, playerCount);
  const requested = Math.max(minimum, requestedSize ?? minimum);
  return nextPowerOfTwo(Math.min(MAX_BRACKET_SIZE, requested));
}

function roundName(matchCount: number) {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semi Final";
  if (matchCount === 4) return "Quarter Final";
  return `Round of ${matchCount * 2}`;
}

function spreadPositions(total: number, count: number) {
  if (count <= 0) return new Set<number>();
  if (count >= total) {
    return new Set(Array.from({ length: total }, (_, index) => index));
  }

  return new Set(
    Array.from({ length: count }, (_, index) =>
      Math.min(total - 1, Math.floor(((index + 0.5) * total) / count)),
    ),
  );
}

/**
 * Keeps the supplied player order while spreading BYEs across the first round.
 * This prevents a large block of BYEs from collapsing one side of the bracket.
 */
function balancedSlots(players: string[], requestedSize?: number) {
  const size = normalizeBracketSize(players.length, requestedSize);
  const firstRoundMatches = size / 2;
  const playerCount = Math.min(players.length, size);
  const slots: Array<string | null> = [];

  if (playerCount >= firstRoundMatches) {
    const twoPlayerMatchCount = playerCount - firstRoundMatches;
    const twoPlayerPositions = spreadPositions(
      firstRoundMatches,
      twoPlayerMatchCount,
    );
    let playerIndex = 0;

    for (let matchIndex = 0; matchIndex < firstRoundMatches; matchIndex += 1) {
      slots.push(players[playerIndex] ?? null);
      playerIndex += 1;

      if (twoPlayerPositions.has(matchIndex)) {
        slots.push(players[playerIndex] ?? null);
        playerIndex += 1;
      } else {
        slots.push(null);
      }
    }

    return slots;
  }

  const occupiedMatches = spreadPositions(firstRoundMatches, playerCount);
  let playerIndex = 0;

  for (let matchIndex = 0; matchIndex < firstRoundMatches; matchIndex += 1) {
    if (occupiedMatches.has(matchIndex)) {
      slots.push(players[playerIndex] ?? null, null);
      playerIndex += 1;
    } else {
      slots.push(null, null);
    }
  }

  return slots;
}

function makeMatch(
  round: number,
  position: number,
  player1: string | null,
  player2: string | null,
): BracketMatch {
  return {
    id: `se-r${round}-m${position}`,
    round,
    position,
    player1,
    player2,
    score1: null,
    score2: null,
    winner: null,
    completed: false,
    status: "pending",
    startedAt: null,
    endedAt: null,
    scoreHistory: [],
  };
}

function cloneMatch(match: BracketMatch): BracketMatch {
  return {
    ...match,
    scoreHistory: [...(match.scoreHistory ?? [])],
  };
}

function resetMatch(match: BracketMatch) {
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

function resolveKnownParticipants(match: BracketMatch) {
  if (match.player1 && match.player2) {
    // Preserve a legitimate completed result. Otherwise this is playable.
    if (!match.completed) match.status = match.status ?? "pending";
    return;
  }

  if (match.player1 || match.player2) {
    const advancingPlayer = match.player1 ?? match.player2;
    match.score1 = null;
    match.score2 = null;
    match.winner = advancingPlayer;
    match.completed = true;
    match.status = "finished";
    match.startedAt = null;
    match.endedAt = null;
    match.scoreHistory = [];
    return;
  }

  // A fully empty branch is resolved, but it is not a played match or a BYE.
  match.score1 = null;
  match.score2 = null;
  match.winner = null;
  match.completed = true;
  match.status = "finished";
  match.startedAt = null;
  match.endedAt = null;
  match.scoreHistory = [];
}

export function isValidRaceResult(
  score1: number,
  score2: number,
  raceTo: number,
) {
  return (
    Number.isInteger(score1) &&
    Number.isInteger(score2) &&
    Number.isInteger(raceTo) &&
    raceTo > 0 &&
    score1 >= 0 &&
    score2 >= 0 &&
    score1 !== score2 &&
    Math.max(score1, score2) === raceTo &&
    Math.min(score1, score2) < raceTo
  );
}

export function buildSingleEliminationBracket(
  players: string[],
  requestedSize?: number,
): SingleEliminationBracket {
  const cleanPlayers = players
    .map((player) => player.trim())
    .filter(Boolean)
    .slice(0, MAX_BRACKET_SIZE);
  const slots = balancedSlots(cleanPlayers, requestedSize);
  const firstRoundCount = slots.length / 2;

  const rounds: BracketRound[] = [
    {
      round: 1,
      name: roundName(firstRoundCount),
      matches: Array.from({ length: firstRoundCount }, (_, position) => {
        const player1 = slots[position * 2] ?? null;
        const player2 = slots[position * 2 + 1] ?? null;
        const match = makeMatch(1, position, player1, player2);
        match.source1 = { kind: "seed", player: player1 };
        match.source2 = { kind: "seed", player: player2 };
        resolveKnownParticipants(match);
        return match;
      }),
    },
  ];

  let matchCount = firstRoundCount / 2;
  let roundNumber = 2;

  while (matchCount >= 1) {
    const previousRound = rounds[rounds.length - 1];
    rounds.push({
      round: roundNumber,
      name: roundName(matchCount),
      matches: Array.from({ length: matchCount }, (_, position) => {
        const match = makeMatch(roundNumber, position, null, null);
        match.source1 = {
          kind: "winner",
          matchId: previousRound.matches[position * 2].id,
        };
        match.source2 = {
          kind: "winner",
          matchId: previousRound.matches[position * 2 + 1].id,
        };
        return match;
      }),
    });
    matchCount /= 2;
    roundNumber += 1;
  }

  return recomputeSingleEliminationBracket({
    type: "single",
    rounds,
    generatedAt: new Date().toISOString(),
    champion: null,
  });
}

export function recomputeSingleEliminationBracket(
  bracket: SingleEliminationBracket,
): SingleEliminationBracket {
  const rounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches.map(cloneMatch),
  }));

  // Normalize first-round seed sources and genuine BYEs.
  rounds[0]?.matches.forEach((match) => {
    match.source1 = { kind: "seed", player: match.player1 };
    match.source2 = { kind: "seed", player: match.player2 };

    if (!match.player1 || !match.player2) {
      resolveKnownParticipants(match);
    } else if (
      match.completed &&
      (match.score1 === null ||
        match.score2 === null ||
        match.winner === null ||
        ![match.player1, match.player2].includes(match.winner))
    ) {
      resetMatch(match);
    }
  });

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1].matches;
    const current = rounds[roundIndex].matches;

    current.forEach((match, position) => {
      const feeder1 = previous[position * 2];
      const feeder2 = previous[position * 2 + 1];
      const feeder1Resolved = Boolean(feeder1?.completed);
      const feeder2Resolved = Boolean(feeder2?.completed);
      const bothFeedersResolved = feeder1Resolved && feeder2Resolved;
      const player1 = feeder1Resolved ? feeder1?.winner ?? null : null;
      const player2 = feeder2Resolved ? feeder2?.winner ?? null : null;

      match.source1 = feeder1
        ? { kind: "winner", matchId: feeder1.id }
        : undefined;
      match.source2 = feeder2
        ? { kind: "winner", matchId: feeder2.id }
        : undefined;

      const participantsChanged =
        match.player1 !== player1 || match.player2 !== player2;
      match.player1 = player1;
      match.player2 = player2;

      if (participantsChanged) resetMatch(match);

      // Never treat an unfinished feeder as a BYE. This prevents a player from
      // travelling through the semi-final and final before opponents qualify.
      if (!bothFeedersResolved) {
        resetMatch(match);
        match.player1 = player1;
        match.player2 = player2;
        return;
      }

      if (!match.player1 || !match.player2) {
        resolveKnownParticipants(match);
      } else if (
        match.completed &&
        (match.score1 === null ||
          match.score2 === null ||
          match.winner === null ||
          ![match.player1, match.player2].includes(match.winner))
      ) {
        resetMatch(match);
      }
    });
  }

  const final = rounds.at(-1)?.matches[0];
  const champion =
    final?.completed &&
    Boolean(final.player1) &&
    Boolean(final.player2) &&
    Boolean(final.winner) &&
    [final.player1, final.player2].includes(final.winner)
      ? final.winner
      : null;

  return {
    ...bracket,
    rounds,
    champion,
  };
}

export function updateSingleEliminationMatch(
  bracket: SingleEliminationBracket,
  matchId: string,
  updater: (match: BracketMatch) => void,
) {
  const next: SingleEliminationBracket = {
    ...bracket,
    rounds: bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map(cloneMatch),
    })),
  };

  const match = next.rounds
    .flatMap((round) => round.matches)
    .find((item) => item.id === matchId);

  if (!match) return bracket;
  updater(match);
  return recomputeSingleEliminationBracket(next);
}

export function countSingleEliminationPlayedMatches(
  bracket: SingleEliminationBracket,
) {
  return bracket.rounds
    .flatMap((round) => round.matches)
    .filter(
      (match) =>
        match.completed && Boolean(match.player1) && Boolean(match.player2),
    ).length;
}
