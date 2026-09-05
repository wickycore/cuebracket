import type {
  BracketMatch,
  BracketRound,
  Tournament,
  TournamentBracket,
  TournamentCompetition,
} from "@/lib/tournaments";

export interface TournamentRaceGroup {
  id: string;
  label: string;
  matches: BracketMatch[];
}

export function getMatchRaceTo(match: BracketMatch, fallback: number) {
  return Number.isInteger(match.raceTo) && (match.raceTo ?? 0) > 0
    ? match.raceTo as number
    : fallback;
}

function roundGroups(prefix: string, rounds: BracketRound[] = []): TournamentRaceGroup[] {
  return rounds.map((round) => ({
    id: `${prefix}:${round.round}:${round.name}`,
    label: prefix ? `${prefix} · ${round.name}` : round.name,
    matches: round.matches,
  }));
}

function bracketGroups(bracket: TournamentBracket | undefined, prefix = "") {
  if (!bracket) return [];
  if (bracket.type === "single") return roundGroups(prefix, bracket.rounds);
  return [
    ...roundGroups(prefix ? `${prefix} · Winners` : "Winners", bracket.winners),
    ...roundGroups(prefix ? `${prefix} · Losers` : "Losers", bracket.losers),
    ...roundGroups(prefix ? `${prefix} · Grand Final` : "Grand Final", bracket.grandFinal),
  ];
}

export function getTournamentRaceGroups(tournament: Tournament): TournamentRaceGroup[] {
  if (tournament.bracket) return bracketGroups(tournament.bracket);
  const competition = tournament.competition;
  if (!competition) return [];
  if (competition.type === "two_stage") {
    return [
      ...competition.groups.flatMap((group) => [
        ...roundGroups(group.name, group.rounds),
        ...roundGroups(`${group.name} · Playoff`, group.qualificationPlayoffRounds),
      ]),
      ...bracketGroups(competition.finalBracket, "Final stage"),
    ];
  }
  const competitionRounds = "rounds" in competition && Array.isArray(competition.rounds)
    ? competition.rounds
    : [];
  return [
    ...roundGroups("", competitionRounds),
    ...roundGroups("Championship playoff", competition.playoffRounds),
  ];
}

function applyRaceTo(value: unknown, matchIds: Set<string>, raceTo: number): unknown {
  if (Array.isArray(value)) return value.map((item) => applyRaceTo(item, matchIds, raceTo));
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  if (
    typeof record.id === "string" &&
    matchIds.has(record.id) &&
    "player1" in record &&
    "player2" in record
  ) {
    return { ...record, raceTo };
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, applyRaceTo(item, matchIds, raceTo)]),
  );
}

export function setTournamentMatchesRaceTo(
  tournament: Tournament,
  matchIds: string[],
  raceTo: number,
): { bracket?: TournamentBracket; competition?: TournamentCompetition } {
  const normalizedRace = Math.max(1, Math.min(50, Math.floor(raceTo)));
  const ids = new Set(matchIds);
  return {
    bracket: tournament.bracket
      ? applyRaceTo(tournament.bracket, ids, normalizedRace) as TournamentBracket
      : undefined,
    competition: tournament.competition
      ? applyRaceTo(tournament.competition, ids, normalizedRace) as TournamentCompetition
      : undefined,
  };
}

export function raceGroupHasPlayedActivity(group: TournamentRaceGroup) {
  return group.matches.some((match) =>
    Boolean(
      match.player1 &&
      match.player2 &&
      (match.startedAt || match.endedAt || match.winner || match.completed || match.score1 !== null || match.score2 !== null),
    ),
  );
}
