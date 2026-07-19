import type {
  BracketMatch,
  BracketRound,
  SingleEliminationBracket,
} from "@/lib/tournaments";

// CueBracket 0.9E.5 — prevent premature single-elimination champions.

function nextPowerOfTwo(value: number) {
  let size = 2;
  while (size < value && size < 128) size *= 2;
  return size;
}

function roundName(matchCount: number) {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semi Final";
  if (matchCount === 4) return "Quarter Final";
  return `Round of ${matchCount * 2}`;
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
    scoreHistory: [],
  };
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

function balancedSlots(players: string[], requestedSize?: number) {
  const size = nextPowerOfTwo(Math.max(players.length, requestedSize ?? 2));
  const matchCount = size / 2;
  const playerCount = Math.min(players.length, size);
  const slots: Array<string | null> = [];

  if (playerCount >= matchCount) {
    const fullMatchCount = playerCount - matchCount;
    const fullPositions = spreadPositions(matchCount, fullMatchCount);
    let playerIndex = 0;

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      slots.push(players[playerIndex] ?? null);
      playerIndex += 1;

      if (fullPositions.has(matchIndex)) {
        slots.push(players[playerIndex] ?? null);
        playerIndex += 1;
      } else {
        slots.push(null);
      }
    }

    return slots;
  }

  const occupied = spreadPositions(matchCount, playerCount);
  let playerIndex = 0;

  for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
    if (occupied.has(matchIndex)) {
      slots.push(players[playerIndex] ?? null, null);
      playerIndex += 1;
    } else {
      slots.push(null, null);
    }
  }

  return slots;
}

function resetMatch(match: BracketMatch) {
  match.score1 = null;
  match.score2 = null;
  match.winner = null;
  match.completed = false;
  match.status = "pending";
  match.startedAt = null;
  match.endedAt = null;
  match.scoreHistory = [];
}

function autoResolve(match: BracketMatch) {
  if (match.player1 && !match.player2) {
    match.winner = match.player1;
    match.completed = true;
    match.status = "finished";
  } else if (!match.player1 && match.player2) {
    match.winner = match.player2;
    match.completed = true;
    match.status = "finished";
  } else if (!match.player1 && !match.player2) {
    match.winner = null;
    match.completed = true;
    match.status = "finished";
  }
}

function cloneMatch(match: BracketMatch): BracketMatch {
  return {
    ...match,
    scoreHistory: [...(match.scoreHistory ?? [])],
  };
}

export function buildSingleEliminationBracket(
  players: string[],
  requestedSize?: number,
): SingleEliminationBracket {
  const slots = balancedSlots(players, requestedSize);
  const firstCount = slots.length / 2;

  const rounds: BracketRound[] = [
    {
      round: 1,
      name: roundName(firstCount),
      matches: Array.from({ length: firstCount }, (_, position) => {
        const match = makeMatch(
          1,
          position,
          slots[position * 2],
          slots[position * 2 + 1],
        );

        // Only first-round empty slots are genuine seeded BYEs.
        autoResolve(match);
        return match;
      }),
    },
  ];

  let count = firstCount / 2;
  let round = 2;

  while (count >= 1) {
    rounds.push({
      round,
      name: roundName(count),
      matches: Array.from({ length: count }, (_, position) =>
        makeMatch(round, position, null, null),
      ),
    });
    count /= 2;
    round += 1;
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

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1].matches;
    const current = rounds[roundIndex].matches;

    current.forEach((match, position) => {
      const feeder1 = previous[position * 2];
      const feeder2 = previous[position * 2 + 1];
      const feedersResolved = Boolean(feeder1?.completed && feeder2?.completed);

      const player1 = feeder1?.completed ? feeder1.winner ?? null : null;
      const player2 = feeder2?.completed ? feeder2.winner ?? null : null;
      const participantsChanged =
        match.player1 !== player1 || match.player2 !== player2;

      match.player1 = player1;
      match.player2 = player2;

      // A missing player in a later round is not automatically a BYE while
      // either feeder match is still unfinished. This was the bug that let a
      // first-round winner travel through the semi-final and final immediately.
      if (!feedersResolved) {
        resetMatch(match);
        return;
      }

      if (participantsChanged) {
        resetMatch(match);
      }

      // Once both feeder matches are resolved, a genuine downstream BYE can
      // safely advance. A normal two-player match remains pending for a score.
      if (!match.completed) {
        autoResolve(match);
      }
    });
  }

  const final = rounds.at(-1)?.matches[0];
  const champion =
    final?.completed && final.player1 && final.player2 ? final.winner : null;

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
