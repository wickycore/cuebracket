"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getAllMatches,
  getFormatLabel,
  getTournamentChampion,
  getTournaments,
  subscribeToTournamentChanges,
  Tournament,
} from "@/lib/tournaments";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Completed event";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

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
        .filter((tournament) => getTournamentChampion(tournament))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tournaments],
  );

  const summary = useMemo(() => {
    const titleCount = new Map<string, { name: string; titles: number }>();
    let completedMatches = 0;
    let players = 0;

    champions.forEach((tournament) => {
      const champion = getTournamentChampion(tournament);
      if (champion) {
        const key = champion.trim().toLowerCase();
        const current = titleCount.get(key);
        titleCount.set(key, {
          name: champion,
          titles: (current?.titles ?? 0) + 1,
        });
      }
      completedMatches += getAllMatches(tournament).filter((match) => match.completed).length;
      players += tournament.players.length;
    });

    const mostDecorated = [...titleCount.values()].sort((a, b) => b.titles - a.titles)[0];

    return {
      events: champions.length,
      uniqueChampions: titleCount.size,
      completedMatches,
      players,
      mostDecorated,
    };
  }, [champions]);

  if (!champions.length) {
    return (
      <div className="cb-card rounded-[2rem] border-dashed p-10 text-center sm:p-16">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-amber-300/10 text-4xl text-amber-200 ring-1 ring-amber-300/20">
          ♛
        </div>
        <h2 className="mt-6 text-3xl font-black text-white">The wall is waiting for its first name.</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-400">
          Complete a tournament and CueBracket will add the champion, event details and final bracket here automatically.
        </p>
        <Link
          href="/tournaments/new"
          className="mt-7 inline-flex rounded-2xl bg-amber-300 px-6 py-3 font-black text-slate-950 hover:bg-amber-200"
        >
          Create the first event
        </Link>
      </div>
    );
  }

  return (
    <div>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Titles", summary.events],
          ["Champions", summary.uniqueChampions],
          ["Final players", summary.players],
          ["Matches", summary.completedMatches],
          ["Most decorated", summary.mostDecorated ? `${summary.mostDecorated.name} · ${summary.mostDecorated.titles}` : "—"],
        ].map(([label, value]) => (
          <article key={String(label)} className="cb-card rounded-3xl p-5">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
            <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {champions.map((tournament, index) => {
          const matches = getAllMatches(tournament);
          const completedMatches = matches.filter((match) => match.completed);
          const completed = completedMatches.length;
          const finalMatch = completedMatches.at(-1);
          const champion = getTournamentChampion(tournament) ?? "Champion";
          const standings = tournament.competition && tournament.competition.type !== "two_stage"
            ? tournament.competition.standings
            : [];
          const runnerUp = finalMatch
            ? finalMatch.player1 === champion
              ? finalMatch.player2
              : finalMatch.player1
            : standings[1]?.player ?? null;

          return (
            <article
              key={tournament.id}
              className="cb-card cb-card-hover group relative overflow-hidden rounded-[2rem] border-amber-300/15 p-6"
            >
              <div className="pointer-events-none absolute -right-10 -top-14 text-[10rem] leading-none text-amber-300/[0.05] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                ♛
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.18em] text-amber-300">
                    {index === 0 ? "Latest champion" : "Champion"}
                  </span>
                  <span className="rounded-full bg-slate-950/60 px-3 py-1 text-[0.66rem] font-bold text-slate-400 ring-1 ring-white/8">
                    {tournament.type === "two_stage" ? "Two stage" : getFormatLabel(tournament.format)}
                  </span>
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl font-black text-amber-200 shadow-lg shadow-amber-950/20">
                    {champion.trim().charAt(0).toUpperCase() || "C"}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-3xl font-black tracking-tight text-white">{champion}</h2>
                    <p className="mt-1 truncate font-bold text-slate-300">{tournament.name}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/7 bg-slate-950/45 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-600">Final</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-200">
                        {champion} {runnerUp ? <><span className="text-slate-600">over</span> {runnerUp}</> : "claimed the title"}
                      </p>
                    </div>
                    {finalMatch ? (
                      <span className="shrink-0 rounded-xl bg-amber-300 px-3 py-2 font-black text-slate-950">
                        {finalMatch.score1 ?? 0}–{finalMatch.score2 ?? 0}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-3">
                    <p className="text-[0.58rem] font-black uppercase tracking-wider text-slate-600">Players</p>
                    <p className="mt-1 text-lg font-black text-white">{tournament.players.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-3">
                    <p className="text-[0.58rem] font-black uppercase tracking-wider text-slate-600">Results</p>
                    <p className="mt-1 text-lg font-black text-white">{completed}</p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-3">
                    <p className="text-[0.58rem] font-black uppercase tracking-wider text-slate-600">Race</p>
                    <p className="mt-1 text-lg font-black text-white">{tournament.raceTo}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-600">
                  <span className="truncate">{tournament.venue || "Venue not set"}</span>
                  <span className="shrink-0">{formatDate(tournament.updatedAt)}</span>
                </div>

                <Link
                  href={`/live/${tournament.id}`}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200"
                >
                  View final results →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
