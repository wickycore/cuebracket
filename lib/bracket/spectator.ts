import type { BracketMatch, BracketRound, MatchSource } from "@/lib/tournaments";

export type SpectatorMatchFilter = "all" | "live" | "upcoming" | "finished";
export type SpectatorMatchState = "advanced" | "finished" | "live" | "ready" | "waiting";

export function getSpectatorMatchState(match: BracketMatch): SpectatorMatchState {
  if (match.completed && Boolean(match.player1) !== Boolean(match.player2)) return "advanced";
  if (match.completed) return "finished";
  if (match.status === "live" || (match.startedAt && !match.endedAt)) return "live";
  if (match.player1 && match.player2) return "ready";
  return "waiting";
}

export function matchesSpectatorFilter(match: BracketMatch, filter: SpectatorMatchFilter) {
  if (filter === "all") return true;
  const state = getSpectatorMatchState(match);
  if (filter === "live") return state === "live";
  if (filter === "upcoming") return state === "ready" || state === "waiting";
  return state === "finished" || state === "advanced";
}

export function getActiveSpectatorRound(rounds: BracketRound[]) {
  const liveRound = rounds.find((round) =>
    round.matches.some((match) => getSpectatorMatchState(match) === "live"),
  );
  if (liveRound) return liveRound.round;

  const readyRound = rounds.find((round) =>
    round.matches.some((match) => getSpectatorMatchState(match) === "ready"),
  );
  if (readyRound) return readyRound.round;

  const unfinishedRound = rounds.find((round) =>
    round.matches.some((match) => !match.completed),
  );
  return unfinishedRound?.round ?? rounds.at(-1)?.round ?? null;
}

export function matchesSpectatorPlayer(
  match: BracketMatch,
  query: string,
) {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return true;
  return [match.player1, match.player2, match.winner]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase().includes(search));
}

export function numberBracketMatches(rounds: BracketRound[]) {
  return new Map(
    rounds.flatMap((round) => round.matches).map((match, index) => [match.id, index + 1]),
  );
}

export function getAutomaticAdvanceCount(round: BracketRound) {
  return round.matches.filter((match) => getSpectatorMatchState(match) === "advanced").length;
}

/**
 * Keeps the real bracket untouched while removing repeated BYE-only cards from
 * the spectator flowchart. Re-indexing the remaining opening matches lets the
 * visual layout use the space evenly instead of preserving empty seed slots.
 */
export function compactSpectatorRounds(rounds: BracketRound[]) {
  return rounds.map((round) => {
    const automaticAdvanceCount = getAutomaticAdvanceCount(round);
    const playableMatches = round.matches.filter(
      (match) => getSpectatorMatchState(match) !== "advanced",
    );

    if (automaticAdvanceCount < 2 || playableMatches.length === 0) return round;

    return {
      ...round,
      matches: playableMatches.map((match, position) => ({ ...match, position })),
    };
  });
}

export function buildCompactSpectatorCenters(rounds: BracketRound[], maxMatches: number) {
  const centers = new Map<string, number>();

  const anchorIndex = Math.max(
    0,
    rounds.findIndex((round) => round.matches.length === maxMatches),
  );
  const anchor = rounds[anchorIndex];
  const anchorSpan = maxMatches / Math.max(1, anchor?.matches.length ?? 1);

  anchor?.matches.forEach((match, index) => {
    centers.set(match.id, index * anchorSpan + (anchorSpan - 1) / 2);
  });

  for (let roundIndex = anchorIndex - 1; roundIndex >= 0; roundIndex -= 1) {
    const round = rounds[roundIndex];
    const nextRound = rounds[roundIndex + 1];
    const span = maxMatches / Math.max(1, round.matches.length);
    round.matches.forEach((match, index) => {
      const target = nextRound?.matches.find(
        (candidate) =>
          (candidate.source1?.kind !== "seed" &&
            candidate.source1?.matchId === match.id) ||
          (candidate.source2?.kind !== "seed" &&
            candidate.source2?.matchId === match.id),
      );
      const targetCenter = target ? centers.get(target.id) : undefined;
      if (target && targetCenter !== undefined) {
        const targetSlot =
          target.source2?.kind !== "seed" &&
          target.source2?.matchId === match.id
            ? 1
            : 0;
        centers.set(match.id, targetCenter + (targetSlot === 0 ? -0.15 : 0.15));
      } else {
        centers.set(match.id, index * span + (span - 1) / 2);
      }
    });
  }

  for (let roundIndex = anchorIndex + 1; roundIndex < rounds.length; roundIndex += 1) {
    const round = rounds[roundIndex];
    const span = maxMatches / Math.max(1, round.matches.length);
    round.matches.forEach((match, index) => {
      const feederCenters = [match.source1, match.source2]
        .flatMap((source) => {
          if (!source || source.kind === "seed") return [];
          const center = centers.get(source.matchId);
          return center === undefined ? [] : [center];
        });
      centers.set(
        match.id,
        feederCenters.length
          ? feederCenters.reduce((sum, center) => sum + center, 0) /
              feederCenters.length
          : index * span + (span - 1) / 2,
      );
    });
  }

  return centers;
}

export function spectatorSourceLabel(
  source: MatchSource | undefined,
  matchNumbers: Map<string, number>,
) {
  if (!source) return "TBD";
  if (source.kind === "seed") return source.player ?? "Open slot";
  const number = matchNumbers.get(source.matchId);
  const matchLabel = number ? `Match #${number}` : "another match";
  return `${source.kind === "winner" ? "Winner" : "Loser"} of ${matchLabel}`;
}
