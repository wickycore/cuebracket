"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getAllMatches,
  getTournaments,
  subscribeToTournamentChanges,
  Tournament,
} from "@/lib/tournaments";

export function ChampionsGallery() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    const load = () => setTournaments(getTournaments());
    load();
    return subscribeToTournamentChanges(load);
  }, []);

  const champions = useMemo(
    () =>
      tournaments
        .filter((tournament) => tournament.bracket?.champion)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tournaments],
  );

  if (!champions.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-12 text-center">
        <div className="text-5xl">🏆</div>
        <h2 className="mt-4 text-2xl font-black text-white">
          No champions yet
        </h2>
        <p className="mt-2 text-slate-400">
          Complete a tournament and the winner will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {champions.map((tournament) => {
        const matches = getAllMatches(tournament);
        const completed = matches.filter((match) => match.completed).length;
        const champion = tournament.bracket?.champion ?? "Champion";

        return (
          <article
            key={tournament.id}
            className="group relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.10] via-slate-900/90 to-cyan-400/[0.06] p-6 shadow-2xl shadow-black/20"
          >
            <div className="pointer-events-none absolute -right-8 -top-10 text-[9rem] leading-none opacity-[0.07] transition-transform duration-300 group-hover:scale-110">
              🏆
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                  Champion
                </span>

                <span className="rounded-full bg-slate-950/60 px-3 py-1 text-xs font-bold text-slate-400">
                  {tournament.type === "double" ? "Double Elim" : "Single Elim"}
                </span>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-3xl shadow-lg shadow-amber-950/20">
                  🏆
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-3xl font-black text-white">
                    {champion}
                  </h2>
                  <p className="mt-1 truncate font-bold text-slate-300">
                    {tournament.name}
                  </p>
                </div>
              </div>

              <p className="mt-4 truncate text-sm text-slate-500">
                {tournament.venue || "Venue not set"}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Players
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {tournament.players.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Results
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {completed}
                  </p>
                </div>
              </div>

              <Link
                href={`/live/${tournament.id}`}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200"
              >
                View Final Bracket
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
