"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllMatches, getTournaments, subscribeToTournamentChanges, Tournament } from "@/lib/tournaments";

export function OrganizerOverview() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    const load = () => setTournaments(getTournaments());
    load();
    return subscribeToTournamentChanges(load);
  }, []);

  const stats = useMemo(() => {
    const matches = tournaments.flatMap(getAllMatches);
    const players = new Set(
      tournaments.flatMap((tournament) => tournament.players.map((name) => name.trim().toLowerCase())),
    );
    return {
      tournaments: tournaments.length,
      live: tournaments.filter((tournament) => tournament.status === "live").length,
      players: players.size,
      matches: matches.filter((match) => match.completed).length,
      champions: tournaments.filter((tournament) => tournament.bracket?.champion).length,
    };
  }, [tournaments]);

  const cards = [
    { label: "Tournaments", value: stats.tournaments, icon: "🏆", helper: "All events" },
    { label: "Live now", value: stats.live, icon: "🔴", helper: "Ongoing events" },
    { label: "Players", value: stats.players, icon: "🎱", helper: "Unique names" },
    { label: "Results", value: stats.matches, icon: "✓", helper: "Matches completed" },
    { label: "Champions", value: stats.champions, icon: "👑", helper: "Titles awarded" },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <article
          key={card.label}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.025] p-5 shadow-2xl shadow-black/10"
        >
          <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-cyan-400/5 blur-2xl transition group-hover:bg-cyan-400/15" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.17em] text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-black text-white">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
            </div>
            <span className="text-2xl">{card.icon}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
