import type {
  BracketMatch,
  BracketRound,
  StandingRow,
  TournamentOptions,
} from "@/lib/tournaments";

export function makeCompetitionMatch(
  id: string,
  round: number,
  position: number,
  player1: string | null,
  player2: string | null,
): BracketMatch {
  const match: BracketMatch = {
    id,
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

  if (player1 && !player2) {
    match.completed = true;
    match.status = "finished";
    match.winner = player1;
  } else if (!player1 && player2) {
    match.completed = true;
    match.status = "finished";
    match.winner = player2;
  } else if (!player1 && !player2) {
    match.completed = true;
    match.status = "finished";
  }

  return match;
}

export function cloneMatch(match: BracketMatch): BracketMatch {
  return {
    ...match,
    scoreHistory: [...(match.scoreHistory ?? [])],
  };
}

export function cloneRounds(rounds: BracketRound[]) {
  return rounds.map((round) => ({
    ...round,
    matches: round.matches.map(cloneMatch),
  }));
}

export function buildRoundRobinRounds(
  players: string[],
  legs: 1 | 2 = 1,
  prefix = "rr",
): BracketRound[] {
  if (players.length < 2) return [];
  const rotation: Array<string | null> = [...players];
  if (rotation.length % 2 === 1) rotation.push(null);
  const count = rotation.length;
  const baseRounds: BracketRound[] = [];

  for (let roundIndex = 0; roundIndex < count - 1; roundIndex += 1) {
    const matches: BracketMatch[] = [];
    for (let position = 0; position < count / 2; position += 1) {
      let player1 = rotation[position];
      let player2 = rotation[count - 1 - position];
      if (roundIndex % 2 === 1 && position === 0) {
        [player1, player2] = [player2, player1];
      }
      matches.push(
        makeCompetitionMatch(
          `${prefix}-r${roundIndex + 1}-m${position}`,
          roundIndex + 1,
          position,
          player1,
          player2,
        ),
      );
    }
    baseRounds.push({
      round: roundIndex + 1,
      name: `Round ${roundIndex + 1}`,
      matches,
    });

    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() ?? null);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  if (legs === 1) return baseRounds;

  const secondLeg = baseRounds.map((round, index) => ({
    round: baseRounds.length + index + 1,
    name: `Round ${baseRounds.length + index + 1} · Return leg`,
    matches: round.matches.map((match, position) =>
      makeCompetitionMatch(
        `${prefix}-r${baseRounds.length + index + 1}-m${position}`,
        baseRounds.length + index + 1,
        position,
        match.player2,
        match.player1,
      ),
    ),
  }));

  return [...baseRounds, ...secondLeg];
}

function addMatchPoints(
  score1: number,
  score2: number,
  options: Pick<TournamentOptions, "pointsForWin" | "pointsForDraw" | "pointsForLoss">,
) {
  if (score1 === score2) return [options.pointsForDraw, options.pointsForDraw] as const;
  if (score1 > score2) return [options.pointsForWin, options.pointsForLoss] as const;
  return [options.pointsForLoss, options.pointsForWin] as const;
}

function rankHeadToHeadGroup(
  tiedRows: StandingRow[],
  rounds: BracketRound[],
  options: Pick<TournamentOptions, "pointsForWin" | "pointsForDraw" | "pointsForLoss">,
): StandingRow[] {
  if (tiedRows.length < 2) return tiedRows;

  const tiedPlayers = new Set(tiedRows.map((row) => row.player));
  const metrics = new Map(
    tiedRows.map((row) => [row.player, { points: 0, difference: 0 }]),
  );

  rounds.flatMap((round) => round.matches).forEach((match) => {
    if (!match.completed || !match.player1 || !match.player2) return;
    if (!tiedPlayers.has(match.player1) || !tiedPlayers.has(match.player2)) return;
    const score1 = match.score1 ?? 0;
    const score2 = match.score2 ?? 0;
    const [points1, points2] = addMatchPoints(score1, score2, options);
    const first = metrics.get(match.player1)!;
    const second = metrics.get(match.player2)!;
    first.points += points1;
    second.points += points2;
    first.difference += score1 - score2;
    second.difference += score2 - score1;
  });

  tiedRows.forEach((row) => {
    const metric = metrics.get(row.player)!;
    row.headToHeadPoints = metric.points;
    row.headToHeadDifference = metric.difference;
  });

  const ordered = [...tiedRows].sort((a, b) => {
    const aMetric = metrics.get(a.player)!;
    const bMetric = metrics.get(b.player)!;
    return bMetric.points - aMetric.points || bMetric.difference - aMetric.difference;
  });

  const result: StandingRow[] = [];
  for (let index = 0; index < ordered.length;) {
    const first = ordered[index];
    const firstMetric = metrics.get(first.player)!;
    let end = index + 1;
    while (end < ordered.length) {
      const candidate = metrics.get(ordered[end].player)!;
      if (
        candidate.points !== firstMetric.points ||
        candidate.difference !== firstMetric.difference
      ) break;
      end += 1;
    }
    const subgroup = ordered.slice(index, end);
    const rankedSubgroup =
      subgroup.length > 1 && subgroup.length < tiedRows.length
        ? rankHeadToHeadGroup(subgroup, rounds, options)
        : subgroup.sort(
            (a, b) =>
              b.frameDifference - a.frameDifference ||
              b.framesFor - a.framesFor ||
              b.won - a.won ||
              a.player.localeCompare(b.player),
          );
    result.push(...rankedSubgroup);
    index = end;
  }

  return result;
}

export function calculateStandings(
  players: string[],
  rounds: BracketRound[],
  options: Pick<TournamentOptions, "pointsForWin" | "pointsForDraw" | "pointsForLoss">,
  adjustments: Record<string, number> = {},
  includeBuchholz = false,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  players.forEach((player) => {
    rows.set(player, {
      rank: 0,
      player,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      framesFor: 0,
      framesAgainst: 0,
      frameDifference: 0,
      points: adjustments[player] ?? 0,
      bonusPoints: adjustments[player] ?? 0,
      buchholz: 0,
      headToHeadPoints: 0,
      headToHeadDifference: 0,
    });
  });

  const opponents = new Map<string, string[]>();
  players.forEach((player) => opponents.set(player, []));

  rounds.flatMap((round) => round.matches).forEach((match) => {
    if (!match.player1 || !match.player2 || !match.completed) return;
    const row1 = rows.get(match.player1);
    const row2 = rows.get(match.player2);
    if (!row1 || !row2) return;

    const score1 = match.score1 ?? 0;
    const score2 = match.score2 ?? 0;
    row1.played += 1;
    row2.played += 1;
    row1.framesFor += score1;
    row1.framesAgainst += score2;
    row2.framesFor += score2;
    row2.framesAgainst += score1;
    opponents.get(match.player1)?.push(match.player2);
    opponents.get(match.player2)?.push(match.player1);

    if (score1 === score2) {
      row1.drawn += 1;
      row2.drawn += 1;
      row1.points += options.pointsForDraw;
      row2.points += options.pointsForDraw;
    } else if (score1 > score2) {
      row1.won += 1;
      row2.lost += 1;
      row1.points += options.pointsForWin;
      row2.points += options.pointsForLoss;
    } else {
      row2.won += 1;
      row1.lost += 1;
      row2.points += options.pointsForWin;
      row1.points += options.pointsForLoss;
    }
  });

  rows.forEach((row) => {
    row.frameDifference = row.framesFor - row.framesAgainst;
  });

  let sorted: StandingRow[];
  if (includeBuchholz) {
    rows.forEach((row) => {
      row.buchholz = (opponents.get(row.player) ?? []).reduce(
        (total, opponent) => total + (rows.get(opponent)?.points ?? 0),
        0,
      );
    });
    sorted = Array.from(rows.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if ((b.buchholz ?? 0) !== (a.buchholz ?? 0)) return (b.buchholz ?? 0) - (a.buchholz ?? 0);
      if (b.frameDifference !== a.frameDifference) return b.frameDifference - a.frameDifference;
      if (b.framesFor !== a.framesFor) return b.framesFor - a.framesFor;
      if (b.won !== a.won) return b.won - a.won;
      return a.player.localeCompare(b.player);
    });
  } else {
    const pointGroups = new Map<number, StandingRow[]>();
    rows.forEach((row) => {
      pointGroups.set(row.points, [...(pointGroups.get(row.points) ?? []), row]);
    });
    sorted = [...pointGroups.entries()]
      .sort(([a], [b]) => b - a)
      .flatMap(([, tiedRows]) => rankHeadToHeadGroup(tiedRows, rounds, options));
  }

  let previous: StandingRow | undefined;
  let previousRank = 0;
  return sorted.map((row, index) => {
    const tiedWithPrevious = Boolean(
      previous &&
      row.points === previous.points &&
      (row.buchholz ?? 0) === (previous.buchholz ?? 0) &&
      (row.headToHeadPoints ?? 0) === (previous.headToHeadPoints ?? 0) &&
      (row.headToHeadDifference ?? 0) === (previous.headToHeadDifference ?? 0) &&
      row.frameDifference === previous.frameDifference &&
      row.framesFor === previous.framesFor &&
      row.won === previous.won,
    );
    const rank = tiedWithPrevious ? previousRank : index + 1;
    previous = row;
    previousRank = rank;
    return { ...row, rank };
  });
}

export function allPlayableMatchesComplete(rounds: BracketRound[]) {
  const matches = rounds
    .flatMap((round) => round.matches)
    .filter((match) => match.player1 && match.player2);
  return matches.length > 0 && matches.every((match) => match.completed);
}

export function currentRoundComplete(rounds: BracketRound[]) {
  const current = rounds.at(-1);
  if (!current) return false;
  const matches = current.matches.filter((match) => match.player1 && match.player2);
  return matches.length > 0 && matches.every((match) => match.completed);
}
