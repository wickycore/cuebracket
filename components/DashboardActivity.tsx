"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getAllMatches,
  getTournaments,
  subscribeToTournamentChanges,
  Tournament,
} from "@/lib/tournaments";

interface ActivityItem {
  id: string;
  tournamentId: string;
  tournamentName: string;
  player1: string;
  player2: string;
  score: string;
  winner: string;
  timestamp: string;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function DashboardActivity() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    const load = () => setTournaments(getTournaments());
    load();
    return subscribeToTournamentChanges(load);
  }, []);

  const activity = useMemo<ActivityItem[]>(() => {
    return tournaments
      .flatMap((tournament) =>
        getAllMatches(tournament)
          .filter((match) => match.completed && match.player1 && match.player2)
          .map((match) => ({
            id: `${tournament.id}:${match.id}`,
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            player1: match.player1 ?? "TBD",
            player2: match.player2 ?? "TBD",
            score: `${match.score1 ?? 0}–${match.score2 ?? 0}`,
            winner: match.winner ?? "Winner",
            timestamp:
              match.endedAt ||
              match.scoreHistory?.at(-1)?.recordedAt ||
              tournament.updatedAt,
          })),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 6);
  }, [tournaments]);

  const liveMatches = useMemo(
    () =>
      tournaments.flatMap((tournament) =>
        getAllMatches(tournament)
          .filter((match) => match.status === "live")
          .map((match) => ({ tournament, match })),
      ),
    [tournaments],
  );

  return (
    <aside className="space-y-5">
      <section className="cb-card rounded-[2rem] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="cb-kicker">Now playing</p>
            <h2 className="mt-2 text-xl font-black">Live match pulse</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/20">
            <span className="cb-live-dot" /> {liveMatches.length}
          </span>
        </div>

        {liveMatches.length ? (
          <div className="mt-5 space-y-3">
            {liveMatches.slice(0, 3).map(({ tournament, match }) => (
              <Link
                key={`${tournament.id}:${match.id}`}
                href={`/tournaments/${tournament.id}`}
                className="block rounded-2xl border border-white/8 bg-slate-950/45 p-4 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.04]"
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-black uppercase tracking-wider text-cyan-300">
                    {match.tableNumber ? `Table ${match.tableNumber}` : "Table pending"}
                  </span>
                  <span className="text-slate-600">Race to {tournament.raceTo}</span>
                </div>
                <p className="mt-2 truncate font-black text-white">
                  {match.player1 || "TBD"} <span className="text-slate-600">vs</span> {match.player2 || "TBD"}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">{tournament.name}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
            <p className="font-bold text-slate-300">No matches playing</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Start a match from a tournament to activate this panel.
            </p>
          </div>
        )}
      </section>

      <section className="cb-card rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="cb-kicker">Activity feed</p>
            <h2 className="mt-2 text-xl font-black">Latest results</h2>
          </div>
          <span className="text-xl text-slate-700">↘</span>
        </div>

        {activity.length ? (
          <div className="mt-5 divide-y divide-white/8">
            {activity.map((item) => (
              <Link
                key={item.id}
                href={`/tournaments/${item.tournamentId}`}
                className="group flex gap-3 py-4 first:pt-0 last:pb-0"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/15">
                  {item.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-200 group-hover:text-cyan-200">
                    {item.winner} won
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {item.player1} vs {item.player2}
                  </span>
                  <span className="mt-1 block truncate text-[0.65rem] text-slate-600">
                    {item.tournamentName} · {formatTimestamp(item.timestamp)} UTC
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
            Completed match results will appear here.
          </p>
        )}
      </section>
    </aside>
  );
}
