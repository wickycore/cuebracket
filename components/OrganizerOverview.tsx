"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAllMatches,
  getTournaments,
  subscribeToTournamentChanges,
  Tournament,
} from "@/lib/tournaments";

export function OrganizerOverview() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    const load = () => setTournaments(getTournaments());
    load();
    return subscribeToTournamentChanges(load);
  }, []);

  const stats = useMemo(() => {
    const matches = tournaments.flatMap(getAllMatches);
    const completedMatches = matches.filter((match) => match.completed);
    const liveMatches = matches.filter((match) => match.status === "live");
    const players = new Set(
      tournaments.flatMap((tournament) =>
        tournament.players
          .map((name) => name.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const totalFrames = completedMatches.reduce(
      (total, match) => total + (match.score1 ?? 0) + (match.score2 ?? 0),
      0,
    );
    const completionRate = matches.length
      ? Math.round((completedMatches.length / matches.length) * 100)
      : 0;
    const biggestField = tournaments.reduce(
      (largest, tournament) => Math.max(largest, tournament.players.length),
      0,
    );

    return {
      tournaments: tournaments.length,
      liveEvents: tournaments.filter((tournament) => tournament.status === "live").length,
      liveMatches: liveMatches.length,
      players: players.size,
      completedMatches: completedMatches.length,
      totalFrames,
      completionRate,
      champions: tournaments.filter((tournament) => tournament.bracket?.champion).length,
      biggestField,
    };
  }, [tournaments]);

  const cards = [
    {
      label: "Events",
      value: stats.tournaments,
      helper: `${stats.liveEvents} live now`,
      symbol: "◎",
      tone: "text-cyan-200 bg-cyan-400/10 ring-cyan-400/20",
    },
    {
      label: "Players hosted",
      value: stats.players,
      helper: `Largest field ${stats.biggestField}`,
      symbol: "8",
      tone: "text-blue-200 bg-blue-400/10 ring-blue-400/20",
    },
    {
      label: "Matches scored",
      value: stats.completedMatches,
      helper: `${stats.liveMatches} currently playing`,
      symbol: "✓",
      tone: "text-emerald-200 bg-emerald-400/10 ring-emerald-400/20",
    },
    {
      label: "Frames recorded",
      value: stats.totalFrames,
      helper: "Across completed races",
      symbol: "#",
      tone: "text-violet-200 bg-violet-400/10 ring-violet-400/20",
    },
    {
      label: "Completion",
      value: `${stats.completionRate}%`,
      helper: "Of generated matches",
      symbol: "↗",
      tone: "text-amber-200 bg-amber-400/10 ring-amber-400/20",
    },
    {
      label: "Champions",
      value: stats.champions,
      helper: "Titles awarded",
      symbol: "♛",
      tone: "text-yellow-200 bg-yellow-400/10 ring-yellow-400/20",
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <article
          key={card.label}
          className="cb-card cb-card-hover group relative overflow-hidden rounded-3xl p-5"
        >
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/[0.035] blur-2xl transition group-hover:bg-cyan-400/[0.08]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-white">{card.value}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{card.helper}</p>
            </div>
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ring-1 ${card.tone}`}
            >
              {card.symbol}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}
