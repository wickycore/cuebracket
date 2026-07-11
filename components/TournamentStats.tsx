"use client";

import { useMemo } from "react";
import { getAllMatches, Tournament } from "@/lib/tournaments";

export function getTournamentStats(tournament: Tournament) {
  const matches = getAllMatches(tournament).filter((match) => match.player1 || match.player2);
  const playable = matches.filter((match) => match.player1 && match.player2);
  const completed = playable.filter((match) => match.completed);
  const active = playable.filter((match) => match.status === "live" && !match.completed);
  const remaining = playable.length - completed.length;
  const durations = completed
    .map((match) => {
      if (!match.startedAt || !match.endedAt) return 0;
      return new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime();
    })
    .filter((duration) => duration > 0);
  const averageDuration = durations.length
    ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
    : 0;
  const progress = playable.length ? Math.round((completed.length / playable.length) * 100) : 0;
  const currentRound =
    tournament.bracket?.rounds.find((round) => round.matches.some((match) => match.player1 && match.player2 && !match.completed))?.name ??
    (tournament.bracket?.champion ? "Complete" : "Not started");

  return {
    totalPlayers: tournament.players.length,
    totalMatches: playable.length,
    completedMatches: completed.length,
    activeMatches: active.length,
    remainingMatches: remaining,
    averageDuration,
    progress,
    currentRound,
  };
}

export function TournamentStats({ tournament }: { tournament: Tournament }) {
  const stats = useMemo(() => getTournamentStats(tournament), [tournament]);
  const minutes = stats.averageDuration ? Math.round(stats.averageDuration / 60000) : 0;

  const cards = [
    ["Players", stats.totalPlayers],
    ["Total matches", stats.totalMatches],
    ["Completed", stats.completedMatches],
    ["Remaining", stats.remainingMatches],
    ["Current round", stats.currentRound],
    ["Avg. match", minutes ? `${minutes} min` : "—"],
  ];

  return (
    <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">Tournament dashboard</p>
          <h2 className="mt-2 text-2xl font-black">Live progress</h2>
        </div>
        <p className="text-3xl font-black text-cyan-300">{stats.progress}%</p>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-950/80 ring-1 ring-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 transition-all duration-500"
          style={{ width: `${stats.progress}%` }}
        />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
