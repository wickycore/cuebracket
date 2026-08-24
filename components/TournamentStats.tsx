"use client";

import { useMemo } from "react";
import {
  getAllMatches,
  getBracketRounds,
  getCompetitionRounds,
  getTournamentChampion,
  getTournamentEventCounts,
  type Tournament,
} from "@/lib/tournaments";

export function getTournamentStats(tournament: Tournament) {
  const matches = getAllMatches(tournament).filter((match) => match.player1 || match.player2);
  const playable = matches.filter((match) => match.player1 && match.player2);
  const completedMatches = playable.filter((match) => match.completed);
  const active = playable.filter((match) => match.status === "live" && !match.completed);
  const eventCounts = getTournamentEventCounts(tournament);
  const durations = completedMatches
    .map((match) => {
      if (!match.startedAt || !match.endedAt) return 0;
      return new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime();
    })
    // Ignore timestamps created at result-entry time. Real match durations require
    // an explicit earlier start and should comfortably exceed this threshold.
    .filter((duration) => duration >= 30_000);
  const averageDuration = durations.length
    ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
    : 0;
  const progress = eventCounts.total ? Math.round((eventCounts.completed / eventCounts.total) * 100) : 0;

  let currentRound = "Not started";
  const champion = getTournamentChampion(tournament);
  if (champion) {
    currentRound = "Complete";
  } else if (tournament.competition?.type === "free_for_all") {
    const heat = tournament.competition.heats.find((item) => !item.completed);
    currentRound = heat ? `Heat round ${heat.round}` : "Complete";
  } else if (tournament.competition?.type === "two_stage" && !tournament.competition.finalBracket) {
    currentRound = "Group stage";
  } else {
    const rounds = tournament.bracket
      ? getBracketRounds(tournament.bracket)
      : getCompetitionRounds(tournament.competition);
    currentRound = rounds.find((round) =>
      round.matches.some((match) => match.player1 && match.player2 && !match.completed),
    )?.name ?? (eventCounts.total ? "Awaiting next stage" : "Not started");
  }

  return {
    totalPlayers: tournament.players.length,
    totalMatches: eventCounts.total,
    completedMatches: eventCounts.completed,
    byes: eventCounts.byes,
    fixtures: eventCounts.fixtures,
    activeMatches: active.length,
    remainingMatches: Math.max(0, eventCounts.total - eventCounts.completed),
    averageDuration,
    progress,
    currentRound,
  };
}

export function TournamentStats({ tournament }: { tournament: Tournament }) {
  const stats = useMemo(() => getTournamentStats(tournament), [tournament]);
  const minutes = stats.averageDuration ? Math.max(1, Math.round(stats.averageDuration / 60000)) : 0;
  const isFreeForAll = tournament.competition?.type === "free_for_all";

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">Live progress</p>
          <h2 className="mt-1 text-xl font-black">{stats.completedMatches} of {stats.totalMatches} {isFreeForAll ? "heats" : "matches"} completed</h2>
        </div>
        <p className="text-2xl font-black text-cyan-300">{stats.progress}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-950/80 ring-1 ring-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 transition-all duration-500" style={{ width: `${stats.progress}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
        <span><strong className="text-white">{stats.activeMatches}</strong> live</span>
        <span><strong className="text-white">{stats.remainingMatches}</strong> remaining</span>
        <span><strong className="text-white">{stats.currentRound}</strong> stage</span>
        {!isFreeForAll && stats.byes > 0 ? <span><strong className="text-white">{stats.byes}</strong> BYEs</span> : null}
        {minutes ? <span><strong className="text-white">{minutes} min</strong> average</span> : null}
      </div>
    </section>
  );
}
