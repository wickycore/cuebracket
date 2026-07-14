import type {
  FreeForAllCompetition,
  FreeForAllHeat,
  FreeForAllTieRule,
  StandingRow,
  TournamentOptions,
} from "@/lib/tournaments";

function pairKey(a: string, b: string) {
  return a.localeCompare(b) < 0 ? `${a}::${b}` : `${b}::${a}`;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number) {
  const result = [...items];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function heatSizes(playerCount: number, requestedHeatSize: number) {
  const heatCount = Math.max(1, Math.ceil(playerCount / requestedHeatSize));
  const baseSize = Math.floor(playerCount / heatCount);
  const remainder = playerCount % heatCount;
  return Array.from({ length: heatCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function partition<T>(items: T[], sizes: number[]) {
  const groups: T[][] = [];
  let cursor = 0;
  sizes.forEach((size) => {
    groups.push(items.slice(cursor, cursor + size));
    cursor += size;
  });
  return groups;
}

function scheduleCost(groups: string[][], pairCounts: Map<string, number>) {
  let cost = 0;
  groups.forEach((group) => {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        const previousMeetings = pairCounts.get(pairKey(group[left], group[right])) ?? 0;
        // Repeated meetings are progressively expensive, so the scheduler strongly
        // prefers giving every player new opponents before creating rematches.
        cost += previousMeetings === 0 ? 0 : Math.pow(previousMeetings + 1, 4) * 100;
      }
    }
  });
  return cost;
}

function updatePairCounts(groups: string[][], pairCounts: Map<string, number>) {
  groups.forEach((group) => {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        const key = pairKey(group[left], group[right]);
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  });
}

function balancedRoundGroups(
  players: string[],
  sizes: number[],
  pairCounts: Map<string, number>,
  round: number,
) {
  // A deterministic search keeps saved tournaments reproducible while still
  // exploring enough candidate partitions to avoid repetitive heats.
  const attempts = players.length <= 16 ? 1800 : players.length <= 32 ? 900 : 350;
  let bestGroups = partition(shuffle(players, round * 104729), sizes);
  let bestCost = scheduleCost(bestGroups, pairCounts);

  for (let attempt = 1; attempt < attempts && bestCost > 0; attempt += 1) {
    const candidate = partition(
      shuffle(players, round * 104729 + attempt * 8191),
      sizes,
    );
    const cost = scheduleCost(candidate, pairCounts);
    if (cost < bestCost) {
      bestGroups = candidate;
      bestCost = cost;
    }
  }

  return bestGroups;
}

function makeHeats(players: string[], rounds: number, heatSize: number) {
  const heats: FreeForAllHeat[] = [];
  const pairCounts = new Map<string, number>();
  const sizes = heatSizes(players.length, heatSize);

  for (let round = 1; round <= rounds; round += 1) {
    const groups = balancedRoundGroups(players, sizes, pairCounts, round);
    updatePairCounts(groups, pairCounts);
    groups.forEach((group, position) => {
      heats.push({
        id: `ffa-r${round}-h${position}`,
        round,
        position,
        name: `Round ${round} · Heat ${position + 1}`,
        entries: group.map((player) => ({
          player,
          score: null,
          placement: null,
          points: 0,
        })),
        completed: false,
      });
    });
  }
  return heats;
}

function formatPlacementPoints(value: number) {
  return Math.round(value * 100) / 100;
}

function assignPlacements(
  heat: FreeForAllHeat,
  scores: Record<string, number>,
  tieRule: FreeForAllTieRule,
) {
  const ranked = heat.entries
    .map((entry) => ({ ...entry, score: scores[entry.player] ?? 0 }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.player.localeCompare(b.player));

  for (let cursor = 0; cursor < ranked.length;) {
    const score = ranked[cursor].score ?? 0;
    let end = cursor + 1;
    while (end < ranked.length && (ranked[end].score ?? 0) === score) end += 1;
    const tiedCount = end - cursor;

    if (tiedCount > 1 && tieRule === "tiebreak_required") {
      const tiedPlayers = ranked.slice(cursor, end).map((entry) => entry.player).join(", ");
      throw new Error(`A tiebreak score is required between ${tiedPlayers}. Tied heat scores cannot be saved under the selected rule.`);
    }

    const placement = cursor + 1;
    const fullPoints = Math.max(1, ranked.length - placement + 1);
    let awardedPoints = fullPoints;
    if (tiedCount > 1 && tieRule === "split_points") {
      let occupiedPoints = 0;
      for (let occupied = cursor; occupied < end; occupied += 1) {
        occupiedPoints += Math.max(1, ranked.length - occupied);
      }
      awardedPoints = occupiedPoints / tiedCount;
    }

    for (let index = cursor; index < end; index += 1) {
      ranked[index].placement = placement;
      ranked[index].points = formatPlacementPoints(awardedPoints);
    }
    cursor = end;
  }

  return ranked;
}

function calculateFreeForAllStandings(players: string[], heats: FreeForAllHeat[]): StandingRow[] {
  const placementTotals = new Map<string, number>();
  const map = new Map<string, StandingRow>();
  players.forEach((player) => {
    placementTotals.set(player, 0);
    map.set(player, {
      rank: 0,
      player,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      framesFor: 0,
      framesAgainst: 0,
      frameDifference: 0,
      points: 0,
      heatWins: 0,
      podiums: 0,
      averagePlacement: 0,
      rawScore: 0,
    });
  });

  heats.filter((heat) => heat.completed).forEach((heat) => {
    heat.entries.forEach((entry) => {
      const row = map.get(entry.player);
      if (!row || !entry.placement) return;
      const score = entry.score ?? 0;
      row.played += 1;
      row.framesFor += score;
      row.rawScore = (row.rawScore ?? 0) + score;
      row.points += entry.points;
      placementTotals.set(entry.player, (placementTotals.get(entry.player) ?? 0) + entry.placement);
      if (entry.placement === 1) {
        row.won += 1;
        row.heatWins = (row.heatWins ?? 0) + 1;
      } else {
        row.lost += 1;
      }
      if (entry.placement <= 3) row.podiums = (row.podiums ?? 0) + 1;
    });
  });

  map.forEach((row) => {
    row.points = formatPlacementPoints(row.points);
    row.averagePlacement = row.played
      ? Math.round(((placementTotals.get(row.player) ?? 0) / row.played) * 100) / 100
      : 0;
  });

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if ((b.heatWins ?? 0) !== (a.heatWins ?? 0)) return (b.heatWins ?? 0) - (a.heatWins ?? 0);
    if ((b.podiums ?? 0) !== (a.podiums ?? 0)) return (b.podiums ?? 0) - (a.podiums ?? 0);
    const aAverage = a.played ? (a.averagePlacement ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const bAverage = b.played ? (b.averagePlacement ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    if (aAverage !== bAverage) return aAverage - bAverage;
    if ((b.rawScore ?? 0) !== (a.rawScore ?? 0)) return (b.rawScore ?? 0) - (a.rawScore ?? 0);
    return a.player.localeCompare(b.player);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildFreeForAllCompetition(
  players: string[],
  options: TournamentOptions,
): FreeForAllCompetition {
  const rounds = Math.max(1, options.freeForAllRounds);
  const heatSize = Math.max(2, Math.min(players.length, options.freeForAllHeatSize));
  const heats = makeHeats(players, rounds, heatSize);
  return {
    type: "free_for_all",
    heats,
    standings: calculateFreeForAllStandings(players, heats),
    rounds,
    heatSize,
    tieRule: options.freeForAllTieRule ?? "split_points",
    champion: null,
    generatedAt: new Date().toISOString(),
  };
}

export function updateFreeForAllHeat(
  competition: FreeForAllCompetition,
  players: string[],
  heatId: string,
  scores: Record<string, number>,
) {
  const heats = competition.heats.map((heat) => ({
    ...heat,
    entries: heat.entries.map((entry) => ({ ...entry })),
  }));
  const heat = heats.find((item) => item.id === heatId);
  if (!heat) return competition;

  const ranked = assignPlacements(heat, scores, competition.tieRule ?? "split_points");
  const byPlayer = new Map(ranked.map((entry) => [entry.player, entry]));
  heat.entries = heat.entries.map((entry) => byPlayer.get(entry.player) ?? entry);
  heat.completed = true;
  const standings = calculateFreeForAllStandings(players, heats);
  const allComplete = heats.length > 0 && heats.every((item) => item.completed);
  return {
    ...competition,
    heats,
    standings,
    champion: allComplete ? standings[0]?.player ?? null : null,
  };
}

export function clearFreeForAllHeat(
  competition: FreeForAllCompetition,
  players: string[],
  heatId: string,
) {
  const heats = competition.heats.map((heat) =>
    heat.id === heatId
      ? {
          ...heat,
          completed: false,
          entries: heat.entries.map((entry) => ({
            ...entry,
            score: null,
            placement: null,
            points: 0,
          })),
        }
      : { ...heat, entries: heat.entries.map((entry) => ({ ...entry })) },
  );
  return {
    ...competition,
    heats,
    standings: calculateFreeForAllStandings(players, heats),
    champion: null,
  };
}
