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

function groupQualificationState(
  group: TwoStageCompetition["groups"][number],
  qualifiersPerGroup: number,
) {
  if (!allPlayableMatchesComplete(group.rounds)) {
    return {
      ...group,
      qualificationTiePlayers: [],
      qualificationTieSlots: 0,
      selectedTieQualifiers: [],
    };
  }

  const cutoff = group.standings[qualifiersPerGroup - 1];
  if (!cutoff) return group;
  const tiedAtCutoff = group.standings
    .filter((row) => row.rank === cutoff.rank)
    .map((row) => row.player);
  const guaranteed = group.standings.filter((row) => row.rank < cutoff.rank).length;
  const availableSlots = Math.max(0, qualifiersPerGroup - guaranteed);
  if (tiedAtCutoff.length <= availableSlots) {
    return {
      ...group,
      qualificationTiePlayers: [],
      qualificationTieSlots: 0,
      selectedTieQualifiers: [],
    };
  }

  return {
    ...group,
    qualificationTiePlayers: tiedAtCutoff,
    qualificationTieSlots: availableSlots,
    selectedTieQualifiers: (group.selectedTieQualifiers ?? []).filter((player) =>
      tiedAtCutoff.includes(player),
    ).slice(0, availableSlots),
  };
}

function qualifiersForGroup(
  group: TwoStageCompetition["groups"][number],
  qualifiersPerGroup: number,
) {
  const tiePlayers = group.qualificationTiePlayers ?? [];
  if (!tiePlayers.length) return group.standings.slice(0, qualifiersPerGroup).map((row) => row.player);
  const tieRank = group.standings.find((row) => tiePlayers.includes(row.player))?.rank ?? Number.MAX_SAFE_INTEGER;
  return [
    ...group.standings.filter((row) => row.rank < tieRank).map((row) => row.player),
    ...(group.selectedTieQualifiers ?? []),
  ].slice(0, qualifiersPerGroup);
}

function buildCrossoverQualifierOrder(competition: TwoStageCompetition) {
  const remaining: QualifiedPlayer[] = [];
  competition.groups.forEach((group, groupIndex) => {
    const groupQualifiers = qualifiersForGroup(group, competition.qualifiersPerGroup);
    for (let rank = 0; rank < groupQualifiers.length; rank += 1) {
      const player = groupQualifiers[rank];
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
  const groupIndex = groups.findIndex((item) => item.id === groupId);
  groups[groupIndex] = groupQualificationState(group, competition.qualifiersPerGroup);
  return { ...competition, groups };
}

export function selectTwoStageTieQualifier(
  competition: TwoStageCompetition,
  groupId: string,
  player: string,
) {
  const groups = competition.groups.map((group) => {
    if (group.id !== groupId || !(group.qualificationTiePlayers ?? []).includes(player)) return group;
    const slots = group.qualificationTieSlots ?? 0;
    const current = group.selectedTieQualifiers ?? [];
    const selected = current.includes(player)
      ? current.filter((item) => item !== player)
      : [...current, player].slice(-slots);
    return { ...group, selectedTieQualifiers: selected };
  });
  return { ...competition, groups };
}

export function areTwoStageQualificationTiesResolved(competition: TwoStageCompetition) {
  return competition.groups.every((group) => {
    const tiePlayers = group.qualificationTiePlayers ?? [];
    return !tiePlayers.length || (group.selectedTieQualifiers ?? []).length === (group.qualificationTieSlots ?? 0);
  });
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
  if (
    !areTwoStageGroupsComplete(competition) ||
    !areTwoStageQualificationTiesResolved(competition) ||
    competition.finalBracket
  ) return competition;
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
