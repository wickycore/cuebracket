"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  getTournamentEventCounts,
  getTournaments,
  subscribeToTournamentChanges,
  Tournament,
  TournamentStatus,
} from "@/lib/tournaments";
import { TournamentCard } from "@/components/TournamentCard";

type Filter = "all" | TournamentStatus;
type Sort = "updated" | "newest" | "name" | "progress";

interface TournamentListProps {
  compact?: boolean;
  limit?: number;
  showControls?: boolean;
}

function progressOf(tournament: Tournament) {
  const counts = getTournamentEventCounts(tournament);
  return counts.total ? counts.completed / counts.total : 0;
}

export function TournamentList({
  compact = false,
  limit,
  showControls = true,
}: TournamentListProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("updated");

  const reload = useCallback(() => {
    setTournaments(getTournaments());
  }, []);

  useEffect(() => {
    reload();
    return subscribeToTournamentChanges(reload);
  }, [reload]);

  const counts = useMemo(
    () => ({
      all: tournaments.length,
      draft: tournaments.filter((tournament) => tournament.status === "draft").length,
      live: tournaments.filter((tournament) => tournament.status === "live").length,
      completed: tournaments.filter((tournament) => tournament.status === "completed").length,
    }),
    [tournaments],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const result = tournaments.filter((tournament) => {
      const matchesFilter = filter === "all" || tournament.status === filter;
      const matchesQuery =
        !search ||
        tournament.name.toLowerCase().includes(search) ||
        tournament.venue.toLowerCase().includes(search) ||
        tournament.players.some((player) => player.toLowerCase().includes(search));

      return matchesFilter && matchesQuery;
    });

    result.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "progress") return progressOf(b) - progressOf(a);
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return typeof limit === "number" ? result.slice(0, limit) : result;
  }, [filter, limit, query, sort, tournaments]);

  const hasAnyTournaments = tournaments.length > 0;

  return (
    <section>
      {showControls ? (
        <div className="mb-7 space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["all", "draft", "live", "completed"] as Filter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black capitalize transition ${
                    filter === value
                      ? "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/10"
                      : "bg-white/[0.04] text-slate-400 ring-1 ring-white/10 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {value}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[0.65rem] ${
                      filter === value ? "bg-slate-950/15" : "bg-slate-950/45 text-slate-500"
                    }`}
                  >
                    {counts[value]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block sm:min-w-72">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">⌕</span>
                <span className="sr-only">Search tournaments</span>
                <input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                  placeholder="Search event, venue or player..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10"
                />
              </label>

              <label>
                <span className="sr-only">Sort tournaments</span>
                <select
                  value={sort}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(event.target.value as Sort)}
                  className="h-full min-h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-bold text-slate-300 outline-none focus:border-cyan-400/40 sm:w-auto"
                >
                  <option value="updated">Recently updated</option>
                  <option value="newest">Newest created</option>
                  <option value="name">Name A–Z</option>
                  <option value="progress">Most progress</option>
                </select>
              </label>
            </div>
          </div>

          {query || filter !== "all" ? (
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs text-slate-500">
              <span>
                Showing <strong className="text-slate-300">{filtered.length}</strong> matching event{filtered.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
                className="font-black text-cyan-300 hover:text-cyan-200"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <>
          <div className={`grid gap-5 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
            {filtered.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                onChange={reload}
                compact={compact}
              />
            ))}
          </div>

          {typeof limit === "number" && tournaments.length > limit ? (
            <div className="mt-6 text-center">
              <Link
                href="/tournaments"
                className="inline-flex rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-black text-slate-300 transition hover:border-cyan-400/25 hover:text-cyan-200"
              >
                View all {tournaments.length} tournaments →
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <div className="cb-card rounded-[2rem] border-dashed px-6 py-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-cyan-400/10 text-2xl font-black text-cyan-200 ring-1 ring-cyan-400/20">
            8
          </div>
          <h2 className="mt-6 text-2xl font-black text-white">
            {hasAnyTournaments ? "No tournaments match" : "Your first tournament starts here"}
          </h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-slate-400">
            {hasAnyTournaments
              ? "Try another search or clear the active filters."
              : "Create a field, add the players and CueBracket will build the right bracket, schedule, heats or standings engine for you."}
          </p>
          {hasAnyTournaments ? (
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className="mt-6 rounded-xl border border-white/10 px-5 py-3 font-black text-slate-300 hover:bg-white/5"
            >
              Reset filters
            </button>
          ) : (
            <Link
              href="/tournaments/new"
              className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
            >
              Create tournament
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
