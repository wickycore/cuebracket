import type {
  BracketMatch,
  Tournament,
  TournamentOptions,
  TwoStageCompetition,
} from "@/lib/tournaments";
import {
  allPlayableMatchesComplete,
  buildRoundRobinRounds,
  calculateStandings,
  cloneRounds,
} from "@/lib/competition/common";
import {
  buildSingleEliminationBracket,
  updateSingleEliminationMatch,
} from "@/lib/bracket/singleElimination";
import {
  buildDoubleEliminationBracket,
  updateDoubleMatch,
} from "@/lib/bracket/doubleElimination";

function nextPowerOfTwo(value: number) {
  let size = 2;
  while (size < value && size < 128) size *= 2;
  return size;
}


interface QualifiedPlayer {
  player: string;
  groupIndex: number;
  rank: number;
}

function buildCrossoverQualifierOrder(competition: TwoStageCompetition) {
  const remaining: QualifiedPlayer[] = [];
  competition.groups.forEach((group, groupIndex) => {
    for (let rank = 0; rank < competition.qualifiersPerGroup; rank += 1) {
      const player = group.standings[rank]?.player;
      if (player) remaining.push({ player, groupIndex, rank });
    }
  });

  remaining.sort((a, b) => a.rank - b.rank || a.groupIndex - b.groupIndex);
  const ordered: string[] = [];

  while (remaining.length) {
    const seed = remaining.shift()!;
    let opponentIndex = -1;
    let bestRank = -1;
    let bestGroupDistance = -1;

    remaining.forEach((candidate, index) => {
      if (candidate.groupIndex === seed.groupIndex) return;
      const groupDistance = Math.abs(candidate.groupIndex - seed.groupIndex);
      if (candidate.rank > bestRank || (candidate.rank === bestRank && groupDistance > bestGroupDistance)) {
        opponentIndex = index;
        bestRank = candidate.rank;
        bestGroupDistance = groupDistance;
      }
    });

    // This fallback is only needed when an unusual number of groups/qualifiers
    // leaves one same-group pairing mathematically unavoidable.
    if (opponentIndex < 0) opponentIndex = remaining.length - 1;
    const [opponent] = remaining.splice(opponentIndex, 1);
    ordered.push(seed.player);
    if (opponent) ordered.push(opponent.player);
  }

  return ordered;
}

function groupPlayers(players: string[], groupCount: number) {
  const count = Math.max(2, Math.min(groupCount, Math.max(2, Math.floor(players.length / 2))));
  const groups = Array.from({ length: count }, () => [] as string[]);
  players.forEach((player, index) => {
    const block = Math.floor(index / count);
    const position = index % count;
    const groupIndex = block % 2 === 0 ? position : count - 1 - position;
    groups[groupIndex].push(player);
  });
  return groups;
}

export function buildTwoStageCompetition(
  players: string[],
  options: TournamentOptions,
): TwoStageCompetition {
  const groupedPlayers = groupPlayers(players, options.groupCount);
  const groups = groupedPlayers.map((members, index) => {
    const rounds = buildRoundRobinRounds(
      members,
      options.roundRobinLegs,
      `g${index + 1}`,
    );
    return {
      id: `group-${index + 1}`,
      name: `Group ${String.fromCharCode(65 + index)}`,
      players: members,
      rounds,
      standings: calculateStandings(members, rounds, options),
    };
  });

  return {
    type: "two_stage",
    groups,
    qualifiersPerGroup: Math.max(1, options.qualifiersPerGroup),
    finalFormat: options.finalStageFormat,
    champion: null,
    generatedAt: new Date().toISOString(),
  };
}

export function updateTwoStageGroupMatch(
  competition: TwoStageCompetition,
  options: TournamentOptions,
  groupId: string,
  matchId: string,
  updater: (match: BracketMatch) => void,
) {
  const groups = competition.groups.map((group) => ({
    ...group,
    rounds: cloneRounds(group.rounds),
    standings: group.standings.map((row) => ({ ...row })),
  }));
  const group = groups.find((item) => item.id === groupId);
  if (!group) return competition;
  const match = group.rounds.flatMap((round) => round.matches).find((item) => item.id === matchId);
  if (!match) return competition;
  updater(match);
  group.standings = calculateStandings(group.players, group.rounds, options);
  return { ...competition, groups };
}

export function areTwoStageGroupsComplete(competition: TwoStageCompetition) {
  return competition.groups.length > 0 && competition.groups.every((group) =>
    allPlayableMatchesComplete(group.rounds),
  );
}

export function generateTwoStageFinals(
  competition: TwoStageCompetition,
  sourceTournament: Tournament,
) {
  if (!areTwoStageGroupsComplete(competition) || competition.finalBracket) return competition;
  // Adjacent entries become first-round opponents. Pair every group winner
  // with the weakest available qualifier from another group. With two groups
  // and two qualifiers this produces A1 vs B2 and B1 vs A2.
  const qualifiers = buildCrossoverQualifierOrder(competition);
  if (qualifiers.length < 2) return competition;

  const bracketSize = nextPowerOfTwo(qualifiers.length);
  const finalBracket = competition.finalFormat === "double"
    ? buildDoubleEliminationBracket({
        ...sourceTournament,
        format: "double",
        type: "single_stage",
        players: qualifiers,
        bracketSize,
        bracket: undefined,
        competition: undefined,
      })
    : buildSingleEliminationBracket(qualifiers, bracketSize);

  if (finalBracket.type === "double") {
    finalBracket.bracketResetEnabled = sourceTournament.options.bracketResetEnabled;
  }

  return { ...competition, finalBracket };
}

export function updateTwoStageFinalMatch(
  competition: TwoStageCompetition,
  matchId: string,
  updater: (match: BracketMatch) => void,
) {
  if (!competition.finalBracket) return competition;
  const finalBracket = competition.finalBracket.type === "double"
    ? updateDoubleMatch(competition.finalBracket, matchId, updater)
    : updateSingleEliminationMatch(competition.finalBracket, matchId, updater);
  return {
    ...competition,
    finalBracket,
    champion: finalBracket.champion,
  };
}
