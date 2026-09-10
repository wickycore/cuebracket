import type { BracketMatch, BracketRound } from "@/lib/tournaments";

export type BracketConnection = {
  from: string;
  to: string;
  targetSlot: 0 | 1;
};

export type BracketEntryStub = {
  to: string;
  targetSlot: 0 | 1;
};

export type BracketConnectionPlan = {
  connections: BracketConnection[];
  entryStubs: BracketEntryStub[];
};

function isAutomaticAdvance(match: BracketMatch | undefined) {
  return Boolean(
    match?.completed && Boolean(match.player1) !== Boolean(match.player2),
  );
}

/**
 * Builds connector routes for the cards that are actually rendered. When the
 * compact spectator chart removes a BYE-only card, a short entry stub is kept
 * on the destination player row so the bracket never appears disconnected.
 */
export function buildBracketConnectionPlan(
  visibleRounds: BracketRound[],
  sourceRounds: BracketRound[] = visibleRounds,
): BracketConnectionPlan {
  const visibleIds = new Set(
    visibleRounds.flatMap((round) => round.matches.map((match) => match.id)),
  );
  const sourceMatches = new Map(
    sourceRounds
      .flatMap((round) => round.matches)
      .map((match) => [match.id, match]),
  );
  const connections: BracketConnection[] = [];
  const entryStubs: BracketEntryStub[] = [];
  const connectedSlots = new Set<string>();
  const stubbedSlots = new Set<string>();

  const slotKey = (to: string, targetSlot: 0 | 1) =>
    `${to}:${targetSlot}`;

  const addConnection = (
    from: string,
    to: string,
    targetSlot: 0 | 1,
  ) => {
    if (!visibleIds.has(from) || !visibleIds.has(to)) return;
    const key = slotKey(to, targetSlot);
    if (connectedSlots.has(key)) return;
    connectedSlots.add(key);
    connections.push({ from, to, targetSlot });
  };

  const addEntryStub = (to: string, targetSlot: 0 | 1) => {
    if (!visibleIds.has(to)) return;
    const key = slotKey(to, targetSlot);
    if (connectedSlots.has(key) || stubbedSlots.has(key)) return;
    stubbedSlots.add(key);
    entryStubs.push({ to, targetSlot });
  };

  for (const round of visibleRounds) {
    for (const match of round.matches) {
      ([match.source1, match.source2] as const).forEach((source, index) => {
        const targetSlot = index as 0 | 1;
        if (!source || source.kind === "seed") return;

        if (visibleIds.has(source.matchId)) {
          addConnection(source.matchId, match.id, targetSlot);
          return;
        }

        if (isAutomaticAdvance(sourceMatches.get(source.matchId))) {
          addEntryStub(match.id, targetSlot);
        }
      });
    }
  }

  // Older cloud snapshots can be missing source metadata. Recover the route
  // from the player that advanced, then fall back to standard bracket order.
  for (
    let roundIndex = 1;
    roundIndex < visibleRounds.length;
    roundIndex += 1
  ) {
    const previous = visibleRounds[roundIndex - 1]?.matches ?? [];
    const current = visibleRounds[roundIndex]?.matches ?? [];
    if (!current.length || !previous.length) continue;

    current.forEach((target, position) => {
      ([target.player1, target.player2] as const).forEach((player, index) => {
        const targetSlot = index as 0 | 1;
        if (!player || connectedSlots.has(slotKey(target.id, targetSlot))) {
          return;
        }

        const source = previous.find((candidate) => {
          const advancingPlayer =
            candidate.winner ??
            (candidate.completed &&
            Boolean(candidate.player1) !== Boolean(candidate.player2)
              ? candidate.player1 ?? candidate.player2
              : null);
          return advancingPlayer === player;
        });

        if (source) addConnection(source.id, target.id, targetSlot);
      });

      if (previous.length !== current.length * 2) return;

      const first = previous[position * 2];
      const second = previous[position * 2 + 1];
      if (first) addConnection(first.id, target.id, 0);
      if (second) addConnection(second.id, target.id, 1);
    });
  }

  return { connections, entryStubs };
}
