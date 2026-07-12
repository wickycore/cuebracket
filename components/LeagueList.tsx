"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getLeagues, League, LeagueStatus, subscribeToLeagueChanges } from "@/lib/leagues";
import { LeagueCard } from "@/components/LeagueCard";

type Filter = "all" | LeagueStatus;

export function LeagueList({ compact = false }: { compact?: boolean }) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const reload = useCallback(() => setLeagues(getLeagues()), []);

  useEffect(() => {
    reload();
    return subscribeToLeagueChanges(reload);
  }, [reload]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return leagues
      .filter((league) => filter === "all" || league.status === filter)
      .filter(
        (league) =>
          !search ||
          league.name.toLowerCase().includes(search) ||
          league.season.toLowerCase().includes(search) ||
          league.venue.toLowerCase().includes(search),
      )
      .slice(0, compact ? 3 : undefined);
  }, [compact, filter, leagues, query]);

  return (
    <div>
      {!compact ? (
        <div className="mb-6 grid gap-3 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-wrap gap-2">
            {(["all", "draft", "live", "completed"] as Filter[]).map((value) => (
              <button
                key={value}
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
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search league, season or venue..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          />
        </div>
      ) : null}

      {filtered.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {filtered.map((league) => (
            <LeagueCard key={league.id} league={league} onChange={reload} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/40 px-6 py-12 text-center">
          <h3 className="text-xl font-black text-white">No leagues found</h3>
          <p className="mt-2 text-slate-400">Create a league and add players to begin generating fixtures.</p>
          <Link href="/leagues/new" className="mt-5 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">
            Create League
          </Link>
        </div>
      )}
    </div>
  );
}
