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
