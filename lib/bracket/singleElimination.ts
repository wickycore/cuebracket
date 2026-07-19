import type {
  BracketMatch,
  BracketRound,
  SingleEliminationBracket,
} from "@/lib/tournaments";
import {
  clearBracketMatch,
  hasPlayedOrStartedMatch,
  type LateEntryByeSlot,
  type LateEntryResult,
} from "@/lib/bracket/lateEntry";

// CueBracket 0.9E.9 — canonical single-elimination engine with late-entry BYE replacement.
const MAX_BRACKET_SIZE = 128;

type MatchSourceValue = NonNullable<BracketMatch["source1"]>;

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

/** Keeps the supplied draw order while spreading first-round BYEs. */
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

function seedSource(player: string | null): MatchSourceValue {
  return { kind: "seed", player };
}

function winnerSource(matchId: string): MatchSourceValue {
  return { kind: "winner", matchId };
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
    source1: match.source1 ? { ...match.source1 } : undefined,
    source2: match.source2 ? { ...match.source2 } : undefined,
    scoreHistory: [...(match.scoreHistory ?? [])],
  };
}

function resolveKnownParticipants(match: BracketMatch) {
  if (match.player1 && match.player2) {
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

  // Fully empty branches are structurally resolved, not played.
  match.score1 = null;
  match.score2 = null;
  match.winner = null;
  match.completed = true;
  match.status = "finished";
  match.startedAt = null;
  match.endedAt = null;
  match.scoreHistory = [];
}

function hasValidStoredWinner(match: BracketMatch) {
  return Boolean(
    match.completed &&
      match.player1 &&
      match.player2 &&
      match.winner &&
      [match.player1, match.player2].includes(match.winner) &&
      Number.isInteger(match.score1) &&
      Number.isInteger(match.score2) &&
      match.score1 !== match.score2,
  );
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
        match.source1 = seedSource(player1);
        match.source2 = seedSource(player2);
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
        match.source1 = winnerSource(previousRound.matches[position * 2].id);
        match.source2 = winnerSource(
          previousRound.matches[position * 2 + 1].id,
        );
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

/** Rebuild every downstream participant from completed feeder matches. */
export function recomputeSingleEliminationBracket(
  bracket: SingleEliminationBracket,
): SingleEliminationBracket {
  const rounds = bracket.rounds.map((round, roundIndex) => ({
    ...round,
    round: roundIndex + 1,
    name: roundName(round.matches.length),
    matches: round.matches.map((match, position) => ({
      ...cloneMatch(match),
      round: roundIndex + 1,
      position,
    })),
  }));

  rounds[0]?.matches.forEach((match) => {
    match.source1 = seedSource(match.player1);
    match.source2 = seedSource(match.player2);

    if (!match.player1 || !match.player2) {
      resolveKnownParticipants(match);
    } else if (match.completed && !hasValidStoredWinner(match)) {
      clearBracketMatch(match);
    }
  });

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1].matches;
    const current = rounds[roundIndex].matches;

    current.forEach((match, position) => {
      const feeder1 = previous[position * 2];
      const feeder2 = previous[position * 2 + 1];
      match.source1 = feeder1 ? winnerSource(feeder1.id) : undefined;
      match.source2 = feeder2 ? winnerSource(feeder2.id) : undefined;

      const feeder1Resolved = Boolean(feeder1?.completed);
      const feeder2Resolved = Boolean(feeder2?.completed);
      const bothFeedersResolved = feeder1Resolved && feeder2Resolved;
      const nextPlayer1 = feeder1Resolved ? feeder1?.winner ?? null : null;
      const nextPlayer2 = feeder2Resolved ? feeder2?.winner ?? null : null;
      const participantsChanged =
        match.player1 !== nextPlayer1 || match.player2 !== nextPlayer2;

      if (participantsChanged) clearBracketMatch(match);
      match.player1 = nextPlayer1;
      match.player2 = nextPlayer2;

      // Never treat an unfinished feeder as a BYE.
      if (!bothFeedersResolved) {
        clearBracketMatch(match);
        match.player1 = nextPlayer1;
        match.player2 = nextPlayer2;
        return;
      }

      if (!match.player1 || !match.player2) {
        resolveKnownParticipants(match);
      } else if (match.completed && !hasValidStoredWinner(match)) {
        clearBracketMatch(match);
      }
    });
  }

  const final = rounds.at(-1)?.matches[0];
  const champion =
    final &&
    hasValidStoredWinner(final) &&
    final.winner &&
    [final.player1, final.player2].includes(final.winner)
      ? final.winner
      : null;

  return { ...bracket, rounds, champion };
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

  if (!match) return recomputeSingleEliminationBracket(next);
  updater(match);
  return recomputeSingleEliminationBracket(next);
}

function findDependentSingleMatch(
  bracket: SingleEliminationBracket,
  sourceMatchId: string,
) {
  return bracket.rounds
    .slice(1)
    .flatMap((round) => round.matches)
    .find((match) =>
      [match.source1, match.source2].some(
        (source) =>
          source?.kind === "winner" && source.matchId === sourceMatchId,
      ),
    );
}

export function getSingleEliminationLateEntrySlots(
  bracket: SingleEliminationBracket,
): LateEntryByeSlot[] {
  const repaired = recomputeSingleEliminationBracket(bracket);
  const firstRound = repaired.rounds[0];
  if (!firstRound || repaired.champion) return [];

  return firstRound.matches.flatMap((match, index) => {
    const hasExactlyOnePlayer = Boolean(match.player1) !== Boolean(match.player2);
    if (!hasExactlyOnePlayer || !match.completed || !match.winner) return [];

    const dependent = findDependentSingleMatch(repaired, match.id);
    const locked = hasPlayedOrStartedMatch(dependent);

    return [
      {
        matchId: match.id,
        matchNumber: index + 1,
        roundName: firstRound.name,
        advancingPlayer: match.player1 ?? match.player2 ?? match.winner,
        available: !locked,
        lockedReason: locked
          ? "The BYE recipient's next match has already started or has a saved score."
          : undefined,
      },
    ];
  });
}

export function fillSingleEliminationByeSlot(
  bracket: SingleEliminationBracket,
  matchId: string,
  latePlayer: string,
): LateEntryResult<SingleEliminationBracket> {
  const repaired = recomputeSingleEliminationBracket(bracket);
  const slot = getSingleEliminationLateEntrySlots(repaired).find(
    (item) => item.matchId === matchId,
  );

  if (!slot) {
    return { ok: false, reason: "That automatic BYE is no longer available." };
  }

  if (!slot.available) {
    return {
      ok: false,
      reason: slot.lockedReason ?? "That BYE slot is locked.",
    };
  }

  const next = updateSingleEliminationMatch(repaired, matchId, (match) => {
    if (match.player1 && !match.player2) {
      match.player2 = latePlayer;
      match.source2 = seedSource(latePlayer);
    } else if (!match.player1 && match.player2) {
      match.player1 = latePlayer;
      match.source1 = seedSource(latePlayer);
    }
    clearBracketMatch(match);
  });

  return { ok: true, bracket: next };
}

export function countSingleEliminationPlayedMatches(
  bracket: SingleEliminationBracket,
) {
  return bracket.rounds
    .flatMap((round) => round.matches)
    .filter(
      (match) => match.completed && Boolean(match.player1) && Boolean(match.player2),
    ).length;
}

export function countSingleEliminationAutomaticByes(
  bracket: SingleEliminationBracket,
) {
  return bracket.rounds
    .flatMap((round) => round.matches)
    .filter(
      (match) => match.completed && Boolean(match.player1) !== Boolean(match.player2),
    ).length;
}
