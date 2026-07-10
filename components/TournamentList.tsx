"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTournaments,
  subscribeToTournamentChanges,
  Tournament,
  TournamentStatus,
} from "@/lib/tournaments";
import { TournamentCard } from "@/components/TournamentCard";

type Filter = "all" | TournamentStatus;

export function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const reload = useCallback(() => {
    setTournaments(getTournaments());
  }, []);

  useEffect(() => {
    reload();
    return subscribeToTournamentChanges(reload);
  }, [reload]);

  const filtered = useMemo(() => {
    return tournaments.filter((tournament) => {
      const matchesFilter = filter === "all" || tournament.status === filter;
      const search = query.trim().toLowerCase();
      const matchesQuery =
        search.length === 0 ||
        tournament.name.toLowerCase().includes(search) ||
        tournament.venue.toLowerCase().includes(search);

      return matchesFilter && matchesQuery;
    });
  }, [filter, query, tournaments]);

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "draft", "live", "completed"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${
                filter === value
                  ? "bg-cyan-400 text-slate-950"
                  : "bg-white/5 text-slate-400 ring-1 ring-white/10 hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="relative block lg:w-80">
          <span className="sr-only">Search tournaments</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or venue..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          />
        </label>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} onChange={reload} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-cyan-400/10 text-3xl ring-1 ring-cyan-400/20">
            🎱
          </div>
          <h2 className="mt-6 text-2xl font-black text-white">No tournaments found</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-400">
            Create your first tournament and it will appear here ready to manage.
          </p>
          <Link
            href="/tournaments/new"
            className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
          >
            Create Tournament
          </Link>
        </div>
      )}
    </section>
  );
}
